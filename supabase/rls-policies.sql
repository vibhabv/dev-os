-- ============================================================================
-- ContractIQ — Row Level Security (skills/security-foundation/SKILL.md)
--
-- Paste-and-run in the Supabase SQL Editor. Idempotent — safe to re-run.
--
-- This file does NOT duplicate the full, already-correct policy set defined
-- in docs/specs/supabase-schema.sql (contracts_select_own, chat_messages_
-- select_own, etc.) and docs/specs/supabase-schema-additions.sql — that
-- would risk the two copies drifting apart. It re-affirms that RLS is
-- enabled on every table (defense in depth — a no-op if already applied)
-- and carries the one policy CHANGE this security pass made: tightening
-- rate_limit_events to service-role-only. Apply the two docs/specs files
-- first on a fresh project; this file is the standalone security-audit
-- artifact for review and for re-running independently.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RLS enabled on every table that holds user or usage data.
-- ----------------------------------------------------------------------------

alter table contracts            enable row level security;
alter table custom_key_terms     enable row level security;
alter table key_terms            enable row level security;
alter table user_settings        enable row level security;
alter table chat_sessions        enable row level security;
alter table chat_messages        enable row level security;
alter table user_feedback        enable row level security;
alter table openai_usage_log     enable row level security;
alter table rate_limit_events    enable row level security;
alter table beta_access          enable row level security;
alter table correction_review_queue enable row level security;

-- ----------------------------------------------------------------------------
-- 2. rate_limit_events — service-role only (the one real change here).
--
-- lib/security/rateLimiter.ts reads and writes this table exclusively via
-- createSupabaseAdminClient(), so the app no longer needs the authenticated
-- client to touch it. The prior rate_limit_events_select_own/_insert_own
-- policies (correctly scoped to auth.uid() = user_id; never a live bug on
-- their own) were nonetheless unnecessary attack surface: without them, a
-- user hitting the Supabase REST API directly with their own JWT — bypassing
-- this app's routes entirely — cannot read or write this table at all,
-- matching the correction_review_queue "service role only" pattern.
-- ----------------------------------------------------------------------------

drop policy if exists "rate_limit_events_select_own" on rate_limit_events;
drop policy if exists "rate_limit_events_insert_own" on rate_limit_events;

revoke all on rate_limit_events from public, anon, authenticated;
grant select, insert on rate_limit_events to service_role;

-- ----------------------------------------------------------------------------
-- 3. openai_usage_log — confirmed service-role-only, no client policy exists
-- (written exclusively by lib/openai/usageLogger.ts server-side). Re-affirmed
-- here, not changed.
-- ----------------------------------------------------------------------------

revoke all on openai_usage_log from public, anon, authenticated;
grant select, insert on openai_usage_log to service_role;

-- ============================================================================
-- End. Every other table's per-owner policies (contracts_select_own,
-- chat_sessions_select_own, chat_messages_select_own/insert_own,
-- user_feedback_select_own/insert_own, custom_key_terms_*, key_terms_*,
-- user_settings_*, beta_access_select_own) are unchanged by this security
-- pass — see docs/specs/supabase-schema.sql for their definitions.
-- ============================================================================
