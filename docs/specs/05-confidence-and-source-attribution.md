# 05 — Confidence Scoring & Source Attribution

Implements PRD US-003, US-004, FR-04, FR-07, FR-11; PRD Section 9 (Hallucination Guardrails, extraction layer).

## `components/results/ConfidenceBadge.tsx`

Props: `{ score: number /* 0–100 */ }`.

Colour + label thresholds (exact, from PRD Section 4 step 5 and Section 9):

| Range | Colour | Icon | Non-dismissible tooltip |
|---|---|---|---|
| `score >= 80` | Green | none | none |
| `50 <= score < 80` | Amber | none | none |
| `score < 50` | Red | ⚠️ | "Low confidence — we recommend verifying this in the document directly." |

Accessibility requirement (WCAG 2.1 AA, engineering doc Section 5): colour is never the only signal — every badge renders the numeric percentage as text (e.g. "92%") alongside the colour, and the red state additionally renders the ⚠️ icon with `aria-label="Low confidence"`. The tooltip is implemented as an always-visible inline text node below the term row on mobile (< 640px) and a hover/focus-triggered tooltip on desktop — "non-dismissible" means there is no close (`×`) affordance, not that it must literally always be painted on screen.

```tsx
export function ConfidenceBadge({ score }: { score: number }) {
  const tier = score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low';
  return (
    <span className={`confidence-badge confidence-badge--${tier}`}>
      {tier === 'low' && <WarningIcon aria-label="Low confidence" />}
      {Math.round(score)}%
      {tier === 'low' && (
        <Tooltip content="Low confidence — we recommend verifying this in the document directly." dismissible={false} />
      )}
    </span>
  );
}
```

## `components/results/KeyTermRow.tsx`

Renders: Term Name (+ `TermGlossaryTooltip` for standard terms, see `docs/specs/15-glossary-and-onboarding.md`) | Value (editable, see `docs/specs/08-inline-correction.md`) | Page Number (clickable, see below) | `ConfidenceBadge`. A "Custom" badge renders next to `term_name` when `term_source === 'custom'`.

## Page-number click-to-navigate (FR-07)

```tsx
<button onClick={() => setTargetPage(term.page_number)} aria-label={`Go to page ${term.page_number}`}>
  Page {term.page_number}
</button>
```

`setTargetPage` is the shared Zustand action from `lib/store/uiStore.ts` (`docs/specs/07-results-viewer.md` defines the consuming side in `PdfViewer`/`TextViewerFallback`). No network call — purely client-side state change with a smooth-scroll + highlight effect in the viewer.

## `components/results/SourceSentenceTooltip.tsx` ("Why?" expansion)

No network call — `source_sentence` is already loaded with the `key_terms` row.

```tsx
export function SourceSentenceTooltip({ sourceSentence }: { sourceSentence: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}>Why?</button>
      {open && <blockquote className="source-sentence">{sourceSentence || 'No supporting sentence was found for this term.'}</blockquote>}
    </div>
  );
}
```

If `source_sentence` is empty (the extraction route forces `confidence_score = 0` for such terms per `docs/specs/04-key-term-extraction.md`), the tooltip shows the fallback string above instead of an empty quote block.

## Low-confidence auto-highlight in the viewer

When a `KeyTermRow` with `confidence_score < 50` first renders on the results page (on initial load, not on every re-render), it calls `setTargetPage(term.page_number)` for the *first* such term only (to avoid fighting over the shared `targetPage` state if multiple low-confidence terms exist) — implemented as a `useEffect` in `components/results/KeyTermsPanel.tsx` that runs once on mount:

```tsx
useEffect(() => {
  const firstLowConfidence = terms.find((t) => t.confidence_score < 50);
  if (firstLowConfidence) setTargetPage(firstLowConfidence.page_number);
}, []); // run once on mount only
```

## Calibration warning banner

Implements PRD Section 9 ("Calibration monitoring… a UI calibration warning is shown if eval reveals ≥15% miscalibration") and Section 11 ("show calibration warning in UI if eval shows ≥15% miscalibration"). The monthly calibration job (`tests/eval/calibration.ts`, `docs/specs/18-testing-and-eval-strategy.md`) is a manual/scheduled offline process, not a live per-request calculation — its output (whether the current miscalibration is ≥15%) is surfaced to end users via a manually-toggled environment flag, following the same runbook pattern as the incident banner (`docs/specs/16-incident-response-and-monitoring.md`):

```tsx
// components/results/CalibrationWarningBanner.tsx
export function CalibrationWarningBanner() {
  if (process.env.NEXT_PUBLIC_CALIBRATION_WARNING !== 'true') return null;
  return (
    <div role="note" className="calibration-warning">
      Our confidence scores are currently being recalibrated and may be less accurate than usual. We recommend verifying all terms directly in the document.
    </div>
  );
}
```

Rendered once, above the `KeyTermsPanel`, on every results page. `NEXT_PUBLIC_CALIBRATION_WARNING` is set to `"true"` by the on-call/product team after reviewing the monthly `tests/eval/calibration.ts` output and reset to `"false"` once a corrective prompt update restores calibration — a manual, low-frequency toggle, not a live DB flag, consistent with the calibration job's monthly (not real-time) cadence.

## Disclaimer banner

`components/results/DisclaimerBanner.tsx` renders on every results page, non-dismissible, exact copy (PRD Section 9/11):

> "This is an AI-assisted review tool, not legal advice. Always verify critical terms with a qualified lawyer."

## Footer attribution

`components/ui/FooterAttribution.tsx`, rendered in `app/layout.tsx`, exact copy (PRD Section 11 Transparency): "Powered by OpenAI GPT-4o."

## Edge cases

| Case | Behavior |
|---|---|
| `confidence_score` exactly `50` | Falls into the amber (`50 <= score < 80`) tier, not red — boundary is inclusive on the low end of amber |
| `confidence_score` exactly `80` | Falls into the green tier — boundary is inclusive on the low end of green |
| Multiple terms with confidence < 50% | Every one individually shows the ⚠️ badge and tooltip; only the *first* (by array order) triggers the auto-highlight on initial page load |
| Term is `is_edited = true` | `ConfidenceBadge` still renders based on the original AI `confidence_score` (unchanged by edits) — editing a value does not change its stored confidence score; an "Edited" badge renders separately (`docs/specs/08-inline-correction.md`) |
