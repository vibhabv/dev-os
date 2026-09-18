# 18 — Testing, Offline AI Evaluation & Accessibility Strategy

Implements PRD Section 10 (Evaluation Strategy), Section 11 (HHH/launch criteria); engineering doc Section 13.

## Test layers & tooling

| Layer | Scope | Framework | Location |
|---|---|---|---|
| Unit | `lib/pdf/validate.ts`, `lib/pdf/extractText.ts` (mocked), token counting, `lib/rate-limit/checkLimit.ts` windowing logic, `lib/openai/usageLogger.ts` cost math, error-envelope mapping, prompt-assembly string builders | Jest + `ts-jest` | `tests/unit/` — mirrors `lib/**` structure, `*.test.ts` suffix |
| Integration | Every Route Handler in `docs/specs/03` through `docs/specs/14` against a local Supabase test project (`supabase` CLI + Docker): happy path + auth-failure for each; RLS cross-user access tests (two test accounts, attempt to read/update/delete each other's `contracts`/`key_terms`/`chat_messages` rows and assert failure) | Jest + Route Handler invocation + Supabase test client | `tests/integration/` |
| End-to-end | Sign up → upload → process → view results → edit term → chat → feedback; sign in → dashboard → delete contract; full account deletion | Playwright | `tests/e2e/` |
| Offline AI evaluation | Extraction F1/precision/recall (30 NDA + 20 MSA labelled set or CUAD fallback), page-number accuracy, custom-term F1, chat groundedness (50 Q&A pairs), calibration curve | Custom harness calling the same `lib/openai/extraction.ts`/`chat.ts` used in production | `tests/eval/` |
| Accessibility | WCAG 2.1 AA automated checks | `jest-axe` (unit) + Playwright + `axe-core` (E2E) | Zero critical/serious violations on `/`, `/dashboard`, `/contracts/new`, `/contracts/[id]` |
| Load/concurrency | 100 concurrent `/process` calls without P95 latency exceeding 30s | k6 or Artillery, run against staging | `tests/load/` |
| PDF rendering compatibility | Manual/scripted check of `PdfViewer` against 50 real-world contracts sourced during Beta | Manual QA checklist + Playwright visual-regression snapshots | `tests/e2e/pdf-render.spec.ts` + manual checklist doc |

## Offline eval harness (`tests/eval/`)

- Reads fixture contracts + ground-truth labels (`Contract_ID | Contract_Type | Term_Name | Expected_Value | Expected_Page`) from a local fixtures directory (`tests/eval/fixtures/`), populated from the 30 NDA + 20 MSA legal-SME-labelled set (or the CUAD dataset as the documented conditional fallback, `docs/specs/02-beta-access-and-launch-gates.md`).
- Calls `lib/openai/extraction.ts` (the same production code path) for each fixture and computes per-term F1 (exact-match on `value` after normalization), and separately, **page-attribution accuracy**: the percentage of terms whose returned `page_number` exactly matches the fixture's ground-truth `Expected_Page`. Both are computed from the same extraction run, not separate passes.
- `tests/eval/calibration.ts` buckets `confidence_score` into 10%-wide bins and compares each bin's average confidence to the observed `is_edited`-derived accuracy proxy; flags if any bucket's error exceeds the configured threshold (0.10 at Public Launch, per `docs/specs/02-beta-access-and-launch-gates.md`).
- `tests/eval/gate.ts` exposes the `--gate=<stage>` CLI entrypoint used by CI (`docs/specs/02-beta-access-and-launch-gates.md`).
- Runs on every deploy (CI gate, `public` profile blocking by default) per PRD's "automated regression suite runs on every deploy."

## Chat hallucination regression test

`tests/integration/chat-hallucination.test.ts`: feeds a fixture contract + a question about a topic verifiably absent from it (e.g. asking about a governing-law jurisdiction not mentioned anywhere in the fixture), calls the production chat route, and asserts the response contains the exact string "I cannot find this in the document." Target: ≤5% hallucinated responses across the full 50 Q&A eval set (`tests/eval/chat-groundedness.ts`, expert-scored Grounded/Hallucinated/Not-found).

## Fairness monitoring test hooks

- Monthly SME audit segments its 5-contract sample by `key_terms.value WHERE term_name IN ('Governing Law', 'Jurisdiction')` — implemented as a reporting query, not an automated test (`docs/specs/13-rate-limiting-and-cost-control.md` `quality-monitor.ts` handles the weekly aggregate; the monthly SME audit itself is a manual process external to the codebase).
- Industry segmentation is a known MVP limitation (no `industry` field exists on `contracts` or `auth.users` — deferred to the v1.2 `workspace_id` addition).

## RLS test suite (CI-blocking)

`tests/integration/rls.test.ts` — for every table in `docs/specs/supabase-schema.sql`, using two distinct authenticated Supabase test clients (User A, User B):
1. User A creates a row (contract, key term, chat message, feedback, etc.).
2. User B attempts `SELECT`/`UPDATE`/`DELETE` on that row and asserts it fails (returns zero rows or a permission error, per Postgres RLS semantics — RLS makes non-matching rows invisible rather than raising an explicit error for `SELECT`, so assertions check for empty result sets).
3. Runs in CI on every PR touching `docs/specs/supabase-schema.sql` — merge-blocking.

**Storage bucket cross-user access (`storage.objects`, same file, same CI gate):** in addition to the table-level checks above, this suite also covers the `contracts` Storage bucket's three RLS policies (`docs/specs/supabase-schema.sql`):
4. User A uploads a file to `contracts/{userA.id}/{contractId}/file.pdf`.
5. User B's client attempts (a) `createSignedUrl()` on that exact path, (b) `storage.from('contracts').download()` on that path, and (c) `storage.from('contracts').remove([path])` — all three must fail (either an explicit Storage permission error or an empty/null result, matching Supabase Storage's RLS-on-`storage.objects` semantics), proving the `auth.uid()::text = (storage.foldername(name))[1]` policy holds for cross-user access exactly as it does for the DB tables above.
6. This Storage sub-suite runs under the same CI trigger as the table-level RLS tests (any PR touching `docs/specs/supabase-schema.sql`) — merge-blocking.

## CI pipeline gates

- Unit + integration + RLS tests: block merge to `main` on failure.
- E2E + offline eval: run on every deploy to staging before promotion to production.
- Offline eval additionally supports the staged `--gate` profiles (`docs/specs/02-beta-access-and-launch-gates.md`), which include **page-attribution accuracy ≥92%** as a blocking condition at the `public` profile (engineering doc Section 8: "a release cannot promote to production if F1 falls below 88% (NDA) / 85% (MSA) or page-attribution accuracy falls below 92%") — `tests/eval/gate.ts` fails the same way for a page-accuracy miss as it does for an F1 miss, not just a warning.

## Coverage targets

- `lib/**`: ≥80% line coverage (unit tests).
- 100% of API endpoints listed across `docs/specs/03` – `docs/specs/17` have at least one happy-path and one auth-failure integration test.
- All 4 PRD user flows (sign-up→dashboard, returning-user→dashboard, core review, chat) covered by at least one passing E2E spec before each release.

## Non-engineering deliverables referenced by this section (tracked, not built in codebase)

- **Public trust page** (benchmarks published post-launch): sourced directly from `tests/eval/` output (F1, page-attribution accuracy, calibration error) — no new data pipeline needed when built.
- **Evaluation spreadsheet** (`Contract_ID | Contract_Type | Term_Name | Expected_Value | AI_Extracted_Value | Expected_Page | AI_Page | Confidence_Score | F1_Match | Expert_Rating | Notes`): populated from `contracts`, `key_terms`, the labelled ground-truth fixtures, `tests/eval/` scoring output, and the monthly SME audit — a reporting/export task, not an application feature.
