-- ============================================================================
-- ContractIQ — Supabase Postgres Schema
-- Paste this entire file into the Supabase SQL Editor and run it once on a
-- fresh project. Idempotent where practical (IF NOT EXISTS / ON CONFLICT /
-- guarded DO blocks) so it can be re-run safely during development.
--
-- Source: docs/engineering/engineering-doc.md, Section 7 (Database Design)
-- and Section 8 (AI Architecture — rate limiting / cost / realtime).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ----------------------------------------------------------------------------

create extension if not exists pgcrypto; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1. SHARED TRIGGER FUNCTIONS
-- ----------------------------------------------------------------------------

-- Generic updated_at bumper, used by every table that has an updated_at column.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. TABLE: contracts
-- ----------------------------------------------------------------------------

create table if not exists contracts (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  filename                 text not null,
  contract_type            text not null check (contract_type in ('nda', 'msa')),
  detected_contract_type   text check (detected_contract_type in ('nda', 'msa', 'other')),
  status                   text not null default 'uploaded' check (status in ('uploaded', 'processing', 'completed', 'error')),
  error_message            text,
  contract_text            text not null,
  page_count               integer not null check (page_count > 0 and page_count <= 20),
  token_count              integer not null check (token_count <= 15000),
  file_size_bytes          integer not null check (file_size_bytes <= 10485760),
  file_path                text,
  storage_upload_failed    boolean not null default false,
  file_purged_at           timestamptz,
  last_accessed_at         timestamptz not null default now(),
  reviewed_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_contracts_user_id on contracts (user_id);
create index if not exists idx_contracts_status on contracts (status);
create index if not exists idx_contracts_last_accessed_at on contracts (last_accessed_at);

drop trigger if exists trg_contracts_updated_at on contracts;
create trigger trg_contracts_updated_at
  before update on contracts
  for each row
  execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. TABLE: custom_key_terms
-- ----------------------------------------------------------------------------

create table if not exists custom_key_terms (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references contracts(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  term_name    text not null,
  is_manual    boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists idx_custom_key_terms_contract_id on custom_key_terms (contract_id);

-- Enforce max 5 custom terms per contract.
create or replace function enforce_max_custom_terms()
returns trigger
language plpgsql
as $$
declare
  existing_count integer;
begin
  select count(*) into existing_count
  from custom_key_terms
  where contract_id = new.contract_id;

  if existing_count >= 5 then
    raise exception 'Maximum 5 custom terms per contract' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_max_custom_terms on custom_key_terms;
create trigger trg_enforce_max_custom_terms
  before insert on custom_key_terms
  for each row
  execute function enforce_max_custom_terms();

-- ----------------------------------------------------------------------------
-- 4. TABLE: key_terms
-- ----------------------------------------------------------------------------

create table if not exists key_terms (
  id                 uuid primary key default gen_random_uuid(),
  contract_id        uuid not null references contracts(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  custom_term_id     uuid references custom_key_terms(id) on delete set null,
  term_source        text not null check (term_source in ('standard', 'custom')),
  term_name          text not null,
  value              text not null,
  page_number        integer not null check (page_number >= 1),
  confidence_score   numeric(5, 2) not null check (confidence_score >= 0 and confidence_score <= 100),
  source_sentence    text not null,
  is_edited          boolean not null default false,
  original_ai_value  text,
  edited_at          timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists idx_key_terms_contract_id on key_terms (contract_id);
create index if not exists idx_key_terms_user_id on key_terms (user_id);

-- Capture the original AI value the first time a term is manually edited.
create or replace function capture_term_correction()
returns trigger
language plpgsql
as $$
begin
  if new.value is distinct from old.value and old.is_edited = false then
    new.original_ai_value = old.value;
    new.is_edited = true;
    new.edited_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_capture_term_correction on key_terms;
create trigger trg_capture_term_correction
  before update on key_terms
  for each row
  execute function capture_term_correction();

-- ----------------------------------------------------------------------------
-- 5. TABLE: user_settings
-- ----------------------------------------------------------------------------

create table if not exists user_settings (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  corrections_opt_in   boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

drop trigger if exists trg_user_settings_updated_at on user_settings;
create trigger trg_user_settings_updated_at
  before update on user_settings
  for each row
  execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. VIEW: term_corrections
-- Opt-in, anonymised content-level correction data. user_id is intentionally
-- omitted. Only readable by the service role (see grants below).
-- ----------------------------------------------------------------------------

create or replace view term_corrections as
select
  kt.id as correction_id,
  kt.contract_id,
  kt.term_name,
  kt.original_ai_value,
  kt.value as corrected_value,
  kt.edited_at
from key_terms kt
join user_settings us on us.user_id = kt.user_id
where kt.is_edited = true and us.corrections_opt_in = true;

revoke all on term_corrections from public, anon, authenticated;
grant select on term_corrections to service_role;

-- ----------------------------------------------------------------------------
-- 7. TABLE: chat_sessions
-- ----------------------------------------------------------------------------

create table if not exists chat_sessions (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null unique references contracts(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_chat_sessions_contract_id on chat_sessions (contract_id);

drop trigger if exists trg_chat_sessions_updated_at on chat_sessions;
create trigger trg_chat_sessions_updated_at
  before update on chat_sessions
  for each row
  execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 8. TABLE: chat_messages
-- ----------------------------------------------------------------------------

create table if not exists chat_messages (
  id               uuid primary key default gen_random_uuid(),
  chat_session_id  uuid not null references chat_sessions(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null,
  page_citation    integer,
  created_at       timestamptz not null default now()
);

create index if not exists idx_chat_messages_chat_session_id on chat_messages (chat_session_id);

-- Enforce max 200 messages per chat session.
create or replace function enforce_max_chat_messages()
returns trigger
language plpgsql
as $$
declare
  existing_count integer;
begin
  select count(*) into existing_count
  from chat_messages
  where chat_session_id = new.chat_session_id;

  if existing_count >= 200 then
    raise exception 'Maximum 200 chat messages per contract' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_max_chat_messages on chat_messages;
create trigger trg_enforce_max_chat_messages
  before insert on chat_messages
  for each row
  execute function enforce_max_chat_messages();

-- Add chat_messages to the Realtime publication so RLS-scoped Postgres
-- Changes events fire on every insert (guarded — errors if already a member).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table chat_messages;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. TABLE: user_feedback
-- ----------------------------------------------------------------------------

create table if not exists user_feedback (
  id               uuid primary key default gen_random_uuid(),
  contract_id      uuid not null references contracts(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  rating           text check (rating in ('up', 'down')),
  accuracy_rating  text check (accuracy_rating in ('yes', 'partially', 'no')),
  comment          text,
  created_at       timestamptz not null default now(),
  constraint user_feedback_not_empty check (
    rating is not null or accuracy_rating is not null or comment is not null
  )
);

create index if not exists idx_user_feedback_contract_id on user_feedback (contract_id);

-- ----------------------------------------------------------------------------
-- 10. TABLE: openai_usage_log
-- ----------------------------------------------------------------------------

create table if not exists openai_usage_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  contract_id     uuid references contracts(id) on delete set null,
  operation       text not null check (operation in ('extraction', 'chat')),
  prompt_version  text not null,
  input_tokens    integer not null,
  output_tokens   integer not null,
  cost_usd        numeric(10, 4) not null,
  duration_ms     integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_openai_usage_log_user_id_created_at on openai_usage_log (user_id, created_at);

-- ----------------------------------------------------------------------------
-- 11. TABLE: rate_limit_events
-- ----------------------------------------------------------------------------

create table if not exists rate_limit_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  action      text not null check (action in ('process', 'chat')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_rate_limit_events_user_action_created on rate_limit_events (user_id, action, created_at);

-- ----------------------------------------------------------------------------
-- 12. TABLE: beta_access
-- ----------------------------------------------------------------------------

create table if not exists beta_access (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  granted_at  timestamptz not null default now()
);

-- Atomically grants Measurement Beta access if the cohort is under 50 users.
-- SECURITY DEFINER so it can INSERT into beta_access despite no client-facing
-- INSERT RLS policy existing on that table (see RLS section below); the
-- pg_advisory_xact_lock serializes concurrent callers against the same
-- logical resource (the beta cohort) so the count-then-insert cannot race —
-- this is what makes the count-then-insert genuinely atomic across concurrent
-- callback invocations, not just within a single call.
create or replace function grant_beta_access(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cohort_size integer;
begin
  perform pg_advisory_xact_lock(hashtext('beta_access_cohort'));

  if exists (select 1 from beta_access where user_id = p_user_id) then
    return true; -- already granted (idempotent)
  end if;

  select count(*) into cohort_size from beta_access;
  if cohort_size < 50 then
    insert into beta_access (user_id) values (p_user_id);
    return true;
  end if;

  return false; -- cohort full
end;
$$;

-- Only the service role (used exclusively by app/auth/callback/route.ts) may call
-- this function — an ordinary authenticated user must never be able to RPC this
-- with an arbitrary p_user_id and self-grant beta access for someone else.
revoke all on function grant_beta_access(uuid) from public, anon, authenticated;
grant execute on function grant_beta_access(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 13. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

alter table contracts enable row level security;
alter table custom_key_terms enable row level security;
alter table key_terms enable row level security;
alter table user_settings enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table user_feedback enable row level security;
alter table openai_usage_log enable row level security;
alter table rate_limit_events enable row level security;
alter table beta_access enable row level security;

-- contracts: full CRUD scoped to owner
drop policy if exists "contracts_select_own" on contracts;
create policy "contracts_select_own" on contracts
  for select using (auth.uid() = user_id);

drop policy if exists "contracts_insert_own" on contracts;
create policy "contracts_insert_own" on contracts
  for insert with check (auth.uid() = user_id);

drop policy if exists "contracts_update_own" on contracts;
create policy "contracts_update_own" on contracts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "contracts_delete_own" on contracts;
create policy "contracts_delete_own" on contracts
  for delete using (auth.uid() = user_id);

-- custom_key_terms: full CRUD scoped to owner
drop policy if exists "custom_key_terms_select_own" on custom_key_terms;
create policy "custom_key_terms_select_own" on custom_key_terms
  for select using (auth.uid() = user_id);

drop policy if exists "custom_key_terms_insert_own" on custom_key_terms;
create policy "custom_key_terms_insert_own" on custom_key_terms
  for insert with check (auth.uid() = user_id);

drop policy if exists "custom_key_terms_update_own" on custom_key_terms;
create policy "custom_key_terms_update_own" on custom_key_terms
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "custom_key_terms_delete_own" on custom_key_terms;
create policy "custom_key_terms_delete_own" on custom_key_terms
  for delete using (auth.uid() = user_id);

-- key_terms: full CRUD scoped to owner (insert performed server-side via
-- route handler using the user's session, update performed client-side for
-- inline correction)
drop policy if exists "key_terms_select_own" on key_terms;
create policy "key_terms_select_own" on key_terms
  for select using (auth.uid() = user_id);

drop policy if exists "key_terms_insert_own" on key_terms;
create policy "key_terms_insert_own" on key_terms
  for insert with check (auth.uid() = user_id);

drop policy if exists "key_terms_update_own" on key_terms;
create policy "key_terms_update_own" on key_terms
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "key_terms_delete_own" on key_terms;
create policy "key_terms_delete_own" on key_terms
  for delete using (auth.uid() = user_id);

-- user_settings: full CRUD scoped to owner (upsert from PrivacyPreferences)
drop policy if exists "user_settings_select_own" on user_settings;
create policy "user_settings_select_own" on user_settings
  for select using (auth.uid() = user_id);

drop policy if exists "user_settings_insert_own" on user_settings;
create policy "user_settings_insert_own" on user_settings
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_own" on user_settings;
create policy "user_settings_update_own" on user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- chat_sessions: full CRUD scoped to owner
drop policy if exists "chat_sessions_select_own" on chat_sessions;
create policy "chat_sessions_select_own" on chat_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "chat_sessions_insert_own" on chat_sessions;
create policy "chat_sessions_insert_own" on chat_sessions
  for insert with check (auth.uid() = user_id);

-- chat_messages: select + insert scoped to owner (messages are immutable —
-- no update/delete policy is defined, matching the append-only chat model)
drop policy if exists "chat_messages_select_own" on chat_messages;
create policy "chat_messages_select_own" on chat_messages
  for select using (auth.uid() = user_id);

drop policy if exists "chat_messages_insert_own" on chat_messages;
create policy "chat_messages_insert_own" on chat_messages
  for insert with check (auth.uid() = user_id);

-- user_feedback: select + insert scoped to owner (feedback is immutable)
drop policy if exists "user_feedback_select_own" on user_feedback;
create policy "user_feedback_select_own" on user_feedback
  for select using (auth.uid() = user_id);

drop policy if exists "user_feedback_insert_own" on user_feedback;
create policy "user_feedback_insert_own" on user_feedback
  for insert with check (auth.uid() = user_id);

-- openai_usage_log: select-only for owner (all writes are service-role /
-- server-side via usageLogger.ts using the user's authenticated session)
drop policy if exists "openai_usage_log_select_own" on openai_usage_log;
create policy "openai_usage_log_select_own" on openai_usage_log
  for select using (auth.uid() = user_id);

drop policy if exists "openai_usage_log_insert_own" on openai_usage_log;
create policy "openai_usage_log_insert_own" on openai_usage_log
  for insert with check (auth.uid() = user_id);

-- rate_limit_events: select + insert scoped to owner (written by route
-- handlers using the user's authenticated session immediately before each
-- OpenAI call)
drop policy if exists "rate_limit_events_select_own" on rate_limit_events;
create policy "rate_limit_events_select_own" on rate_limit_events
  for select using (auth.uid() = user_id);

drop policy if exists "rate_limit_events_insert_own" on rate_limit_events;
create policy "rate_limit_events_insert_own" on rate_limit_events
  for insert with check (auth.uid() = user_id);

-- beta_access: select-only for own row. No client-side INSERT/UPDATE/DELETE
-- policy is defined on purpose — rows are only ever written by the
-- service-role client in app/auth/callback/route.ts, which bypasses RLS
-- entirely. This prevents any authenticated user from self-granting access.
drop policy if exists "beta_access_select_own" on beta_access;
create policy "beta_access_select_own" on beta_access
  for select using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 14. STORAGE — `contracts` bucket + RLS policies
--
-- Object path pattern (storage.objects.name, RELATIVE TO THE `contracts` BUCKET —
-- do NOT prefix the literal string "contracts/" onto this path):
--   {user_id}/{contract_id}/{filename}.pdf
--
-- Reconciliation note: the PRD (FR-14) and engineering doc (Sections 6/7) describe
-- this as "contracts/{user_id}/{contract_id}/{filename}.pdf" — that phrasing refers
-- to BUCKET NAME + path together (i.e. "the `contracts` bucket, at path
-- {user_id}/{contract_id}/{filename}.pdf"), not a literal "contracts/" prefix on the
-- object name itself. This matters: the RLS policies below use
-- auth.uid()::text = (storage.foldername(name))[1] to authorize by user — if the
-- object name were literally prefixed with "contracts/", (storage.foldername(name))[1]
-- would resolve to the string "contracts" instead of the user's UUID, and every
-- legitimate upload/read/delete would be rejected. The unprefixed convention below is
-- what every Route Handler in docs/specs/03, 12, and 14 actually builds and consumes
-- (e.g. `${userId}/${contract.id}/${file.name}` in docs/specs/03-pdf-upload-and-extraction.md)
-- and is the one that is actually correct against these RLS policies.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

drop policy if exists "contracts_bucket_insert_own" on storage.objects;
create policy "contracts_bucket_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'contracts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "contracts_bucket_select_own" on storage.objects;
create policy "contracts_bucket_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'contracts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "contracts_bucket_delete_own" on storage.objects;
create policy "contracts_bucket_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'contracts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- End of schema. Safe to re-run in full on the same project.
-- ============================================================================
