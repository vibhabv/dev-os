# 08 — Inline Key Term Correction & Feedback Loop

Implements PRD US-009; engineering doc Flow 3 step 8, `trg_capture_term_correction`, `term_corrections` view.

## `components/results/KeyTermRow.tsx` — edit interaction

1. Clicking the `value` cell replaces it with an `<input>` (or `<textarea>` if `value.length > 80`), pre-filled with the current value, auto-focused.
2. On blur or `Enter`: if the value is unchanged, no-op (revert to display mode without a network call). If changed, calls `updateTermValue(termId, newValue)` from `hooks/useKeyTerms.ts` (`docs/specs/07-results-viewer.md`), which performs the direct Supabase client update shown below:

```ts
const { error } = await supabase
  .from('key_terms')
  .update({ value: newValue })
  .eq('id', termId);

if (error) {
  showToast('Could not save your edit. Please try again.');
  revertToOriginalValue();
} else {
  // Optimistic UI already shows newValue; mark row as edited locally too,
  // but the authoritative is_edited/original_ai_value/edited_at come from
  // the trigger-updated row on the next read (TanStack Query refetch).
}
```

3. `Escape` while editing reverts to the original value without saving.

RLS: `key_terms_update_own` policy (`auth.uid() = user_id`).

## `trg_capture_term_correction` (DB-authoritative correction capture)

Defined in `docs/specs/supabase-schema.sql`. `BEFORE UPDATE ON key_terms`: if `NEW.value IS DISTINCT FROM OLD.value AND OLD.is_edited = false`, sets `NEW.original_ai_value = OLD.value`, `NEW.is_edited = true`, `NEW.edited_at = now()`. This means:

- **Only the first edit** captures `original_ai_value` — a second edit to an already-edited term updates `value` again but does not overwrite `original_ai_value` (it stays pinned to the true AI-generated value, not the most recent prior value).
- The client never sets `is_edited`/`original_ai_value`/`edited_at` directly — these are DB-computed and the client's `update()` call only ever sends `{ value: newValue }`.

## "Edited" badge

`KeyTermRow` renders a small "Edited" badge next to the term name when `is_edited === true`. Hovering/tapping it shows the `original_ai_value` in a tooltip: "Original AI extraction: {original_ai_value}".

## Performance target

Inline edit save completes within 2 seconds (PRD constraint) — a direct Supabase client update with no Route Handler round trip typically completes in well under 500ms; the UI updates optimistically immediately on submit and reconciles with the DB response.

## Feedback loop consumption

Edited terms are picked up by:
1. **Correction-rate health metric** (all users, aggregate only): `docs/specs/13-rate-limiting-and-cost-control.md` / `docs/specs/18-testing-and-eval-strategy.md` — `is_edited` count over 7 days, no opt-in required since no content is exposed.
2. **`term_corrections` view** (opt-in, anonymised content): only includes rows where the owning user has `user_settings.corrections_opt_in = true` (`docs/specs/12-account-settings-and-privacy.md`). A user who edits a term without ever opting in simply never appears in this view — their edit still updates `is_edited`/`original_ai_value` on the row itself (feeding the aggregate metric) but is invisible to the content-level dataset.

## Edge cases

| Case | Behavior |
|---|---|
| User edits a term back to its exact original AI value | `NEW.value IS DISTINCT FROM OLD.value` is false relative to the *current* `OLD.value` at update time (which is still the edited value from the prior save, not the original) — so this still counts as a second edit event but does not change `original_ai_value`; `is_edited` remains `true` |
| User submits an empty string as the new value | Allowed — `value` has a `NOT NULL` constraint but not a non-empty check; an empty string is a valid (if unusual) correction. No additional client-side validation blocks this, matching the absence of any PRD constraint on edited-value content |
| Two browser tabs editing the same term concurrently | Last write wins at the DB level (standard Postgres `UPDATE` semantics); no optimistic-locking/version column is implemented since this is a single-user-per-account editing scenario with no PRD requirement for conflict resolution |
| Edit attempted on a contract still `status = 'processing'` | Not reachable through the UI — `KeyTermRow` only renders once `key_terms` rows exist, which only happens after `status = 'completed'` |
