---
name: contractiq-engineering-doc
description: Status and architectural decisions behind docs/engineering/engineering-doc.md for the ContractIQ project
metadata:
  type: project
---

`docs/engineering/engineering-doc.md` was **APPROVED** by `engineering-reviewer` on 2026-09-16, after 8 rounds of independent review (Rounds 1-7 returned NEEDS REVISION with progressively narrower findings; Round 8 was a full clean fresh-pass). See [[engineering-review-loop-pattern]] for the process pattern that produced this many rounds and how to shorten it next time.

**Why 8 rounds, not a sign of a bad draft:** each round's findings shrank in scope (7 issues → 4 → 2 → 2 minor → 1 → 1 → 1) as PRD coverage became more complete — this is the expected shape of an adversarial audit loop against a ~650-line PRD with many named subsections, not evidence the first draft was weak.

## Key architectural decisions made to resolve PRD ambiguity

- **Backend:** Next.js Route Handlers (not Supabase Edge Functions) as the sole backend layer — PRD offered either option; Route Handlers keep the OpenAI key and orchestration in one deployable unit, consistent with "backend layer kept thin."
- **Chat delivery:** Supabase Realtime (`chat_messages` added to the `supabase_realtime` publication) implements the PRD's explicit "Realtime subscriptions for chat message streaming" architecture line, even though the underlying OpenAI call itself is non-streaming — Realtime Postgres Changes events (RLS-scoped) are the canonical delivery path; the `POST` response body is just an optimistic-UI confirmation for the tab that sent the message.
- **Frontend framework:** PRD says "React SPA"; this skill fixes Next.js/App Router regardless. Reconciled via an explicit "Decision recorded" note (Section 5) rather than silently ignoring the PRD's wording — RSC is used only for initial-page-load HTML; every interactive surface (forms, PDF viewer, chat, inline editing) remains a Client Component, preserving the SPA-like interaction model the PRD actually cares about.
- **Corrections privacy:** PRD requires "opt-in, anonymised" user corrections for the prompt-improvement loop (Section 1 MOAT #2, Section 10). Implemented via `user_settings.corrections_opt_in` (default `false`) gating a `term_corrections` view that excludes `user_id`. Deliberately kept **separate** from the unrelated ≤12%/7-day correction-*rate* alert, which is a pure aggregate count with no content exposure and is therefore computed directly against `key_terms` for all users, unfiltered by opt-in — this distinction had to be reasoned out and documented explicitly to avoid it reading as a compliance gap.
- **DPA-with-OpenAI double-mention:** PRD Section 3 scopes it "before EU onboarding"; PRD Section 11 Launch Criteria lists it as a flat, unconditional Public Launch go-criterion. Resolved by treating the Section 3 language as a *floor, not a ceiling*: the DPA must be signed before Public Launch regardless of initial user geography. Documented as an explicit reconciliation paragraph, cross-referenced from both Section 6 (dependencies) and Section 13 (launch gates) — picking one interpretation and silently dropping the other would have left an unreconciled contradiction.
- **North Star vs. Primary Metric conflation risk:** PRD's North Star ("upload → completed key-term review," ≤15 min) and a Primary Metric ("time to first extracted key-term display," ≤30s P95) are both phrased as "time from upload" but differ by ~30x — easy to accidentally conflate. Kept as two distinct Section 1 table rows. Implemented the North Star via a `contracts.reviewed_at` column set by an explicit "Mark Review Complete" button, with a SQL fallback (`GREATEST` of `last_accessed_at`, latest `key_terms.edited_at`, latest `chat_messages.created_at`) for users who never click it, directly implementing the PRD's own "...or last interaction timestamp" clause.
- **Beta cohort cap:** PRD Section 11 gives a hard "≤50 users" Measurement Beta cap. Implemented as a real technical mechanism, not just a policy statement: a `beta_access` table (service-role-only `INSERT`, to prevent a race condition from over-admitting the cohort) + `BETA_MODE_ENABLED` env flag + a `middleware.ts` gate + a `/beta-waitlist` page.
- **Feedback schema:** `user_feedback` carries two independent, both-nullable fields — `rating` (thumbs up/down, NPS-style proxy) and `accuracy_rating` (yes/partially/no, the PRD's distinct "Were the extracted terms accurate?" survey, which is *both* a Section 10 eval metric *and* a Section 11 Launch Criteria "Helpful" go-criterion with different Beta/Public-Launch targets). These read as similar ("user feedback") but the PRD treats them as separate signals — collapsing them into one field was the actual Round 2 gap.

## Non-obvious scoping calls (documented as deliberate, not silent omissions)

- Public/developer API access (a PRD Section 12 "Pro" plan pricing perk) is explicitly out of scope for MVP — Section 9's Route Handlers are first-party-only, not designed/authenticated/rate-limited for external developer consumption.
- Industry-segmented Fairness auditing (PRD Section 11) is explicitly flagged as **not feasible** in the MVP schema (no `industry` field exists anywhere) and deferred to v1.2's workspace/company metadata — documented as a known limitation rather than left unmentioned. Jurisdiction segmentation *is* feasible in MVP (reuses the already-extracted `Governing Law`/`Jurisdiction` key terms) and was implemented.
- The PRD's "Evaluation Spreadsheet" (Section 10) and "Benchmarks shared with users" public trust page (Section 11) are both non-engineering reporting/content deliverables, not app features — but both got an explicit note mapping their PRD-specified columns/content to data the architecture already produces, rather than being silently dropped as "out of scope." The reviewer flagged the first PRD-adjacent artifact left completely unmentioned (before this pattern was established) as a gap.

## Final state

Approved engineering doc lives at `docs/engineering/engineering-doc.md`. Next stage per `CLAUDE.md`'s workflow is Stage 2 (`/implementation-specs`) — not started by this run.
