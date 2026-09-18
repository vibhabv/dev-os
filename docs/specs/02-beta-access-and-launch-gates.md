# 02 — Beta Access & Staged Launch Quality Gates

Implements PRD Section 11 Launch Criteria (Internal Alpha → Measurement Beta ≤50 users → Public Launch); engineering doc Section 6/7 (`beta_access`), Section 13 (staged gates).

## `beta_access` table & gating mechanism

See `docs/specs/01-auth-and-session.md` for the exact insertion logic in `app/auth/callback/route.ts` and the enforcement check in `middleware.ts`. This file covers the waitlist UI and the CI eval-gate side.

## `app/beta-waitlist/page.tsx`

Static Server Component, no data fetching:

```tsx
export default function BetaWaitlistPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center max-w-md">
        <h1>You're on the list!</h1>
        <p>ContractIQ's Measurement Beta is currently full. We'll email you at your registered address when a spot opens up.</p>
      </div>
    </main>
  );
}
```

Only reachable while `BETA_MODE_ENABLED=true`; if a verified, non-beta user navigates here directly while the flag is `false`, `middleware.ts` does not redirect away (the route itself has no gating logic to enter it) — this is acceptable since the page displays a true statement only in the state it's shown in, and once `BETA_MODE_ENABLED=false` no user is ever redirected into it in the first place.

## Environment flag contract

`BETA_MODE_ENABLED` (server-only, read by `app/auth/callback/route.ts` and `middleware.ts`) and its effect:

| Value | Stage | Effect |
|---|---|---|
| `true` | Measurement Beta | New sign-ups capped at 50 via `beta_access`; users without a row redirected to `/beta-waitlist` |
| `false` | Internal Alpha (pre-Beta) or Public Launch (post-Beta) | No gating — every verified user reaches `/dashboard` |

This is a manually-toggled deployment environment variable, not a database-driven flag — flipping stages requires a redeploy with the new value.

## CI staged eval gate

`tests/eval/` supports a `--gate=<stage>` CLI flag (`internal`, `beta`, `public`) selecting the threshold profile below (from PRD Section 11 / engineering doc Section 13, table verbatim):

| Stage | F1 (NDA/MSA) | Page-attribution accuracy | Latency P95 | Correction rate | Calibration error | Satisfaction ("Yes") | CI behavior |
|---|---|---|---|---|---|---|---|
| `internal` | not gated | not gated | not gated | not gated | not gated | not gated | `tests/e2e/` smoke suite only; manual QA sign-off required, not automated |
| `beta` | ≥82% / ≥82% | not gated | ≤45s | ≤20% | not gated | ≥75% | Non-blocking warning below `public` thresholds; blocking below `beta` thresholds |
| `public` | ≥88% / ≥85% | ≥92% | ≤30s | ≤12% | ≤0.10 | ≥80% | Blocking — this is the default profile enforced on every merge to `main` post-Beta |

**Page-attribution accuracy** (percentage of terms whose returned `page_number` matches the ground-truth page) is a blocking `public`-profile gate per engineering doc Section 8 ("Post-launch AI monitoring cadence," Every-deploy bullet: "a release cannot promote to production if F1 falls below 88% (NDA) / 85% (MSA) or page-attribution accuracy falls below 92%") and PRD Section 10's evaluation target (≥92% correct page attribution, every release). It is not gated at `internal` or `beta` — neither the engineering doc's staged-gate table nor the PRD's Beta go-criteria mention it at those stages, only F1/latency/correction-rate/satisfaction are. `tests/eval/gate.ts` (below) computes it from the same fixture-contract run used for F1 scoring, comparing each extracted `key_terms.page_number` to the ground-truth `Expected_Page` column (`docs/specs/18-testing-and-eval-strategy.md`).

Implementation: `tests/eval/gate.ts` reads `process.env.EVAL_GATE ?? 'public'` (or a `--gate` CLI arg passed by the CI workflow), runs the harness described in `docs/specs/18-testing-and-eval-strategy.md`, and exits non-zero if any metric in the selected profile's row is below threshold. The `public` profile is used whenever CI does not explicitly pass `--gate=beta` or `--gate=internal` — i.e. it is the fail-safe default once the project is out of the Beta stage.

## Non-code go-criteria (manual sign-off checklist, tracked outside the codebase)

These are explicitly called out in the engineering doc as non-engineering gates and are not automatable; they belong in a release checklist (e.g. a pinned issue or the ops runbook), not in code:

- **Internal Alpha:** core upload→extract→display flow works end-to-end without crashes (manual QA); source sentences shown; disclaimer present.
- **Measurement Beta:** "0 incidents of misleading output without confidence warning" — verified by manual QA review of support/feedback reports tagged as a confidence-warning miss.
- **Public Launch:** security audit passed (Stage 7 of the project workflow, `/security-foundation`); RLS cross-user test suite green (`docs/specs/18-testing-and-eval-strategy.md`); legal disclaimer approved; ToS/DPA legal review complete; OpenAI DPA executed; Supabase Pro plan provisioned.

## Edge cases

| Case | Behavior |
|---|---|
| CI eval run has no labelled ground-truth set available (legal SME unavailable, PRD Assumption 6) | Harness falls back to the public CUAD dataset as sole ground truth for the same gate — this is a conditional fallback, not a second dataset. `tests/eval/gate.ts` logs a `WARN: using CUAD fallback dataset` line so the reduced-confidence run is visible in CI output |
| A release needs to ship with the `beta` gate temporarily even though `BETA_MODE_ENABLED` was already flipped to `false` | Not supported — the CI gate and the `BETA_MODE_ENABLED` runtime flag are governed by the same release-stage decision and must be changed together as part of the same deploy; this spec does not decouple them |
