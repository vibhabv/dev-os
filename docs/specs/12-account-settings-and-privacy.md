# 12 — Account Settings, Privacy Opt-In & Account Deletion

Implements PRD Section 1 MOAT #2, Section 10 ("opt-in, anonymised"), Section 5/11 (GDPR data deletion); engineering doc `user_settings` table, `term_corrections` view, `DELETE /api/account`.

## `app/account/page.tsx`

Server Component shell rendering two Client Components: `components/settings/PrivacyPreferences.tsx` and `components/settings/DeleteAccountButton.tsx`.

## `components/settings/PrivacyPreferences.tsx`

Single off-by-default toggle. Exact copy: "Help improve ContractIQ: share my term corrections anonymously (not your contract content) to improve extraction accuracy."

```ts
// hooks/useUserSettings.ts
export function useUserSettings() {
  const query = useQuery({
    queryKey: ['user-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
      if (error) throw error; // matches the useContract/useKeyTerms read pattern, docs/specs/07-results-viewer.md
      return data ?? { corrections_opt_in: false }; // absence of a row == opted out
    },
  });

  const mutation = useMutation({
    mutationFn: async (optIn: boolean) => {
      // The Supabase JS client RESOLVES (never rejects/throws) on a DB-level error — it
      // returns { data: null, error: {...} }. Returning that raw response directly would
      // make TanStack Query treat this mutation as successful regardless of whether the
      // write actually happened, which is exactly wrong for a privacy-sensitive control:
      // the caller (PrivacyPreferences.tsx) must only show "Saved" when the write is
      // genuinely confirmed. Explicitly checking `error` and throwing is what makes
      // TanStack Query's onError/isError actually fire for a failed write.
      const { error } = await supabase.from('user_settings').upsert(
        { user_id: userId, corrections_opt_in: optIn },
        { onConflict: 'user_id' }
      );
      if (error) throw error;
    },
  });

  return {
    settings: query.data,
    setCorrectionsOptIn: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.isError,
  };
}
```

RLS: `user_settings_select_own`, `user_settings_insert_own`, `user_settings_update_own`. The upsert is exactly the "first time a user visits the privacy toggle" pattern described in the engineering doc — no row is created until the user interacts with the toggle at least once; until then, `corrections_opt_in` is treated as `false` by the `term_corrections` view's `JOIN`.

Toggle behavior: switching to "on" or "off" is a single upsert call. `PrivacyPreferences.tsx` shows the brief "Saved" confirmation (toast or inline text) only when the mutation's promise resolves *without* throwing (i.e. `error` was falsy above) — on `saveError`, it instead shows "Could not save your preference. Please try again." and the toggle visually reverts to its last-confirmed state, so the user is never given false assurance that an unsaved preference change was recorded.

## `components/settings/DeleteAccountButton.tsx`

```tsx
export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  async function handleDelete() {
    const res = await fetch('/api/account', { method: 'DELETE', body: JSON.stringify({ confirm: true }) });
    if (res.ok) { await supabase.auth.signOut(); router.push('/'); }
    else showToast('Something went wrong deleting your account. Please try again or contact support.');
  }
  return (
    <>
      <button onClick={() => setConfirming(true)}>Delete my account</button>
      <ConfirmDialog
        open={confirming}
        title="Delete your account?"
        body="This permanently deletes all your contracts, chat history, and feedback. This cannot be undone."
        confirmLabel="Delete everything"
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
```

## `DELETE /api/account`

Wrapped in `withApiAuth` (no rate-limit action).

**Request:** `{ "confirm": true }` — a missing/false `confirm` field returns `400 CONFIRMATION_REQUIRED` before any deletion is attempted, guarding against accidental calls.

```ts
export const DELETE = withApiAuth(async (req, { userId }) => {
  const body = await req.json();
  if (body?.confirm !== true) return jsonError('CONFIRMATION_REQUIRED', 'Confirmation is required to delete your account.', 400, false);

  const admin = createAdminClient(); // service-role
  // Storage `list()` is shallow (one level), so removeAllUserStorageObjects() recursively
  // lists every per-contract subfolder under `{userId}/` and removes every object found —
  // best-effort, matching the same "proceed even if some objects are already missing"
  // pattern as DELETE /api/contracts/{id} (docs/specs/14-retention-and-deletion.md); a
  // partial Storage cleanup failure here does not block account deletion below, since the
  // DB-side cascade is the authoritative, GDPR-relevant deletion guarantee.
  await removeAllUserStorageObjects(admin, userId);

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return jsonError('ACCOUNT_DELETION_FAILED', 'Something went wrong deleting your account. Please try again.', 500, true);

  return NextResponse.json({ deleted: true });
});
```

Deleting `auth.users` cascades through every table via `ON DELETE CASCADE` (`docs/specs/supabase-schema.sql`): `contracts` → `custom_key_terms`, `key_terms`, `chat_sessions` → `chat_messages`, `user_feedback`; plus directly-owned rows in `user_settings`, `openai_usage_log` (cascade), `rate_limit_events`, `beta_access`.

## `term_corrections` view — privacy model (reference)

Defined fully in `docs/specs/supabase-schema.sql`. Only queryable by the `service_role` (grants revoked from `authenticated`/`anon`/`public`); consumed exclusively by `netlify/functions/quality-monitor.ts` (`docs/specs/13-rate-limiting-and-cost-control.md`). Never exposes `user_id`. Gated on `user_settings.corrections_opt_in = true`.

## Edge cases

| Case | Behavior |
|---|---|
| User deletes their account without ever visiting `/account` (no `user_settings` row exists) | `ON DELETE CASCADE` on `user_settings.user_id` is a no-op (no row to delete) — deletion proceeds normally through every other table |
| Storage listing/removal partially fails during account deletion (some objects already purged by retention job) | `removeAllUserStorageObjects` treats "object not found" as success (best-effort, matching the same pattern as `DELETE /api/contracts/{id}`); only a genuine Storage API error (not "not found") causes the overall request to fail with `500 ACCOUNT_DELETION_FAILED` |
| `confirm: false` or missing in the request body | `400 CONFIRMATION_REQUIRED`, no deletion attempted |
| Toggling `corrections_opt_in` off after previously being on | Existing `term_corrections` view rows for that user immediately disappear from the view on the next query (the view's `JOIN` re-evaluates `corrections_opt_in` live, not a point-in-time snapshot) — already-consumed data (e.g. already reviewed in a past weekly drift sample) is not retroactively un-reviewed, but no new rows are exposed going forward |
