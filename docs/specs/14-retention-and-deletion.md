# 14 — Data Retention & Deletion

Implements PRD Section 5 (retention constraints, GDPR readiness); engineering doc Section 7 (retention semantics), `netlify/functions/retention-cleanup.ts`, `DELETE /api/contracts/{contractId}`. Account-level deletion is specified separately in `docs/specs/12-account-settings-and-privacy.md`.

## Retention semantics (Storage-only, 90 days post last-access)

Applies **only** to the Storage PDF binary, never to `contract_text`, `key_terms`, `chat_messages`, or `user_feedback` — those remain reviewable indefinitely via `TextViewerFallback` (`docs/specs/07-results-viewer.md`).

## `netlify/functions/retention-cleanup.ts` (daily scheduled function)

```ts
export const handler = schedule('@daily', async () => {
  const admin = createAdminClient(); // service-role, bypasses RLS
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: expired, error: selectErr } = await admin
    .from('contracts')
    .select('id, file_path')
    .not('file_path', 'is', null)
    .lt('last_accessed_at', cutoff);

  if (selectErr) {
    // Logged and the run ends here — nothing was purged this run, and every contract
    // remains eligible on the next daily invocation, so this is safe to simply retry
    // tomorrow rather than partially processing an unknown candidate set.
    console.error('retention-cleanup: failed to query expired contracts', selectErr);
    return;
  }

  for (const contract of expired ?? []) {
    const { error: removeErr } = await admin.storage.from('contracts').remove([contract.file_path!]);
    if (removeErr && !isNotFoundError(removeErr)) {
      console.error(`Failed to purge storage object for contract ${contract.id}`, removeErr);
      continue; // leave file_path/file_purged_at untouched; retried on next daily run
    }
    const { error: updateErr } = await admin.from('contracts').update({ file_path: null, file_purged_at: new Date().toISOString() }).eq('id', contract.id);
    if (updateErr) {
      // The Storage object IS already gone at this point (remove() above succeeded or was
      // a no-op "not found") — only this bookkeeping update failed. Logged so it's visible;
      // left as a known gap that this specific contract's file_path may incorrectly still
      // read non-null next run (re-attempting an already-successful remove(), which
      // isNotFoundError() above already treats as success, so this is self-correcting on
      // the next daily run rather than a permanent inconsistency).
      console.error(`Failed to update file_path/file_purged_at for contract ${contract.id}`, updateErr);
    }
  }
});
```

`netlify.toml`:
```toml
[functions."retention-cleanup"]
  schedule = "@daily"
```

This job never deletes the `contracts` row itself, nor any child rows — only the Storage object and the two columns (`file_path`, `file_purged_at`) that track it.

## `DELETE /api/contracts/{contractId}` (user-initiated, full deletion)

Wrapped in `withApiAuth` (no rate-limit action).

```ts
export const DELETE = withApiAuth(async (req, { userId, params }) => {
  const contract = await loadContractOwnedBy(params.contractId, userId);
  if (!contract) return jsonError('CONTRACT_NOT_FOUND', 'Contract not found.', 404, false);

  if (contract.file_path) {
    const { error } = await supabaseServer.storage.from('contracts').remove([contract.file_path]);
    if (error && !isNotFoundError(error)) {
      return jsonError('DELETE_FAILED', 'Could not delete this contract. Please try again.', 500, true);
    }
  }

  const { error: deleteErr } = await supabaseServer.from('contracts').delete().eq('id', contract.id);
  if (deleteErr) return jsonError('DELETE_FAILED', 'Could not delete this contract. Please try again.', 500, true);

  return NextResponse.json({ deleted: true, contract_id: contract.id });
});
```

**Behavior:** Storage object removed first (best-effort — proceeds even if already missing, e.g. `storage_upload_failed = true` or already retention-purged), then the `contracts` row is deleted, cascading via `ON DELETE CASCADE` (`docs/specs/supabase-schema.sql`) to `custom_key_terms`, `key_terms`, `chat_sessions` → `chat_messages`, `user_feedback`. `openai_usage_log.contract_id` is set to `NULL` (`ON DELETE SET NULL`) — usage records are retained for billing/cost-history purposes even after the contract is deleted.

## Frontend trigger

`components/dashboard/ContractTable.tsx` and the results page both offer a "Delete contract" action behind a confirmation dialog ("This permanently deletes this contract and all its data. This cannot be undone.") that calls `DELETE /api/contracts/{contractId}` and, on success, removes the row from the local `ContractTable` cache (TanStack Query) and, if triggered from the results page itself, redirects to `/dashboard`.

## Storage quota alert

`netlify/functions/cost-monitor.ts` (`docs/specs/13-rate-limiting-and-cost-control.md`) checks Storage usage and posts a Slack alert at 70% of the Supabase plan's storage quota — this is a proactive warning, not an enforcement mechanism (no upload is blocked based on this check).

## Edge cases

| Case | Behavior |
|---|---|
| Retention job runs on a contract whose Storage object was already manually deleted by the user via `DELETE /api/contracts/{id}` | Not reachable — deleting the contract row removes it from the retention query's candidate set entirely (`WHERE ... contracts` no longer has that row) |
| `storage.remove()` fails with "object not found" during either the scheduled job or `DELETE /api/contracts/{id}` | Treated as success — `isNotFoundError()` checks the Supabase Storage error code/message and allows the flow to proceed to updating `file_path`/`file_purged_at` (retention job) or deleting the row (user-initiated delete) |
| `storage.remove()` fails with a genuine error (network, permissions) during the scheduled job | That contract is skipped for this run and retried on the next daily execution; `file_path`/`file_purged_at` are left unchanged so the job's `WHERE file_path IS NOT NULL` condition picks it up again |
| `storage.remove()` fails with a genuine error during user-initiated delete | `500 DELETE_FAILED`, `retryable: true` — the `contracts` row is **not** deleted (Storage removal happens before the row delete), so retrying the same DELETE call is safe and idempotent |
| User deletes a contract that already has `file_path = null` (never uploaded to Storage successfully, or already retention-purged) | Storage removal step is skipped entirely (`if (contract.file_path)` guard); only the DB row deletion runs |
