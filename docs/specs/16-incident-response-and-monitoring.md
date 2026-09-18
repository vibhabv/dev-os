# 16 — Monitoring, Incident Response & Customer Communication

Implements PRD Section 5 (99.5% uptime SLA), Section 11 (system health monitoring, customer communication plan); engineering doc Section 6.

## `GET /api/health`

Unauthenticated, no `withApiAuth` wrapper. Pinged by Uptime Robot every 5 minutes.

```ts
export async function GET() {
  try {
    const supabase = createServerClient(/* no cookies needed */);
    const { error } = await supabase.from('contracts').select('id', { count: 'exact', head: true }).limit(1);
    if (error) return NextResponse.json({ status: 'degraded' }, { status: 503 });
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch {
    return NextResponse.json({ status: 'degraded' }, { status: 503 });
  }
}
```

This route uses the anon key (RLS still applies, but a `head: true` count query against `contracts` with no session succeeds trivially — RLS returns zero rows, not an error, for an unauthenticated request, which is sufficient to prove DB connectivity). Not part of the application's functional surface — excluded from `withApiAuth` and from the standardized error envelope contract (`docs/specs/00-overview-and-conventions.md`) since it must remain reachable without a session.

## Uptime Robot configuration (external, non-code)

- Monitor 1: `GET {NEXT_PUBLIC_APP_URL}/` — expects `200`.
- Monitor 2: `GET {NEXT_PUBLIC_APP_URL}/api/health` — expects `200`.
- Both polled every 5 minutes; alerts posted to the team Slack channel on failure (configured directly in the Uptime Robot dashboard, not in application code).

## Incident banner

`app/layout.tsx` reads `NEXT_PUBLIC_INCIDENT_BANNER` (client-exposed env var) at build/runtime:

```tsx
export default function RootLayout({ children }: { children: ReactNode }) {
  const bannerMessage = process.env.NEXT_PUBLIC_INCIDENT_BANNER;
  return (
    <html lang="en">
      <body>
        {bannerMessage && <IncidentBanner message={bannerMessage} statusPageUrl={process.env.NEXT_PUBLIC_STATUS_PAGE_URL} />}
        {children}
      </body>
    </html>
  );
}
```

Toggling the banner requires setting `NEXT_PUBLIC_INCIDENT_BANNER` in the Netlify environment variables UI and triggering a redeploy — this is a manual, on-call-engineer-driven action per the runbook below, not a database-driven or self-service toggle.

## Incident classes & SLA timers (manual runbook, executed by the on-call engineer)

| Class | Definition | Status page (Instatus) | In-app banner | Affected-user email |
|---|---|---|---|---|
| **P0** | Data exposure or complete outage | Updated within 30 minutes | Shown immediately (`NEXT_PUBLIC_INCIDENT_BANNER` set + redeploy) | Sent within 1 hour via `lib/email/sendIncidentEmail.ts` |
| **P1** | Degraded performance (elevated latency, partial feature outage) | No mandatory update | Shown within 2 hours | Not required |

## `lib/email/sendIncidentEmail.ts`

```ts
export async function sendIncidentEmail(recipients: string[], details: { summary: string; startedAt: string }) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: recipients,
    subject: 'ContractIQ Service Incident Notice',
    html: renderIncidentEmailTemplate(details),
  });
}
```

`lib/email/templates/incidentNotice.ts` exports `renderIncidentEmailTemplate(details)`, a pre-drafted HTML template with placeholders for `summary` and `startedAt`. This is invoked manually by the on-call engineer (e.g. via a one-off script or an internal admin action) after identifying affected `user_id`s by querying Supabase/Netlify audit logs for a data-exposure P0 — or all users if scope is unclear. There is no automated trigger; this is intentionally a human-in-the-loop runbook step, not a monitoring-to-notification pipeline, matching the PRD's "manual/runbook-driven at MVP scale" architecture.

## Application & infrastructure logs

- Netlify Function invocation logs — available per-request, per-endpoint, in the Netlify dashboard, for all Route Handlers and scheduled functions. No custom logging pipeline is built for MVP; `console.error`/`console.log` calls in Route Handlers and scheduled functions are the extent of structured logging.
- Supabase dashboard — DB CPU/connections, Storage usage, viewed directly by the team, not surfaced in-app.
- OpenAI usage dashboard — cross-referenced manually against `openai_usage_log` (`docs/specs/13-rate-limiting-and-cost-control.md`) for anomaly detection.

## Edge cases

| Case | Behavior |
|---|---|
| `GET /api/health` called while Supabase is fully down | The `select()` call throws or times out → caught by the `try/catch` → `503 { status: 'degraded' }` |
| Incident banner env var set but the deploy hasn't picked it up yet (env var changes require a redeploy on most Netlify configurations) | Banner does not appear until the redeploy completes — this is a known operational lag inherent to using a build-time env var rather than a runtime DB flag; acceptable per the PRD's "manual, runbook-driven" incident response model |
| P0 incident where the affected-user set is genuinely ambiguous | Runbook default is "email all users" rather than attempting an uncertain scoped query — favors over-notification over under-notification for a data-exposure event |
