# 11 — Feedback Collection & Satisfaction Survey

Implements PRD US-010, FR-12; PRD Section 10 ("Were the extracted terms accurate?" survey); engineering doc `user_feedback` table.

## `components/feedback/FeedbackWidget.tsx`

Rendered on the results page, below the key terms panel (or in a dedicated "Feedback" tab on mobile). Two independent, both-skippable sub-widgets sharing one table:

1. **Thumbs up/down + optional comment** (general reaction):
   ```tsx
   <ThumbsRating value={rating} onChange={setRating} /> {/* 'up' | 'down' | null */}
   <textarea placeholder="Anything else you'd like to share? (optional)" value={comment} onChange={...} />
   ```
2. **Accuracy survey** ("Were the extracted terms accurate?"):
   ```tsx
   <RadioGroup value={accuracyRating} onChange={setAccuracyRating} options={['yes', 'partially', 'no']} />
   ```

Submit button is enabled once at least one of `rating`, `accuracyRating`, or a non-empty `comment` is set (matching the DB's `user_feedback_not_empty` check constraint). Direct Supabase client insert:

```ts
async function submitFeedback() {
  const { error } = await supabase.from('user_feedback').insert({
    contract_id: contractId,
    user_id: userId,
    rating: rating ?? null,
    accuracy_rating: accuracyRating ?? null,
    comment: comment.trim() || null,
  });
  if (error) {
    setSubmitError('Could not submit your feedback. Please try again.');
    return;
  }
  setSubmitted(true); // only flips to the "Thanks for your feedback!" state on a genuinely confirmed insert
}
```

RLS: `user_feedback_insert_own`. On success (`error` falsy), the widget replaces itself with "Thanks for your feedback!" and does not allow a second submission for the same contract in the same session (local component state only — the DB does not enforce one-feedback-row-per-contract, see edge cases). On failure, an inline message ("Could not submit your feedback. Please try again.") is shown instead and the form remains editable/re-submittable — the success state is never shown for a write that didn't actually happen, matching the "check every write's `error`, never show false success" convention established elsewhere in this project (`docs/specs/06`, `08`, `12`).

## Prompt timing

Per engineering doc Section 10 Phase 1 feature table: "a skippable … accuracy survey prompted at session end, per contract." Implementation: the widget becomes visible once `contract.status === 'completed'` and the user has spent at least a few seconds on the results page (no hard timer requirement in the PRD — the widget is simply present and always-visible on the results page, not modal/interruptive, satisfying "skippable" trivially since nothing blocks navigation away from it).

## Satisfaction metric query (used by the staged launch gates, `docs/specs/02-beta-access-and-launch-gates.md`)

```sql
SELECT count(*) FILTER (WHERE accuracy_rating = 'yes') * 100.0
     / NULLIF(count(*) FILTER (WHERE accuracy_rating IS NOT NULL), 0)
FROM user_feedback
WHERE created_at > :stage_start;
```

## Edge cases

| Case | Behavior |
|---|---|
| User submits feedback with only a comment (no rating, no accuracy_rating) | Allowed — satisfies the `user_feedback_not_empty` check constraint |
| User attempts to submit with all three fields empty | Submit button is disabled client-side; if bypassed, the DB check constraint rejects the insert and the client shows "Please provide a rating or comment" |
| User submits feedback twice for the same contract (e.g. reloads the page) | Not blocked at the DB level — a second row is simply inserted. This is an accepted simplification: no PRD acceptance criterion requires exactly one feedback row per contract, and multiple submissions over time (e.g. after re-reviewing) are a reasonable signal, not corrupt data |
| Feedback submitted on a contract still `status = 'processing'` or `'error'` | Widget is not rendered until `status === 'completed'`, so this is prevented by the UI, not the DB |
| Insert fails (network blip, transient DB error) | `submitFeedback()`'s `error` check catches it; the widget shows "Could not submit your feedback. Please try again." instead of the success state, and remains editable so the user can retry without losing their entered rating/comment |
