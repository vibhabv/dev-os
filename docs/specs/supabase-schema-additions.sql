-- ============================================================================
-- ContractIQ — Supabase Postgres Schema ADDITIONS (append-only)
--
-- This file is deliberately separate from supabase-schema.sql, which is not
-- edited as part of this build (per the project's build instructions). Paste
-- this file into the Supabase SQL Editor and run it AFTER supabase-schema.sql
-- has already been applied once.
--
-- Adds: correction_review_queue — the weekly drift-review sample table
-- written to by netlify/functions/quality-monitor.ts (docs/specs/13-
-- rate-limiting-and-cost-control.md, "2. Opt-in, anonymised content sample
-- for the weekly drift review queue" — `writeToReviewQueue()`). This is the
-- approved default for "an internal review table" referenced by that spec's
-- inline comment, in place of an external shared doc/sheet.
-- ============================================================================

create table if not exists correction_review_queue (
  id                 uuid primary key default gen_random_uuid(),
  key_term_id        uuid not null references key_terms(id) on delete cascade,
  contract_id        uuid not null references contracts(id) on delete cascade,
  term_name          text not null,
  original_ai_value  text not null,
  corrected_value    text not null,
  flagged_reason     text not null,
  created_at         timestamptz not null default now()
);

create index if not exists idx_correction_review_queue_created_at on correction_review_queue (created_at);

-- Service-role only — this table is populated exclusively by
-- netlify/functions/quality-monitor.ts from the already-anonymised
-- term_corrections view (no user_id column here either), and read by the ops
-- team, never by an end user's browser.
alter table correction_review_queue enable row level security;

revoke all on correction_review_queue from public, anon, authenticated;
grant select, insert on correction_review_queue to service_role;

-- ============================================================================
-- Adds: chat_messages.context_source — persists which QueryClassification
-- (contract | history | both, lib/openai/prompts/chatSystemPrompt.ts)
-- produced an assistant reply, so the UI can attribute the source correctly
-- on reload and Realtime delivery, not just in the initial HTTP response.
-- Null for user-authored rows. Written by
-- app/api/contracts/[contractId]/chat/route.ts
-- (docs/specs/09-contract-chat-and-realtime.md, Conversation Memory Layer).
-- No RLS change needed — existing chat_messages_select_own /
-- chat_messages_insert_own policies already govern the whole row.
-- ============================================================================

alter table chat_messages
  add column if not exists context_source text check (context_source in ('contract', 'history', 'both'));

-- ============================================================================
-- Tightens: rate_limit_events — removes the client-facing select/insert
-- policies. lib/security/rateLimiter.ts (skills/security-foundation/
-- SKILL.md requirement 3) now reads and writes this table exclusively via
-- createSupabaseAdminClient() (service role), so the app itself no longer
-- needs the authenticated client to touch this table at all. The prior
-- rate_limit_events_select_own/_insert_own policies (still scoped correctly
-- to auth.uid() = user_id, never a live bug) were nonetheless unnecessary
-- residual attack surface: without them, a user hitting the Supabase REST
-- API directly with their own JWT — bypassing this app's routes entirely —
-- cannot read or write this table at all, matching the
-- correction_review_queue "service role only" pattern above.
-- ============================================================================

drop policy if exists "rate_limit_events_select_own" on rate_limit_events;
drop policy if exists "rate_limit_events_insert_own" on rate_limit_events;

revoke all on rate_limit_events from public, anon, authenticated;
grant select, insert on rate_limit_events to service_role;

-- ============================================================================
-- End of additions.
-- ============================================================================
