# 15 — Plain-English Glossary & Onboarding Tooltips

Implements PRD Section 5 (usability constraint — "all legal jargon tooltipped or explained in plain English"), Section 3 roadmap (onboarding tooltips); engineering doc Section 5.

## `lib/constants/termGlossary.ts`

Static map keyed by exact standard term name (case-sensitive match against the strings in `NDA_STANDARD_TERMS`/`MSA_STANDARD_TERMS`, `docs/specs/03-pdf-upload-and-extraction.md`):

```ts
export const TERM_GLOSSARY: Record<string, string> = {
  'Parties': 'The individuals or companies entering into this agreement.',
  'Effective Date': 'The date the agreement starts being legally binding.',
  'Confidentiality Obligations': 'What each party must keep secret and for how long.',
  'Permitted Disclosures': 'Situations where sharing confidential information is allowed (e.g. legal requirement).',
  'Term & Duration': 'How long the agreement lasts before it expires.',
  'Governing Law': 'Which country or state\'s laws apply if there\'s a dispute.',
  'Jurisdiction': 'Which court system handles any legal dispute.',
  'IP Ownership': 'Who owns any ideas, inventions, or content created under the agreement.',
  'Non-Solicitation': 'Restrictions on hiring each other\'s employees or clients.',
  'Breach & Remedy': 'What happens if either party breaks the agreement, and how it can be fixed.',
  'Service Scope': 'Exactly what work or services are being provided.',
  'Payment Terms': 'How much is paid, when, and by what method.',
  'Invoice Schedule': 'How often invoices are sent and payment is expected.',
  'Late Payment Penalty': 'Extra fees charged if payment is late.',
  'Liability Cap': 'The maximum amount one party can be required to pay the other if something goes wrong.',
  'Indemnification': 'Who pays for damages if something goes wrong.',
  'Termination Clause': 'How and when either party can end the agreement early.',
  'Dispute Resolution': 'The agreed process for resolving disagreements (e.g. mediation, arbitration, court).',
  'Notice Period': 'How much advance warning is required before ending the agreement.',
};
```

## `components/results/TermGlossaryTooltip.tsx`

```tsx
export function TermGlossaryTooltip({ termName }: { termName: string }) {
  const definition = TERM_GLOSSARY[termName];
  if (!definition) return null; // custom terms have no glossary entry — omit the trigger entirely
  return (
    <Tooltip content={definition}>
      <InfoIcon aria-label={`What is ${termName}?`} />
    </Tooltip>
  );
}
```

Rendered next to every standard term name in `KeyTermRow` (`docs/specs/05-confidence-and-source-attribution.md`); silently omitted for custom terms (`term_source === 'custom'`) since they have no static definition.

## `hooks/useOnboarding.ts` + `components/ui/OnboardingTooltip.tsx`

Device-local, non-critical UX affordance — no backend state.

```ts
const ONBOARDING_KEY = 'contractiq_onboarding_seen_v1';

// Wraps every localStorage access — reading `localStorage` itself (not just calling a
// method on it) can throw a SecurityError in some private-browsing configurations, so a
// bare `typeof window !== 'undefined' && localStorage.getItem(...)` is not sufficient on
// its own to guarantee the "falls back gracefully, never shows tooltips" behavior this
// hook is documented to have below — the try/catch is what actually implements that.
function safeGetItem(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}
function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  } catch {
    // Swallowed intentionally — the corresponding useState update still runs (below), so
    // the current session's UI still behaves correctly; only cross-session persistence is
    // lost, which is the documented degradation for this case.
  }
}

export function useOnboarding() {
  const [seen, setSeen] = useState(() => safeGetItem(ONBOARDING_KEY) === 'true');
  function dismiss() {
    safeSetItem(ONBOARDING_KEY, 'true');
    setSeen(true);
  }
  return { seen, dismiss };
}
```

```tsx
export function OnboardingTooltip({ id, content, children }: { id: string; content: string; children: ReactNode }) {
  const { seen, dismiss } = useOnboarding();
  if (seen) return <>{children}</>;
  return (
    <Popover open onOpenChange={(open) => !open && dismiss()}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent>{content} <button onClick={dismiss}>Got it</button></PopoverContent>
    </Popover>
  );
}
```

**Placement (per engineering doc Section 5):**
- `/dashboard`: wraps the "Review a Contract" CTA. Copy: "Start here — upload your first NDA or MSA to get an instant breakdown."
- `/contracts/new`: wraps the confidence-badge legend (shown once the preview renders). Copy: "Green means high confidence, amber means check it, red means we recommend verifying manually."
- `/contracts/[id]`: wraps the chat button. Copy: "Have a question about this contract? Ask it here in plain English."

The `localStorage` flag is a single global key shared across all three placements — once *any* one is dismissed, `seen` becomes `true` for all of them simultaneously (a single "first-run" experience, not per-tooltip tracking), matching "shown once per user."

## Edge cases

| Case | Behavior |
|---|---|
| Custom term name happens to exactly match a glossary key (e.g. user adds "Indemnification" as a custom term on an NDA) | `TermGlossaryTooltip` still checks `term_source` first in `KeyTermRow`'s render logic — custom terms never show the glossary trigger regardless of name collision, keeping the "Custom" badge as the only differentiator for those rows |
| User clears `localStorage` (private browsing, different device) | Onboarding tooltips reappear — expected behavior, no server-side tracking is specified by the PRD |
| `localStorage` unavailable/throws (e.g. blocked by browser privacy settings) | `safeGetItem`/`safeSetItem` (above) catch the throw and never propagate it — `seen` reads as `false` (same as a genuine first-time visitor, since a failed read is indistinguishable from "never dismissed"), so onboarding tooltips render normally rather than crashing the page; clicking "Got it" still calls `dismiss()` and updates `seen` for the current render via `setSeen(true)`, but `safeSetItem`'s write is silently swallowed, so the dismissal does not persist to a reload — this is the accepted degradation (tooltips show every session in this specific environment) rather than a hard requirement to suppress them entirely |
