---
name: contractiq-gap-patterns
description: Recurring class of defect found late in the ContractIQ spec review loop — useful for sharpening future audit passes on this and similar spec sets.
metadata:
  type: feedback
---

As the ContractIQ `docs/specs/` review loop has matured (round 4 → round 5), the remaining defects have shifted
from "missing/undefined shared helper" and "response schema field omitted" (structural gaps, round 4) toward a
subtler class: **prose in an edge-case table asserting a behavior that the file's own code sample, shown just
above it, does not actually implement.** This project's spec files are unusually code-heavy (most behavior is
shown as literal TypeScript/SQL, not just described), which makes this specific contradiction pattern both easy
to introduce (an edge-case row gets added/edited without updating the corresponding code block) and easy to catch
if you deliberately cross-check every edge-case-table row against the actual code shown earlier in the same file,
not just against the PRD/engineering doc.

**Why this matters:** In a spec set this detailed, "the prose says X happens" is not sufficient — the standard
this project has implicitly set (via round 4's fixes, e.g. formally defining `loadContractOwnedBy()`) is that
every claimed behavior must be traceable to concrete, shown code, not just asserted. Treat any edge-case-table
row that references a hook/function/component not visibly wired into the code shown in that same section as a
candidate gap, even if the row's *intent* is reasonable and clearly derived from a real PRD/eng-doc requirement.

**How to apply:** When auditing this project (or similarly code-heavy spec sets) in future rounds, do a dedicated
pass per file: for every row in every "Edge cases" table, check whether the described mechanism appears in a code
block in that file. If not, check whether it's wired in a *different* file (acceptable) or nowhere (flag it).
Don't stop at "does this map to a PRD requirement" — also check "is this concretely implemented as described."

**Round 6 addendum — a second, related defect class:** once the edge-case-table-vs-code-block check stopped
turning up new issues (round 6), the next layer down was **shared symbols used across many call sites but never
formally defined anywhere**, the same category round 4 caught for `loadContractOwnedBy()`. `docs/specs/00-overview-and-conventions.md`
is this project's designated place for that (it already formalizes `jsonError()`, `withApiAuth()`,
`loadContractOwnedBy()` with exact code) — so the check is: grep every spec file for bare function/symbol calls
that read like shared infra (e.g. `supabaseServer`, `getOrCreateChatSession`, `loadMessages`), then check whether
00-overview (or any file) actually shows that symbol's definition. Prioritize ones where the *undefined-ness*
creates real ambiguity about behavior (e.g. `supabaseServer`, used in 5+ files for every backend DB write, with
no shown definition of whether it's a per-request RLS-respecting client or a service-role/singleton one —
security-relevant, not just a naming nicety) over ones that are trivial/self-evident one-liners (e.g.
`loadMessages(sessionId)` — an obvious `SELECT ... ORDER BY created_at ASC LIMIT 200`, not worth flagging on its
own). Also worth a pass: within a single route handler, check that *every* Supabase write's `error` result is
actually branched on (not just a substring-matched subset of possible errors) — round 6 found `POST .../chat`
narrowly checking `insertErr?.message.includes('Maximum 200 chat messages')` on the user-message insert and
silently swallowing any other insert error, inconsistent with the generic `if (insertErr || !data)` pattern used
for equivalent inserts elsewhere in the same project (03, 04).

**Round 7 addendum — fixes for this pattern tend to be local, not systemic.** When the planner fixes one flagged
unchecked-write instance (round 6: the chat route's *user*-message insert), always re-check every OTHER write in
that SAME function and in structurally similar functions elsewhere — the fix is easy to apply narrowly to just
the flagged line and miss siblings. Round 7 found: (a) the *assistant*-message insert a few lines below the
just-fixed user-message insert in the same `POST /api/contracts/{id}/chat` handler (`09`) was still unchecked;
(b) the final `status: 'completed'` update in `POST /api/contracts/{id}/process` (`04`), sitting immediately
below a correctly-checked `key_terms` insert in the same function, was also unchecked, with an especially bad
consequence — an unchecked `contracts` status update can cause the response returned to the client (hardcoded
`status: 'completed'` in the JSON body) to diverge from the actual DB row, silently stranding a contract that
can never be retried since the route's own precondition only accepts `'uploaded'`/`'error'`. Concretely: whenever
you find ONE unchecked/inconsistently-checked write in a function, grep that entire function body for every other
`.insert(`/`.update(`/`.delete(` call and check each one individually — don't assume a fix that targeted one call
site was applied file-wide or pattern-wide.

**Round 8 addendum — the unchecked-write pattern migrated from Route Handlers to direct-Supabase-client React
hooks.** Once every `supabaseServer` (Route Handler) write in the project had been checked-or-explained (rounds
6–7), round 8 found the same defect class one layer down: `useMutation`/`mutationFn` bodies and async functions
inside `hooks/use*.ts` files that call `supabase.from(...).insert/update/upsert(...)` directly from the browser.
Two flavors found: (a) a hook (`useChatSession.ts`) that never destructures `error` at all, then non-null-asserts
a value that can be null on failure — throws inside an unawaited async IIFE, silently hanging the feature; (b) a
`mutationFn` (`useUserSettings.ts`) that returns the raw `{ data, error }` response instead of checking `error` and
throwing — since Supabase-js resolves rather than rejects on a DB error, TanStack Query treats this as success,
so a documented "Saved" UI confirmation fires even on failure. The tell for (b): compare against a `queryFn` in the
same project that correctly does `if (error) throw error;` — a `mutationFn` that skips this same check right next
to a `queryFn` that has it is the inconsistency to look for. **How to apply going forward:** grep every
`hooks/use*.ts` file's async bodies and every `useMutation`/`mutationFn` block specifically (not just Route
Handlers) for `.insert(`/`.update(`/`.upsert(`/`.delete(` calls, and verify each one both checks `error` and that
the check actually gates the UI's success/failure messaging shown in that file's prose.

**Round 9 addendum — the unchecked-write pattern migrated a third time, to plain one-off component handlers and
small `lib/` helpers not wrapped in any hook/mutation abstraction at all.** After Route Handlers (rounds 6–7) and
`hooks/use*.ts`/`mutationFn` bodies (round 8) were cleaned up, round 9's project-wide grep of every
`.insert(`/`.update(`/`.upsert(`/`.delete(` call site across all 20 spec files found the same defect class one
layer further out: a plain inline event-handler function inside a spec's prose (`docs/specs/11`'s feedback-submit
handler — destructures `error`, never checks it, directly contradicting the file's own next-sentence prose about
an unconditional success message) and a small `lib/` helper called from within a Route Handler but not itself part
of the handler body shown in that route's own spec file (`docs/specs/13`'s `logUsage()` — doesn't even destructure
`error`, let alone check it). A third flavor: a write that DOES check `error` correctly (gating what state is set)
but takes no action in the failure branch at all — no toast, no inline message — inconsistent with every sibling
write of the same shape elsewhere in the project (`docs/specs/10`'s `markComplete()`, compared against `06`'s
custom-term insert, `08`'s term edit, and `12`'s privacy toggle, all of which show an explicit "Could not
save/add..." message on failure). **Escalating rule for future rounds:** the project-wide grep for
`.insert(`/`.update(`/`.upsert(`/`.delete(` across every spec file (not scoped to any one call-site category) is
now the standing first step of every round, since this defect class has now appeared in four different structural
locations (Route Handlers → hooks/mutationFn → plain component handlers → lib/ helpers) across four consecutive
rounds (6, 7, 8, 9) and shows no sign of being fully exhausted — do not assume a prior round's fix scope was
exhaustive just because it targeted the category that round's audit method surfaced.

Related: [[contractiq-review-history]]
