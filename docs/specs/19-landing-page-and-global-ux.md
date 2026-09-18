# 19 — Landing Page, Global App Shell & UX States

Implements PRD Flow 1 step 1, Section 5/11 (usability, WCAG 2.1 AA); engineering doc Section 5 (UX states table).

## `app/(marketing)/page.tsx`

Static Server Component, no data fetching, no auth check (public route, not matched by `middleware.ts`).

Content (per PRD Section 4 Flow 1 step 1):
- Hero: value proposition headline + subheadline, a short demo GIF/video placeholder.
- Two primary CTAs: "Sign In" (opens `SignInModal`) and "Get Started Free" (opens `SignUpModal`).
- `components/ui/FooterAttribution.tsx`: "Powered by OpenAI GPT-4o" + a link to `NEXT_PUBLIC_STATUS_PAGE_URL`.

## `app/layout.tsx` (root layout)

- Renders `IncidentBanner` conditionally on `NEXT_PUBLIC_INCIDENT_BANNER` (`docs/specs/16-incident-response-and-monitoring.md`).
- Wraps `children` in the TanStack Query `QueryClientProvider` and a global `Toaster` (`sonner`) for transient error toasts.
- Sets `<html lang="en">` and base Tailwind design tokens per `docs/design.md` (`/design-system` skill, Stage 4).

## Global UX state matrix (engineering doc Section 5, verbatim mapping to implementation)

| State | Where implemented |
|---|---|
| Loading | `app/dashboard/loading.tsx` (table skeleton); `app/contracts/[contractId]/loading.tsx` (two-panel skeleton); `ProcessingProgress.tsx` 3-step indicator (`docs/specs/04-key-term-extraction.md`) |
| Empty | Dashboard empty state (`docs/specs/10-dashboard-and-north-star-metric.md`); chat empty state (`docs/specs/09-contract-chat-and-realtime.md`) |
| Error | `sonner` toast for transient/network errors; inline banner + "Try again" for upload/processing/chat failures (mapped from the standardized error envelope, `docs/specs/00-overview-and-conventions.md`); non-dismissible confidence warning tooltip is a *permanent* state, not an error state (`docs/specs/05-confidence-and-source-attribution.md`) |
| Responsive | Desktop (≥1024px): two-panel results layout. Tablet/mobile (<1024px): 3-tab layout (Viewer/Terms/Chat) sharing `targetPage` (`docs/specs/07-results-viewer.md`). A one-time banner (dismissible, `localStorage`-gated like onboarding) recommends Chrome/Firefox on desktop for large uploads and warns mobile users about slow uploads near the 10 MB limit on cellular connections |
| Accessibility (WCAG 2.1 AA) | Confidence indicators use icon + text, never colour-only (`docs/specs/05-confidence-and-source-attribution.md`); `SignUpModal`/`SignInModal` trap focus, `Esc`-dismissible; all interactive elements keyboard-reachable with visible focus rings; colour contrast ≥4.5:1; `aria-live="polite"` region announces chat responses and processing-step transitions to screen readers |

## `components/ui/LargeFileWarningBanner.tsx`

```tsx
const BANNER_KEY = 'contractiq_large_file_banner_dismissed_v1';

// Same safe-localStorage pattern as hooks/useOnboarding.ts (docs/specs/15-glossary-and-onboarding.md)
// — reading `localStorage` itself, not just calling a method on it, can throw in some
// private-browsing configurations, so the try/catch here is what actually implements the
// "always show, dismissal doesn't persist" degradation documented in the edge-case table
// below, rather than the bare typeof-check crashing on that same condition.
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
    // Swallowed intentionally — setDismissed(true) still runs below, so this session's
    // banner is still dismissed; only cross-session persistence of the dismissal is lost.
  }
}

export function LargeFileWarningBanner() {
  const [dismissed, setDismissed] = useState(() => safeGetItem(BANNER_KEY) === 'true');
  if (dismissed) return null;
  return (
    <div role="note">
      For the best experience with large PDFs, use Chrome or Firefox on desktop. On mobile, uploads near the 10 MB limit may be slow on cellular connections.
      <button onClick={() => { safeSetItem(BANNER_KEY, 'true'); setDismissed(true); }} aria-label="Dismiss">×</button>
    </div>
  );
}
```

Rendered once at the top of `app/contracts/new/page.tsx`.

## `aria-live` regions

`ProcessingProgress.tsx` and `ChatPanel.tsx` each wrap their dynamic status text / newest message in `<div aria-live="polite">` so screen readers announce step transitions and new assistant responses without requiring focus to move.

## Focus management

`SignUpModal.tsx`/`SignInModal.tsx` (`docs/specs/01-auth-and-session.md`) use a focus-trap utility (e.g. `focus-trap-react`) on open, return focus to the triggering button on close, and close on `Escape` — satisfying the WCAG 2.1 AA modal requirement.

## Edge cases

| Case | Behavior |
|---|---|
| Unauthenticated user navigates directly to `/dashboard` via URL | `middleware.ts` redirects to `/` with `?redirect=/dashboard` preserved (`docs/specs/01-auth-and-session.md`) |
| JS disabled / no localStorage (onboarding, large-file banner) | Both features degrade to "always show" (onboarding) or "always show, no dismiss persists" (large-file banner) — neither blocks core functionality |
| Screen reader user on the results page during extraction | `ProcessingProgress`'s `aria-live="polite"` region announces "Analysing with AI…" then "Compiling results…" without requiring the user to re-focus the page |
