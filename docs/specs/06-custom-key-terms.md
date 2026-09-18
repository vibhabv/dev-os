# 06 — Custom Key Term Addition

Implements PRD US-005, FR-05; engineering doc Flow 3 step 4, `custom_key_terms` table, `trg_enforce_max_custom_terms`.

## PRD wording reconciliation: FR-05 "at least 5" vs. a hard cap of 5

PRD FR-05's Functional Requirements table literally reads "Users must be able to add **at least 5** custom key terms," which read in isolation could imply 5 is a floor, not a ceiling. This is reconciled the same way other PRD-internal wording tensions are reconciled elsewhere in this project (e.g. the engineering doc's handling of the OpenAI DPA EU-onboarding-vs-Public-Launch scoping): the PRD's own Constraints section ("Maximum **5** custom key terms per analysis at MVP to manage context length"), the Roadmap v0.3 entry ("Custom key term addition (up to 5 terms)"), and the Component-D risk table ("limited to 5 terms at MVP to manage context length") are unanimous and explicit that 5 is a hard ceiling driven by extraction-prompt context-length management. This spec therefore implements a **hard cap of exactly 5**, not a floor — FR-05's "at least 5" is treated as loose phrasing for "users must be able to add up to the full allowance of 5," consistent with every other mention of this limit in the PRD and with the engineering doc's `trg_enforce_max_custom_terms` trigger design (`docs/specs/supabase-schema.sql`).

## `components/upload/CustomTermInput.tsx`

Rendered below `KeyTermPreviewList` during the `'preview'` wizard step (`docs/specs/03-pdf-upload-and-extraction.md`). Button: "+ Add Key Term". Clicking reveals a single-line text input + "Add" / "Cancel" actions.

Client-side guard: the "+ Add Key Term" button is disabled (with a tooltip "Maximum 5 custom terms") once 5 custom terms already exist locally for this contract, avoiding an unnecessary round trip that would just hit the DB trigger.

## Direct Supabase client insert (no custom Route Handler)

```ts
const { data, error } = await supabase
  .from('custom_key_terms')
  .insert({ contract_id: contractId, user_id: userId, term_name: trimmedInput, is_manual: true })
  .select()
  .single();

if (error) {
  if (error.message.includes('Maximum 5 custom terms')) {
    showInlineError('Maximum 5 custom terms per contract.');
  } else {
    showInlineError('Could not add this term. Please try again.');
  }
  return;
}
// Optimistically append `data` to the local preview list with a "Custom" badge.
```

RLS: `custom_key_terms_insert_own` policy (`auth.uid() = user_id`), enforced in `docs/specs/supabase-schema.sql`.

DB enforcement: `trg_enforce_max_custom_terms` (`BEFORE INSERT`) counts existing rows for `contract_id`; raises a Postgres exception (`P0001`, message `"Maximum 5 custom terms per contract"`) on the 6th attempt. This is the authoritative limit — the client-side disable is a UX optimization, not the source of truth, so a race between two tabs adding terms simultaneously is still correctly rejected server-side.

## Validation

- `term_name`: required, 1–100 characters, trimmed. No further semantic validation — any string is accepted and passed to the extraction prompt as-is (per PRD: "zero-shot with term name injected into the extraction prompt").
- Duplicate term names (same string added twice) are **not** blocked — the extraction call will simply attempt to extract the same term twice, producing two `key_terms` rows. This is accepted as a low-impact edge case (no PRD acceptance criterion addresses duplicate custom term names) rather than adding extra validation complexity.

## Removal (pre-processing only)

`CustomTermInput.tsx` shows an "×" next to each added term while still in the `'preview'` step:

```ts
async function removeCustomTerm(customTermId: string) {
  const { error } = await supabase.from('custom_key_terms').delete().eq('id', customTermId);
  if (error) {
    showInlineError('Could not remove this term. Please try again.');
    return; // local list is NOT optimistically updated until the delete is confirmed
  }
  setLocalTerms((terms) => terms.filter((t) => t.id !== customTermId));
}
```

RLS: `custom_key_terms_delete_own` policy. Once the user clicks "Process Contract" and processing has started (`contracts.status !== 'uploaded'`), the preview UI is no longer shown, so removal is only ever possible before processing begins — no additional guard is needed since the UI simply doesn't render the delete affordance post-processing. The local list update happens only after the delete is confirmed (not optimistically) — a failed delete leaves the term visibly still present rather than silently disappearing from the UI while the DB row still exists.

## Consumption in extraction

`docs/specs/04-key-term-extraction.md` loads all `custom_key_terms` rows for the contract at `/process` time and appends their `term_name`s to the extraction prompt; resulting `key_terms` rows set `term_source = 'custom'` and `custom_term_id` = the originating row's `id`.

## Edge cases

| Case | Behavior |
|---|---|
| 6th custom term insert attempt (client bypassed, e.g. via devtools) | DB trigger rejects with `P0001`; client shows "Maximum 5 custom terms per contract." |
| Custom term name is only whitespace | Client-side trims and rejects with inline error "Please enter a term name" before any insert attempt |
| User adds a custom term whose name exactly matches a standard term (e.g. "Governing Law" as a custom term on an NDA) | Not blocked — this produces a duplicate extraction attempt for that term name; low-impact, not specifically handled |
| Custom term row is deleted after processing already completed | Not possible via the UI (delete affordance only shown pre-processing); if triggered directly against the DB, `key_terms.custom_term_id` is set to `NULL` via `ON DELETE SET NULL` — the already-extracted `key_terms` row is retained, only its link back to the originating custom-term request is severed |
