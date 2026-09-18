---
name: contractiq-review-history
description: Round-by-round verdict log for the ContractIQ docs/specs/ audit against ContractIQ_PRD.md + engineering-doc.md.
metadata:
  type: project
---

Tracks each independent review round of ContractIQ's Stage 2 implementation spec (`docs/specs/`, 20 files
00–19 + `supabase-schema.sql`, plus root `.env.example`). Each round is a fresh, from-scratch audit — do not
skip re-verifying "already resolved" items; a fix in one file has repeatedly introduced or exposed issues
elsewhere in this project.

**Round 4** (prior to memory system): NEEDS REVISION, 2 issues — `loadContractOwnedBy()` undefined; `/process`
response omitted `key_terms[].id`. Both fixed by round 5, verified independently.

**Round 5** (2026-09-17): NEEDS REVISION, 1 issue — `docs/specs/07-results-viewer.md` FR-06 guarantee not backed
by shown code (`ResultsViewer` never called `useSignedPdfUrl`). Fixed for round 6: `ResultsViewer` now calls
`useSignedPdfUrl` itself and branches to `TextViewerFallback` on `isError`; `PdfViewer` takes `signedUrl` as a
prop. Verified independently in round 6 — genuinely fixed, no regression, edge-case table now matches the code.

**Round 6** (2026-09-17): Verdict: ❌ NEEDS REVISION, 2 new issues found (full fresh audit of all 20 spec files +
schema.sql + .env.example against both source docs):

1. **`supabaseServer` (the module-level symbol used for nearly every backend DB write) is never formally
   defined anywhere in the spec set**, despite being used across `docs/specs/03, 04, 09, 13, 14` for every
   server-side insert/update/select. `docs/specs/00-overview-and-conventions.md` is explicitly the file that
   formalizes shared primitives (`jsonError()`, `withApiAuth()`, `loadContractOwnedBy()` — the exact fix pattern
   from round 4/5) but never shows `lib/supabase/server.ts`'s actual implementation or clarifies whether
   `supabaseServer` is a per-request, cookie-bound client (RLS-enforced, matching `createServerClient(/* cookies
   from req */)` as correctly shown in `withApiAuth` and `middleware.ts`) or a service-role/singleton client
   (RLS-bypassed). This is a genuine ambiguity, not just a documentation nicety: engineering doc Section 6 states
   RLS is "the source of truth on every table" and that Route Handlers "additionally re-verify... as
   defense-in-depth against RLS misconfiguration" — language that only makes sense if Route Handler DB calls are
   themselves still subject to RLS. But a bare imported singleton (as `supabaseServer` is used throughout, with
   no per-request cookie threading ever shown) cannot correctly carry a specific request's user session in the
   Next.js Route Handler model this project uses — unlike `createServerClient(/* cookies from req */)`, which
   the spec _does_ show being called freshly per request in `withApiAuth`/`middleware.ts`. Fix belongs in
   `docs/specs/00-overview-and-conventions.md`, defining `lib/supabase/server.ts` explicitly (factory function
   bound to request cookies vs. singleton) and reconciling it with the RLS-defense-in-depth claim.

2. **`POST /api/contracts/{contractId}/chat` (`docs/specs/09-contract-chat-and-realtime.md`) silently drops
   non-trigger insert errors on the user message row.** The handler does
   `const { error: insertErr } = await supabaseServer.from('chat_messages').insert({...role: 'user'...})` then
   only checks `if (insertErr?.message.includes('Maximum 200 chat messages'))` — any other insert failure (e.g.
   transient DB error) is silently ignored and execution falls through to calling OpenAI and returning a normal
   `200` response, even though the user's own message may never have been persisted. This contradicts FR-09
   ("All chat messages must be saved to Supabase in real-time") and engineering doc Section 6's explicit "no
   silent failures... no request fails without either a successful response or a user-visible error state."
   Every analogous insert in this project (03's `contracts` insert, 04's `key_terms` insert) uses a generic
   `if (insertErr || !data)` check instead of a narrow substring match — this route's narrower check is an
   inconsistency introduced only here. Fix belongs in `docs/specs/09-contract-chat-and-realtime.md`.

Everything else re-verified clean this round: FR-06/07-results-viewer.md fix holds up; API error taxonomy vs.
HTTP status table vs. actual route usage consistent; `loadContractOwnedBy()` still correctly defined and used
identically at all 3 call sites; `key_terms` insert still chains `.select()` and returns DB rows with `id`;
storage path convention consistent everywhere; RLS policies present for every table/operation; all env vars
referenced across specs present in `.env.example`; rate limits, cost tracking, retention, chat realtime,
glossary, onboarding, beta gating, incident response, testing/eval gates all traced to source requirements
with no contradictions found; edge-case tables in every file now cross-checked against the code shown in the
same file with no further prose/code mismatches found (the round-5 pattern from [[contractiq-gap-patterns]] did
not recur elsewhere).

**Round 7** (2026-09-17): Verdict: ❌ NEEDS REVISION, 3 new issues found. Confirmed the round-6 fixes are both
genuinely solid (full `supabaseServer`/`createSupabaseServerClient()` definition present in `00-overview-and-conventions.md`
with correct RLS-defense-in-depth reconciliation; `INTERNAL_ERROR`/`mapUnhandledErrorToEnvelope()` defined; the
chat route's *user*-message insert now correctly checks `if (insertErr)` generically). But the same
"every Supabase write's error must be branched on" principle the round-6 fix established was not applied
project-wide — found two more unchecked-write instances plus a recurrence of the round-5 prose-vs-code pattern:

1. `docs/specs/04-key-term-extraction.md` — the `/process` route handler's final `contracts` status update
   (`status: 'completed', detected_contract_type: ...`) is a bare `await` with no `error` destructured/checked,
   immediately below the `key_terms` insert in the same function, which *is* correctly checked
   (`if (insertErr || !insertedTerms)`). If this update silently fails, the client still receives a `200` response
   claiming `status: 'completed'` while the DB row may remain stuck at `'processing'` — and since the route's own
   precondition only allows re-processing from `'uploaded'`/`'error'`, a contract stuck at `'processing'` can never
   be retried via this same endpoint. The earlier `status: 'processing'` update (line 89) and the `status: 'error'`
   update inside the failure branch (line 116) have the identical unchecked-write pattern, though they're less
   consequential since the response given to the client in those paths is still accurate either way.
2. `docs/specs/09-contract-chat-and-realtime.md` — the *assistant* message insert (`chat_messages` insert with
   `role: 'assistant'`) is also a bare, unchecked `const { data: assistantMsg } = await ...insert(...).select().single();`
   just a few lines below the *user*-message insert that round 6 fixed to check `if (insertErr)` explicitly — an
   inconsistency within the same function. If this insert fails (e.g. it happens to be the one that trips the
   200-message-cap trigger, since both the user and assistant rows count against the same session's cap and the
   cap could be crossed between the two inserts of one turn), `assistantMsg` is `null` and the next line
   (`assistantMsg.id` inside the response `NextResponse.json(...)`) throws, skipping `logUsage()` entirely even
   though the OpenAI call already succeeded and was billed — contradicting `docs/specs/13-rate-limiting-and-cost-control.md`'s
   own stated invariant ("Called after every successful OpenAI call") and engineering doc Section 8's "every
   OpenAI call logs ... to `openai_usage_log`." The user also gets a generic `INTERNAL_ERROR` instead of the
   specific `CHAT_HISTORY_LIMIT_REACHED` code that would actually apply if the cap was the cause.
3. Recurrence of the round-5 gap-pattern (prose asserting behavior the shown code doesn't implement):
   `docs/specs/15-glossary-and-onboarding.md`'s `useOnboarding()` and `docs/specs/19-landing-page-and-global-ux.md`'s
   `LargeFileWarningBanner` both have edge-case-table rows claiming graceful degradation "if `window.localStorage`
   throws" (15) / "JS disabled / no localStorage... degrades to always show" (19), but the `useState` lazy
   initializer shown in both (`typeof window !== 'undefined' && localStorage.getItem(KEY) === 'true'`) has no
   try/catch — a genuine `localStorage` throw (e.g. blocked storage) would propagate as an uncaught exception
   during render, not gracefully degrade as the prose claims.

Everything else re-verified clean: RLS policies, storage bucket path convention + reconciliation note,
`grant_beta_access` atomicity, env vars, error taxonomy/HTTP table, all FR-01–FR-14/US-001–US-012 traced with no
other contradictions found.

**Round 8** (2026-09-17): Verdict: ❌ NEEDS REVISION, 3 new issues found. Confirmed all 3 round-7 fixes are
genuinely solid (04's `processing`/`completed` updates checked + explanatory comment on the intentionally-unchecked
`catch`-block write; 09's assistant-message insert checked with `CHAT_HISTORY_LIMIT_REACHED`/`INTERNAL_ERROR`,
`logUsage()` correctly moved to fire unconditionally before that insert; 15/19's `localStorage` wrappers now have
real try/catch via `safeGetItem`/`safeSetItem`, and 15's edge-case row corrected to "shows every session, dismissal
doesn't persist"). New findings, surfaced by grepping every `await supabase*`/`await admin.` call across all 20
files and checking each one's error handling (continuing the round 6/7 "every write must be checked or explicitly
commented as intentionally unchecked" principle):
1. `docs/specs/09-contract-chat-and-realtime.md` — `hooks/useChatSession.ts`'s `chat_sessions` select/insert never
   checks `error`; `session!.id` non-null-asserts on a value that can be `null`/`undefined` on failure, throwing
   inside an un-awaited async IIFE (unhandled promise rejection) — `sessionId` never gets set, Chat panel hangs
   forever with no error shown. Every other direct-client write elsewhere in the project (06, 07/08, 10, 11) checks
   `error` and surfaces a message; this hook is the one exception.
2. `docs/specs/12-account-settings-and-privacy.md` — `hooks/useUserSettings.ts`'s `mutationFn` returns the raw
   Supabase `upsert()` response instead of checking `error` and throwing (unlike every `queryFn` elsewhere in the
   project, e.g. 07's `useContract`/`useKeyTerms`, which do `if (error) throw error;`) — so TanStack Query treats a
   failed privacy-opt-in write as a success, and the documented "Saved" confirmation fires even when the DB write
   failed. User-facing correctness bug on a privacy-sensitive control (PRD MOAT #2 opt-in gate).
3. `docs/specs/03-pdf-upload-and-extraction.md` — the post-upload `contracts` Storage-status update (`{ file_path:
   path }` or `{ storage_upload_failed: true, file_path: null }`) is a bare unchecked `await`, right below the
   checked `contracts` insert in the same handler. Doesn't affect the `201` response (no storage fields in it), but
   if the real Storage upload succeeds and only this status-write fails, `file_path` silently stays `NULL` —
   `docs/specs/07`'s `ResultsViewer` permanently falls back to the text viewer despite a valid PDF existing, and
   `docs/specs/14`'s retention job (`WHERE file_path IS NOT NULL`) never picks up the orphaned object. No check and
   no "intentionally unchecked" comment, unlike every other narrow-consequence unchecked write established since
   round 7 (04's `catch`-block status update has exactly this kind of explanatory comment; this one doesn't).

Pattern note for future rounds: once route-handler-level (`supabaseServer`) unchecked writes were fully cleaned up
(rounds 6–7), the next layer the pattern recurred in was **direct-Supabase-client hooks/mutations called from
React components** — same defect class, different call-site category. Worth a dedicated grep pass on `useMutation`/
`mutationFn` bodies and any `hooks/use*.ts` async functions, not just Route Handler bodies, in every future round
until this stops turning up new instances.

**Round 9** (2026-09-17): Verdict: ❌ NEEDS REVISION, 3 new issues found. Confirmed all 3 round-8 fixes are
genuinely solid (09's `useChatSession.ts` now checks `error` on both the `chat_sessions` select and insert and
exposes `sessionError`, plus `messagesError` on the read query, both surfaced by `ChatPanel`; 12's `useUserSettings.ts`
`mutationFn` now throws on `error` so a failed privacy-opt-in write no longer shows a false "Saved"; 03's post-upload
Storage-status `contracts` update is now checked with a `console.error` + explanatory comment). Did a project-wide
`Grep` for every `.insert(`/`.update(`/`.upsert(`/`.delete(` call site across all 20 spec files (continuing the
round 6–8 "every write must check error, or be explicitly commented as intentionally unchecked" line) and found the
pattern had migrated to a **third** call-site category — plain, un-hooked direct-Supabase-client calls inside
one-off component event handlers and small `lib/` helper functions, not wrapped in `useMutation`/`queryFn` at all:
1. `docs/specs/11-feedback-and-satisfaction-survey.md` — the `user_feedback` insert (`const { error } = await
   supabase.from('user_feedback').insert({...})`) destructures `error` but the file never shows it being checked
   anywhere afterward — no `if (error)` branch exists in the spec. This directly contradicts the very next
   sentence's prose ("On success, the widget replaces itself with 'Thanks for your feedback!'"), which implies a
   distinct failure path exists — it doesn't, in the code shown. As written, the widget shows the success message
   unconditionally regardless of whether the DB insert actually succeeded, the same "false success shown to user"
   defect class as round 8's `useUserSettings.ts` finding, just in a plain component handler instead of a
   `mutationFn`.
2. `docs/specs/13-rate-limiting-and-cost-control.md` — `lib/openai/usageLogger.ts`'s `logUsage()` does
   `await supabaseServer.from('openai_usage_log').insert({...})` with no destructuring of `error` at all (not even
   an ignored variable) and no try/catch. A silent failure here drops the row `netlify/functions/cost-monitor.ts`
   depends on for its 80%-of-budget Slack alert (engineering doc Section 8, "every OpenAI call logs... to
   `openai_usage_log`"; PRD Section 3 External Dependency: "maintain cost alerting at 80% of budget threshold") —
   undermining the one mechanism that protects against the named external-dependency risk ("OpenAI pricing changes
   could push per-analysis cost above threshold"), with no visibility into the gap since nothing logs or surfaces
   the failure.
3. `docs/specs/10-dashboard-and-north-star-metric.md` — `MarkReviewCompleteButton`'s `markComplete()` does check
   `error` (`if (!error) setLocalReviewed(true)`) but takes no action at all in the failure branch — no toast, no
   inline message, nothing — unlike every sibling direct-client mutation in this project that shows an explicit
   failure state on the same kind of write (`docs/specs/06-custom-key-terms.md`'s custom-term insert:
   "Could not add this term..."; `docs/specs/08-inline-correction.md`'s term edit: "Could not save your edit...");
   `docs/specs/12-account-settings-and-privacy.md`'s privacy toggle: "Could not save your preference..."). Lower
   severity than #1/#2 since the North Star Metric has a documented `GREATEST()` fallback that still covers a user
   who never successfully clicks this button, but it's a genuine silent-failure inconsistency with the project's
   own established convention.

Everything else re-verified clean this round: all 20 spec files + schema.sql + .env.example read in full; standard
term lists (10 NDA / 12 MSA) match PRD Section 4 step 2 exactly; glossary covers all 19 distinct standard term
names; RLS policies present and consistent for every table/Storage policy; `beta_access`/`grant_beta_access()`
atomicity intact; HTTP status/error-code table internally consistent and matches every route's actual usage; all
env vars referenced across specs present in `.env.example`; no new instances of the round-5 prose-vs-code edge-case
mismatch pattern found this round.

**Round 10** (2026-09-17): Verdict: 👍 😊 APPROVED — zero gaps found. Confirmed all 3 round-9 issues are
genuinely fixed (11's `submitFeedback()` now gates the "Thanks for your feedback!" state on a confirmed
`!error`; 13's `logUsage()` checks `error` and `console.error`-logs with an explicit rationale comment; 10's
`markComplete()` now shows a "Could not mark this reviewed..." toast on failure). Also confirmed all 5
proactive fixes the planner made without being asked are genuinely solid and consistent with project
convention: 06's custom-term delete (checked, non-optimistic UI update), 07's `last_accessed_at` bump (checked
+ logged, intentionally not surfaced, with rationale), 13's `checkLimit()` (both the count-query and the
`rate_limit_events` insert checked + logged, "fails open" rationale documented), 14's `retention-cleanup.ts`
(both the select and the post-purge update checked + logged), 12's removal of a dead `list()` call.

Ran the project-wide grep for every `.insert(`/`.update(`/`.upsert(`/`.delete(`/`.remove(` call site across all
20 files again (the standing first step per [[contractiq-gap-patterns]]'s round-9 addendum) — every call site
found already has a correct `error` check or an explicit "intentionally unchecked, here's why" comment. This
defect class (which recurred in rounds 6, 7, 8, 9 across four different structural locations) appears to be
genuinely exhausted now — this is the first round where the exhaustive grep turned up zero new instances.

Also specifically re-checked: (a) every shared/helper symbol referenced but not fully defined in code
(`isNotFoundError`, `removeAllUserStorageObjects`, `getStorageUsagePercent`, `postSlackAlert`,
`writeToReviewQueue`, `groupCorrectionRateByContractType`, `loadMessages`, `classifyQuery`,
`buildChatSystemPrompt`, `getOrCreateChatSession`, `tryParseJson`, `validateExtractionSchema`,
`loadCustomTerms`, `countTokens`) — all are trivial, self-evident one-liners with their behavior fully
described in an adjacent comment/prose, none rise to the `supabaseServer`-style security-relevant ambiguity
that warranted flagging in round 6; (b) the `openai_usage_log` RLS section comment in `supabase-schema.sql`
("all writes are service-role / server-side via usageLogger.ts using the user's authenticated session") is
awkwardly worded but not actually wrong — the INSERT RLS policy right below it correctly matches
`usageLogger.ts`'s actual session-bound `supabaseServer` write, and "service-role" correctly describes the
separate read path used by `cost-monitor.ts`'s admin client; judged as a documentation nit, not a functional
gap, so not flagged; (c) no recurrence of the round-5/7 prose-vs-code edge-case-table mismatch pattern found
in any file; (d) full PRD + engineering-doc requirement checklist (every FR, US, table/column, API route,
edge case, acceptance criterion) re-verified with no gaps found.

Related: [[contractiq-file-locations]], [[contractiq-gap-patterns]]
