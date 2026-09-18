# 10 — Dashboard, History & North Star Metric Tracking

Implements PRD US-008, FR-10; PRD Section 3 North Star Metric; engineering doc Flow 1 step 5, Flow 2, Flow 3 step 11, Section 7 (North Star query).

## `app/dashboard/page.tsx` (React Server Component)

Fetches on the server using the request's session:

```ts
const { count: totalCount } = await supabase.from('contracts').select('*', { count: 'exact', head: true });
const { count: ndaCount } = await supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('contract_type', 'nda');
const { count: msaCount } = await supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('contract_type', 'msa');
const { data: recent } = await supabase.from('contracts').select('*').order('created_at', { ascending: false }).limit(5);
```

RLS scopes every query to `auth.uid() = user_id` automatically — no explicit `.eq('user_id', ...)` filter is required (though harmless to add for readability), since the schema's `contracts_select_own` policy is unconditional on the queried rows.

Renders:
- `components/dashboard/SummaryCard.tsx` — total contracts, NDA count, MSA count.
- Last-5 list with status + date (reuses `ContractTable` row rendering in a compact mode).
- Empty state (0 contracts): "No contracts reviewed yet — upload your first contract to begin" + "Review a Contract" CTA (Flow 1 step 5).
- Non-empty: "Review a Contract" CTA also prominently placed (Flow 2 step 2).

## `components/dashboard/ContractTable.tsx` (full history, client component)

Sortable by **date** (`created_at`), **name** (`filename`), **type** (`contract_type`) — FR-10. Re-sorting issues a new client-side query:

```ts
const { data } = await supabase
  .from('contracts')
  .select('*')
  .order(sortColumn, { ascending: sortDirection === 'asc' });
```

`sortColumn`/`sortDirection` are local component state (not persisted, not in the URL — reset on navigation away, matching the simplicity of the MVP scope). Clicking a column header toggles direction if already sorted by that column, else defaults to descending for `created_at` and ascending for `filename`/`contract_type`. Clicking any row navigates to `/contracts/{id}`.

## North Star Metric query (`docs/specs/supabase-schema.sql` reference, computed here for reporting, not rendered in-app UI at MVP)

```sql
SELECT
  COALESCE(
    reviewed_at,
    GREATEST(
      last_accessed_at,
      (SELECT MAX(edited_at) FROM key_terms WHERE contract_id = contracts.id),
      (SELECT MAX(cm.created_at) FROM chat_messages cm
         JOIN chat_sessions cs ON cs.id = cm.chat_session_id
         WHERE cs.contract_id = contracts.id)
    )
  ) - created_at AS time_to_review
FROM contracts;
```

This is an analytics/reporting query, run by an internal reporting job or ad hoc against the DB (e.g. via the Supabase SQL editor or a lightweight analytics script) — it is **not** exposed through any user-facing API route or UI component in the MVP, since no PRD acceptance criterion requires displaying this number to the end user. It backs the North Star row in the metrics dashboard the product team reviews (external to this codebase).

## `components/results/MarkReviewCompleteButton.tsx`

Visible only once `contract.status === 'completed'`. Direct Supabase client update (no Route Handler):

```ts
async function markComplete() {
  const { error } = await supabase.from('contracts').update({ reviewed_at: new Date().toISOString() }).eq('id', contractId);
  if (error) {
    showToast('Could not mark this reviewed. Please try again.'); // matches the failure-messaging convention used by every other direct-client mutation in this project (docs/specs/06, 08, 11, 12)
    return;
  }
  setLocalReviewed(true);
}
```

RLS: `contracts_update_own`. Once clicked, the button becomes a static "Reviewed ✓" badge (re-fetching `contract.reviewed_at !== null` confirms state on reload — the button does not toggle back). Clicking is optional; the fallback GREATEST() calculation above covers users who never click it. On failure, the button remains in its clickable "Mark Review Complete" state (not silently stuck) so the user can retry.

## "Contracts processed / active user / month" metric (PRD secondary metric)

```sql
SELECT user_id, date_trunc('month', created_at) AS month, count(*) AS contracts_processed
FROM contracts
GROUP BY user_id, date_trunc('month', created_at);
```

Not surfaced in any MVP UI (dashboard analytics charts are a v1.1 feature per engineering doc Section 10 Phase 2) — computable from MVP data via this query even before that UI ships, run the same way as the North Star query above (external reporting, not an app route).

## Edge cases

| Case | Behavior |
|---|---|
| User has 0 contracts | Dashboard empty state; `ContractTable` renders nothing (or a "No contracts yet" row) |
| User re-sorts by a column while a new contract is uploaded in another tab | The client-side query re-runs only on explicit user interaction (column click) — no live re-sort on background data changes, consistent with no Realtime subscription being specified for the `contracts` table in the engineering doc (Realtime is only wired for `chat_messages`) |
| `reviewed_at` already set, user clicks "Mark Review Complete" again | Not possible — the button is replaced by the static "Reviewed ✓" badge once `reviewed_at` is non-null; no re-click path exists |
| Contract has `status = 'error'` | Still appears in the dashboard history list with a visible "Error" status chip; clicking it opens the results page, which shows the retry UI from `docs/specs/04-key-term-extraction.md` rather than a terms panel |
