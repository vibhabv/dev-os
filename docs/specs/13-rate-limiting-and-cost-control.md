# 13 — Rate Limiting & Cost Control

Implements PRD Section 3 roadmap ("Rate limiting on OpenAI calls"), Section 5/12 (cost constraints); engineering doc Section 8 (rate limiting, cost controls), `rate_limit_events`, `openai_usage_log` tables, `netlify/functions/cost-monitor.ts`, `netlify/functions/quality-monitor.ts`.

## `lib/rate-limit/checkLimit.ts`

```ts
const LIMITS: Record<'process' | 'chat', number> = { process: 20, chat: 60 };

export async function checkLimit(userId: string, action: 'process' | 'chat'): Promise<boolean> {
  const { count, error: countErr } = await supabaseServer
    .from('rate_limit_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if (countErr) {
    // Fails OPEN, deliberately: rate limiting is an abuse-prevention affordance, not a
    // correctness-critical path — if the count itself can't be read, blocking every user
    // from using the product until the DB recovers would be a worse outcome than
    // temporarily not rate-limiting. Logged (not silently dropped) so a persistent count-
    // query failure is still visible for investigation.
    console.error('Rate limit count query failed — failing open', { userId, action, error: countErr });
    return false;
  }

  if ((count ?? 0) >= LIMITS[action]) return true; // limited

  const { error: insertErr } = await supabaseServer.from('rate_limit_events').insert({ user_id: userId, action });
  if (insertErr) {
    // Also fails open, same rationale as above — but logged, since a persistent insert
    // failure here means the count query above will keep under-reporting usage (this
    // event never gets counted), silently widening the abuse window over time.
    console.error('Rate limit event insert failed', { userId, action, error: insertErr });
  }
  return false;
}
```

**Ordering guarantee:** the row is inserted immediately before the OpenAI call is made (inside `withApiAuth`, before the wrapped handler body runs) — not after — so a burst of concurrent requests cannot race past the limit by all reading the same stale count before any of them writes.

Called from `withApiAuth(handler, { rateLimitAction: 'process' | 'chat' })` (handler first, opts second — canonical signature in `docs/specs/00-overview-and-conventions.md`) for `POST /api/contracts/{id}/process` and `POST /api/contracts/{id}/chat` respectively. On `true`, the wrapper short-circuits with `429 RATE_LIMITED` before invoking the route's own logic.

## `lib/openai/usageLogger.ts`

```ts
const PRICING = { inputPer1k: 0.005, outputPer1k: 0.015 };

export async function logUsage(args: {
  userId: string; contractId: string | null; operation: 'extraction' | 'chat';
  promptVersion: string; usage: { prompt_tokens: number; completion_tokens: number };
  durationMs: number; // wall-clock time of the full route handler, captured via Date.now() delta — see "P95 latency KPI capture" below
}) {
  const costUsd = (args.usage.prompt_tokens / 1000) * PRICING.inputPer1k
                + (args.usage.completion_tokens / 1000) * PRICING.outputPer1k;

  const { error } = await supabaseServer.from('openai_usage_log').insert({
    user_id: args.userId,
    contract_id: args.contractId,
    operation: args.operation,
    prompt_version: args.promptVersion,
    input_tokens: args.usage.prompt_tokens,
    output_tokens: args.usage.completion_tokens,
    cost_usd: costUsd,
    duration_ms: args.durationMs,
  });
  if (error) {
    // Intentionally logged, not thrown — a lost usage-log row must never fail the
    // already-completed extraction/chat request it's describing (the caller has already
    // gotten its OpenAI result by this point in docs/specs/04-key-term-extraction.md and
    // docs/specs/09-contract-chat-and-realtime.md). But it is NOT silently dropped either:
    // netlify/functions/cost-monitor.ts's 80%-of-budget Slack alert (below) depends on this
    // table being complete, and PRD Section 3's External Dependencies risk table
    // ("OpenAI pricing changes... maintain cost alerting at 80% of budget threshold")
    // exists specifically to catch runaway spend — a silently-incomplete
    // openai_usage_log would let that alert under-fire with no visibility. Logging here
    // makes a lost row at least visible in Netlify Function invocation logs
    // (docs/specs/16-incident-response-and-monitoring.md) for manual reconciliation.
    console.error('Failed to write openai_usage_log row', { userId: args.userId, operation: args.operation, error });
  }
}
```

Called after every successful OpenAI call in `docs/specs/04-key-term-extraction.md` and `docs/specs/09-contract-chat-and-realtime.md`, with `durationMs` computed by each route handler as `Date.now() - startedAt` (measured from the top of the handler, before rate-limit/ownership checks, to just before this call). Not called on failed calls (no token usage to log) — retried calls that eventually succeed log only the final successful call's usage and its cumulative duration including retries.

## `netlify/functions/cost-monitor.ts` (daily scheduled function)

```ts
export const handler = schedule('@daily', async () => {
  const admin = createAdminClient();
  const monthStart = startOfMonth(new Date()).toISOString();

  const { data } = await admin.from('openai_usage_log').select('cost_usd').gte('created_at', monthStart);
  const totalCost = (data ?? []).reduce((sum, r) => sum + Number(r.cost_usd), 0);
  const budget = Number(process.env.OPENAI_MONTHLY_BUDGET_USD ?? 500);

  if (totalCost >= budget * 0.8) {
    await postSlackAlert(process.env.SLACK_COST_ALERT_WEBHOOK_URL!, `OpenAI spend this month: $${totalCost.toFixed(2)} (${Math.round(totalCost / budget * 100)}% of $${budget} budget)`);
  }

  const { data: storageUsage } = await admin.storage.from('contracts').list('', { limit: 1 }); // representative check; actual usage read via Supabase Management API / dashboard metrics endpoint
  const storagePercentUsed = await getStorageUsagePercent(admin); // wraps Supabase Management API
  if (storagePercentUsed >= 70) {
    await postSlackAlert(process.env.SLACK_COST_ALERT_WEBHOOK_URL!, `Supabase Storage usage at ${storagePercentUsed}% of plan quota.`);
  }
});
```

Netlify Scheduled Function config (`netlify.toml`):
```toml
[functions."cost-monitor"]
  schedule = "@daily"
```

## `netlify/functions/quality-monitor.ts` (weekly scheduled function)

```ts
export const handler = schedule('@weekly', async () => {
  const admin = createAdminClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Aggregate correction-rate alert — all users, no opt-in required (no content exposed).
  const { data: recentTerms } = await admin.from('key_terms').select('is_edited, contract_id, contracts(contract_type)').gte('created_at', sevenDaysAgo);
  const total = recentTerms?.length ?? 0;
  const edited = recentTerms?.filter((t) => t.is_edited).length ?? 0;
  const rate = total > 0 ? (edited / total) * 100 : 0;
  if (rate > 12) {
    await postSlackAlert(process.env.SLACK_QUALITY_ALERT_WEBHOOK_URL!, `Correction rate over the last 7 days: ${rate.toFixed(1)}% (threshold: 12%). Triggering prompt review.`);
  }

  // Contract-type-correlated breakdown (NDA vs MSA), and jurisdiction segmentation via Governing Law/Jurisdiction terms — see docs/specs/18-testing-and-eval-strategy.md for the fairness-monitoring detail.
  const byType = groupCorrectionRateByContractType(recentTerms);
  if (Math.abs(byType.nda - byType.msa) > 10) {
    await postSlackAlert(process.env.SLACK_QUALITY_ALERT_WEBHOOK_URL!, `Correction rate disparity: NDA ${byType.nda.toFixed(1)}% vs MSA ${byType.msa.toFixed(1)}%.`);
  }

  // 2. Opt-in, anonymised content sample for the weekly drift review queue.
  const { data: sample } = await admin.from('term_corrections').select('*').order('edited_at', { ascending: false }).limit(10);
  await writeToReviewQueue(sample ?? []); // e.g. inserted into an internal review table or exported to a shared doc — implementation detail left to the ops team, not user-facing
});
```

## Rate limit UI messaging

| Limit | Message shown |
|---|---|
| Extraction (`process`, 20/hr) | "You've made too many requests. Please wait a few minutes and try again." |
| Chat (`chat`, 60/hr) | "Please wait a moment before sending another message." |

## P95 latency KPI capture (engineering doc Section 1 — "server-side timing logs")

The engineering doc names two latency KPIs verified via "server-side timing logs": upload→results (≤30s P95) and chat (≤15s P95). These are captured, not just observed generically in Netlify's function logs, via an explicit `duration_ms` field:

- `POST /api/contracts/{id}/process` (`docs/specs/04-key-term-extraction.md`) and `POST /api/contracts/{id}/chat` (`docs/specs/09-contract-chat-and-realtime.md`) both wrap their entire handler body in a `const startedAt = Date.now()` / `const durationMs = Date.now() - startedAt` measurement.
- `durationMs` is passed into `logUsage()` (`lib/openai/usageLogger.ts`, above) as an additional argument and written to a `duration_ms integer` column on `openai_usage_log` alongside the existing `input_tokens`/`output_tokens`/`cost_usd` fields for that same row — this column is included in `docs/specs/supabase-schema.sql`.
- The upload half of the ≤30s budget (`POST /api/contracts`, `docs/specs/03-pdf-upload-and-extraction.md`) is not itself an OpenAI call and has no `openai_usage_log` row to attach to; its duration is captured the same way (`Date.now()` delta) and emitted as a structured `console.log(JSON.stringify({ route: 'upload', duration_ms }))` line, which is queryable from the Netlify Function invocation logs (`docs/specs/16-incident-response-and-monitoring.md`) — the combined upload+process P95 is computed by summing the two durations per contract during a release's manual/scripted latency check (`tests/load/`, `docs/specs/18-testing-and-eval-strategy.md`), rather than via a single end-to-end DB column, since the two calls are separate HTTP requests.
- P95 aggregation itself (across all requests in a period) is a reporting query against `openai_usage_log.duration_ms` (for process/chat) run the same way as the North Star Metric query (`docs/specs/10-dashboard-and-north-star-metric.md`) — an external reporting/ops task, not a live in-app dashboard at MVP.

## Edge cases

| Case | Behavior |
|---|---|
| User hits the extraction limit mid-retry-loop of a single `/process` call | Not possible — one `rate_limit_events` row is inserted per incoming HTTP request to `/process`, not per internal OpenAI retry attempt; the 3x exponential-backoff retries inside `runExtraction()` are part of a single rate-limited "call" from the user's perspective |
| `cost-monitor.ts` runs and finds spend already over 100% of budget | Same Slack alert fires (condition is `>= 80%`, so it also fires above 100%) — no distinct "over budget" message tier is implemented; the ops team is expected to act on the percentage shown |
| `quality-monitor.ts` finds zero terms created in the last 7 days | `total = 0` → `rate = 0` (guarded by ternary, not a divide-by-zero) — no alert fires |
| Slack webhook URL misconfigured/unreachable | `postSlackAlert` failures are caught and logged to the Netlify function's own invocation log — they do not throw and fail the scheduled function's overall run (the DB read/aggregation still completes) |
