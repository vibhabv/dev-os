# 07 — Results Viewer (PDF.js + Text Fallback)

Implements PRD US-006, FR-06, FR-07; engineering doc Flow 3 step 6, Section 5 (PDF render failure fallback), Section 9 (Storage-related direct-client ops).

## Layout

`app/contracts/[contractId]/page.tsx` (Server Component shell + `loading.tsx` skeleton) renders `components/results/ResultsPage.tsx` (Client Component) in a two-panel desktop layout (≥1024px): left = viewer, right = `KeyTermsPanel`. Below 1024px, becomes a 3-tab layout (Viewer / Terms / Chat) sharing the same `targetPage` state (`docs/specs/00-overview-and-conventions.md`).

## `hooks/useContract.ts` and `hooks/useKeyTerms.ts`

Data-loading hooks consumed by `ResultsPage` and `KeyTermsPanel` respectively — both direct Supabase client reads (RLS-protected), cached via TanStack Query so inline edits (`docs/specs/08-inline-correction.md`) and re-navigation reuse cached data.

```ts
// hooks/useContract.ts
export function useContract(contractId: string) {
  return useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => {
      const { data, error } = await supabase.from('contracts').select('*').eq('id', contractId).single();
      if (error) throw error;
      return data as Contract;
    },
  });
}
```

```ts
// hooks/useKeyTerms.ts
export function useKeyTerms(contractId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['key-terms', contractId],
    queryFn: async () => {
      const { data, error } = await supabase.from('key_terms').select('*').eq('contract_id', contractId).order('created_at', { ascending: true });
      if (error) throw error;
      return data as KeyTerm[];
    },
  });

  async function updateTermValue(termId: string, newValue: string) {
    const { error } = await supabase.from('key_terms').update({ value: newValue }).eq('id', termId);
    if (!error) queryClient.invalidateQueries({ queryKey: ['key-terms', contractId] });
    return { error };
  }

  return { terms: query.data ?? [], isLoading: query.isLoading, updateTermValue };
}
```

`updateTermValue` is the function `KeyTermRow` (`docs/specs/08-inline-correction.md`) calls on blur/submit; `queryClient.invalidateQueries` triggers a refetch that picks up the trigger-computed `is_edited`/`original_ai_value`/`edited_at` fields set server-side by `trg_capture_term_correction`.

## `hooks/useSignedPdfUrl.ts`

```ts
export function useSignedPdfUrl(filePath: string | null) {
  return useQuery({
    queryKey: ['signed-pdf-url', filePath],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('contracts').createSignedUrl(filePath!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    enabled: !!filePath,
    staleTime: 55 * 60 * 1000, // refresh before the 1-hour expiry
    retry: 1, // a single retry before surfacing isError — a signed-URL mint call is cheap and idempotent
  });
}
```

RLS dependency: `storage.objects` policies (`docs/specs/supabase-schema.sql`) restrict this call to paths under `{auth.uid()}/...`, so `createSignedUrl` will fail with a Storage 403 if `file_path` somehow belongs to another user — this should never happen given `file_path` is only ever set server-side by the upload route using the authenticated `userId`.

## Viewer selection logic

`ResultsViewer` is the single component that owns the FR-06 fallback decision, and it is the one that actually calls `useSignedPdfUrl` — this is deliberate: the DB-only columns (`file_path`, `storage_upload_failed`) only tell you whether a Storage object was *ever* successfully uploaded, not whether it's *currently* fetchable, so the live signed-URL fetch result (not just those two columns) has to be part of the branch:

```tsx
export function ResultsViewer({ contract }: { contract: Contract }) {
  const hasStorageCandidate = !!contract.file_path && !contract.storage_upload_failed;
  const signedUrlQuery = useSignedPdfUrl(hasStorageCandidate ? contract.file_path : null);

  // No Storage object was ever uploaded (or it's known-failed), OR the live signed-URL
  // fetch itself errored (e.g. a post-upload Storage outage, or the object was already
  // retention-purged after contract.file_path was read into this component) — in every
  // one of these cases we fall back to the text viewer rather than attempt to mount
  // PdfViewer with no usable URL. This is what satisfies FR-06's "must always display
  // contract content" guarantee with actual code, not just a DB-column check.
  if (!hasStorageCandidate || signedUrlQuery.isError) {
    return <TextViewerFallback contractText={contract.contract_text} />;
  }

  // Signed URL not resolved yet — a brief loading state (typically well under 500ms;
  // createSignedUrl is a fast, single round trip, not a file download).
  if (signedUrlQuery.isLoading || !signedUrlQuery.data) {
    return <ViewerLoadingSkeleton />;
  }

  return <PdfViewer signedUrl={signedUrlQuery.data} />;
}
```

Both `PdfViewer` and `TextViewerFallback` subscribe to the same `targetPage` value from `lib/store/uiStore.ts` and expose an identical `onNavigate` contract, satisfying "Both viewers must respond to `targetPage` prop changes."

## `components/results/PdfViewer.tsx`

Takes the already-resolved `signedUrl` as a prop (resolved by `ResultsViewer` above, per the "Viewer selection logic" section) — `PdfViewer` itself never calls `useSignedPdfUrl` or reads `contract.file_path`, so there is exactly one place in the codebase (`ResultsViewer`) that decides whether a PDF or the text fallback is shown.

```tsx
export function PdfViewer({ signedUrl }: { signedUrl: string }) {
  // pdfjs-dist rendering keyed off `signedUrl`; scroll + zoom (`+`/`-` controls, keyboard
  // `Ctrl +`/`Ctrl -` per WCAG operability); lazy-loads pages (renders only pages
  // within/near the viewport) to mitigate large-file rendering issues per PRD External
  // Dependencies. Wrapped in an error boundary (see PdfRenderErrorFallback below) that
  // catches PDF.js render-phase throws specifically (e.g. an unusual font/layout PDF.js
  // can't parse) — this is a DIFFERENT failure class from a signed-URL fetch error
  // (already handled one level up, in ResultsViewer, before PdfViewer is ever mounted).
  // ...
}
```

- `useEffect` on `targetPage` change: calls the PDF.js `scrollPageIntoView` API with `behavior: 'smooth'`, then applies a temporary highlight CSS class to the nearest text span matching the term's `source_sentence` (best-effort substring search within that page's text layer; if no match is found, only the page scroll happens, no highlight — this is a graceful degradation, not an error).

## `components/results/PdfRenderErrorFallback.tsx`

```tsx
export function PdfRenderErrorFallback({ signedUrl, onSwitchToText }: { signedUrl: string; onSwitchToText: () => void }) {
  return (
    <div role="alert">
      <p>This PDF couldn't be previewed.</p>
      <a href={signedUrl} download>Download PDF</a>
      <button onClick={onSwitchToText}>View as text instead</button>
    </div>
  );
}
```

Rendered by `PdfViewer`'s error boundary specifically when PDF.js throws during render (unusual fonts/layouts) — `signedUrl` is already available as `PdfViewer`'s own prop, so no additional fetch is needed to populate the "Download PDF" link. This is a distinct failure class and a distinct recovery UI from the signed-URL-fetch-error case handled in `ResultsViewer` above: a signed-URL failure silently and automatically falls back to `TextViewerFallback` (the user never sees a broken viewer at all), whereas a PDF.js render failure shows this explicit "This PDF couldn't be previewed" panel with a manual choice, because in this case a valid, fetchable PDF file does exist (the download link works) — it just can't be rendered inline, which is worth surfacing rather than silently hiding.

## `components/results/TextViewerFallback.tsx`

```tsx
export function TextViewerFallback({ contractText }: { contractText: string }) {
  const pages = useMemo(() => parsePages(contractText), [contractText]); // splits on /\[PAGE (\d+)\]/
  const targetPage = useUiStore((s) => s.targetPage);
  const refs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (targetPage && refs.current[targetPage]) {
      refs.current[targetPage]!.scrollIntoView({ behavior: 'smooth', block: 'start' });
      refs.current[targetPage]!.classList.add('highlight-flash');
      setTimeout(() => refs.current[targetPage]?.classList.remove('highlight-flash'), 2000);
    }
  }, [targetPage]);

  return (
    <div>
      {pages.map((p) => (
        <section key={p.pageNumber} ref={(el) => (refs.current[p.pageNumber] = el)} aria-label={`Page ${p.pageNumber}`}>
          <h3>Page {p.pageNumber}</h3>
          <p>{p.text}</p>
        </section>
      ))}
    </div>
  );
}

function parsePages(text: string): { pageNumber: number; text: string }[] {
  const matches = [...text.matchAll(/\[PAGE (\d+)\]\n([\s\S]*?)(?=\[PAGE \d+\]|$)/g)];
  return matches.map((m) => ({ pageNumber: Number(m[1]), text: m[2].trim() }));
}
```

Same navigation behavior contract as `PdfViewer` (scroll + temporary highlight), satisfying FR-06's fallback requirement exactly.

## `lib/store/uiStore.ts` (Zustand — `targetPage` slice)

```ts
interface UiStore {
  targetPage: number | null;
  setTargetPage: (page: number) => void;
  wizardStep: 'select-type' | 'preview' | 'processing';
  setWizardStep: (step: UiStore['wizardStep']) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  targetPage: null,
  setTargetPage: (page) => set({ targetPage: page }),
  wizardStep: 'select-type',
  setWizardStep: (step) => set({ wizardStep: step }),
}));
```

Resets `targetPage` to `null` on navigation away from `/contracts/[contractId]` (in a `useEffect` cleanup in `ResultsPage`) so it doesn't leak state into the next contract viewed.

## `last_accessed_at` bump (direct Supabase client, no Route Handler)

On `ResultsPage` mount:

```ts
const { error } = await supabase.from('contracts').update({ last_accessed_at: new Date().toISOString() }).eq('id', contractId);
if (error) {
  // Intentionally logged, not surfaced to the user — this is a background bookkeeping
  // write, not something the results page's own rendering depends on (the page already
  // has the data it needs from useContract/useKeyTerms). A missed bump here has a narrow,
  // non-corrupting consequence: this contract's Storage PDF may become eligible for the
  // 90-day retention purge (docs/specs/14-retention-and-deletion.md) slightly earlier than
  // it should — never a false "reviewed" state and never data loss (contract_text and
  // key_terms are never touched by that job), so failing loudly to the user here would be
  // disproportionate. Still logged (not dropped) for visibility.
  console.error('Failed to update last_accessed_at', { contractId, error });
}
```

RLS: `contracts_update_own`. This drives the 90-day retention job (`docs/specs/14-retention-and-deletion.md`) and feeds the North Star Metric fallback (`docs/specs/10-dashboard-and-north-star-metric.md`).

## Mobile/tablet layout (<1024px)

3-tab layout (Viewer / Terms / Chat). Clicking a page number in `KeyTermRow` (`docs/specs/05-confidence-and-source-attribution.md`) both sets `targetPage` and programmatically switches the active tab to "Viewer" so the navigation is visible immediately, not just queued for when the user manually switches tabs.

## Edge cases

| Case | Behavior |
|---|---|
| `file_path` is null and `storage_upload_failed = false` (e.g. contract created before this field existed, or file already retention-purged) | `hasStorageCandidate` is `false`; `useSignedPdfUrl` is never called (`enabled: false`, since it's invoked with `null`); `ResultsViewer` renders `TextViewerFallback` directly — same code path as an upload-time Storage failure |
| Signed URL fetch fails (Storage outage after a successful original upload, or the object was retention-purged between page load and this fetch) | `useSignedPdfUrl`'s query enters `isError` state (after its 1 retry); `ResultsViewer`'s `if (!hasStorageCandidate \|\| signedUrlQuery.isError)` branch catches this and renders `TextViewerFallback` — `PdfViewer` is never mounted in this case, so its own error boundary is irrelevant here |
| PDF.js throws on render (bad fonts/layout) of a PDF whose signed URL *did* resolve successfully | `PdfViewer`'s error boundary (distinct from the signed-URL-fetch-error case above, and only reachable once `PdfViewer` has actually been mounted with a valid `signedUrl`) shows `PdfRenderErrorFallback` with "Download PDF" (the same already-resolved `signedUrl`) + "View as text instead" (switches to `TextViewerFallback` in place) |
| `targetPage` set to a page number beyond `contract.page_count` | Should not occur (page numbers only ever come from `key_terms.page_number`, itself constrained `<= page_count` implicitly by the model reading `[PAGE N]` markers that don't exceed the actual page count) — no explicit clamp is implemented since this is not reachable through normal UI interaction |
| Contract retention-purged (`file_purged_at` set, `file_path = null`) | Always falls back to `TextViewerFallback`, which never depended on the Storage object — results remain reviewable indefinitely (per `docs/specs/14-retention-and-deletion.md`) |
