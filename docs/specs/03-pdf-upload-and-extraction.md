# 03 — PDF Upload & Text Extraction

Implements PRD US-002, FR-02, FR-03, FR-14 (item 13); engineering doc Flow 3 steps 1–3, Section 9 `POST /api/contracts`.

## Frontend: `app/contracts/new/page.tsx` (UploadPage)

Client Component wizard with 3 sub-steps managed by `lib/store/uiStore.ts` (`wizardStep: 'select-type' | 'preview' | 'processing'`):

1. **`components/upload/ContractTypeSelector.tsx`** — a `<select>`/segmented control with two options: `nda`, `msa`. Required before the dropzone becomes interactive.
2. **`components/upload/FileDropzone.tsx`** — drag-and-drop + click-to-browse. Client-side pre-validation before any network call:
   - `file.type === 'application/pdf'` (also checked by extension `.pdf` as a fallback for misreported MIME types) → else inline error "Please upload a PDF file."
   - `file.size <= 10_485_760` → else inline error "File is too large. Maximum size is 10 MB."
   - No page-count or token-count check client-side (requires parsing) — deferred to the server.
3. On passing client validation, immediately `POST /api/contracts` as `multipart/form-data` with fields `file` and `contract_type`. Show a spinner state on the dropzone ("Uploading and extracting text…") for the duration of this call.
4. On `201`, `wizardStep = 'preview'` and render `components/upload/KeyTermPreviewList.tsx` with `response.standard_terms_preview` plus any already-added custom terms.
5. On error, render the mapped message inline above the dropzone (not a toast, since it's the primary content of the screen) with a "Try again" action that resets to step 1 without losing the selected `contract_type`.

## `POST /api/contracts` (Route Handler)

Wrapped in `withApiAuth` (no rate-limit action — upload itself is not OpenAI-billed).

**Request:** `multipart/form-data`
- `file`: PDF binary
- `contract_type`: `"nda"` \| `"msa"`

**Server-side pipeline (`app/api/contracts/route.ts` orchestrating `lib/pdf/extractText.ts` + `lib/pdf/validate.ts`):**

```ts
export const POST = withApiAuth(async (req, { userId }) => {
  const form = await req.formData();
  const file = form.get('file') as File | null;
  const contractType = form.get('contract_type') as string | null;

  const parsed = uploadContractSchema.safeParse({ contractType });
  if (!parsed.success) return jsonError('INVALID_CONTRACT_TYPE', 'Contract type must be NDA or MSA.', 400, false, parsed.error.flatten().fieldErrors);

  if (!file) return jsonError('INVALID_FILE_TYPE', 'Please upload a PDF file.', 400, false);
  if (file.type !== 'application/pdf') return jsonError('INVALID_FILE_TYPE', 'Please upload a PDF file.', 400, false);
  if (file.size > 10_485_760) return jsonError('FILE_TOO_LARGE', 'File is too large. Maximum size is 10 MB.', 400, false);

  const buffer = Buffer.from(await file.arrayBuffer());

  let extraction;
  try {
    extraction = await extractText(buffer); // { text: string (with [PAGE N] markers), pageCount: number }
  } catch (e) {
    return jsonError('EXTRACTION_FAILED', 'We could not read this PDF. It may be corrupted.', 500, true);
  }

  const wordCount = extraction.text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 100) {
    return jsonError('SCANNED_PDF_UNSUPPORTED', 'Scanned PDFs are not supported yet. Please upload a text-layer PDF.', 422, false);
  }
  if (extraction.pageCount > 20) {
    return jsonError('TOO_MANY_PAGES', 'Maximum 20 pages supported.', 422, false);
  }
  const tokenCount = countTokens(extraction.text); // tiktoken, cl100k_base
  if (tokenCount > 15000) {
    return jsonError('CONTRACT_TOO_LONG', 'This contract is too long for ContractIQ (max ~20 pages). Longer contract support is coming soon.', 422, false);
  }

  // Insert the DB row BEFORE attempting Storage upload — contract_text is the source of truth (FR-03).
  const { data: contract, error: insertErr } = await supabaseServer
    .from('contracts')
    .insert({
      user_id: userId,
      filename: file.name,
      contract_type: contractType,
      contract_text: extraction.text,
      page_count: extraction.pageCount,
      token_count: tokenCount,
      file_size_bytes: file.size,
      status: 'uploaded',
    })
    .select()
    .single();

  if (insertErr || !contract) {
    return jsonError('EXTRACTION_FAILED', 'Something went wrong saving your contract. Please try again.', 500, true);
  }

  // Best-effort, non-blocking Storage upload — a failure here never blocks the 201
  // response below (the contract row and contract_text are already durably persisted).
  const path = `${userId}/${contract.id}/${file.name}`;
  const { error: storageErr } = await supabaseServer.storage.from('contracts').upload(path, buffer, { contentType: 'application/pdf' });
  const { error: statusUpdateErr } = await supabaseServer.from('contracts').update(
    storageErr ? { storage_upload_failed: true, file_path: null } : { file_path: path }
  ).eq('id', contract.id);
  if (statusUpdateErr) {
    // Intentionally logged, not surfaced to the client — this update never gates the
    // response (the 201 body below contains no file_path/storage fields, per the response
    // shape). But it is NOT silently ignored: if the actual Storage upload above succeeded
    // and only THIS status-recording write fails, file_path stays NULL at its insert-time
    // default, which would otherwise silently misroute docs/specs/07-results-viewer.md's
    // ResultsViewer to TextViewerFallback forever (a valid PDF exists in Storage but is
    // never linked) and leave that object permanently excluded from the retention job
    // (docs/specs/14-retention-and-deletion.md, which only selects `file_path IS NOT NULL`
    // rows). Logging it (not just dropping it) means it's at least visible in Netlify
    // Function invocation logs (docs/specs/16-incident-response-and-monitoring.md) for
    // manual follow-up, even though no automated retry/reconciliation job exists for this
    // narrow case at MVP.
    console.error(`Failed to record Storage status for contract ${contract.id}`, statusUpdateErr);
  }

  return NextResponse.json({
    contract_id: contract.id,
    filename: contract.filename,
    contract_type: contract.contract_type,
    page_count: contract.page_count,
    status: contract.status,
    standard_terms_preview: contractType === 'nda' ? NDA_STANDARD_TERMS : MSA_STANDARD_TERMS,
  }, { status: 201 });
});
```

**No-partial-output guarantee:** the `contracts` row is only inserted after `pdf-parse` succeeds and every validation passes — satisfies "corrupted PDF → graceful error, no partial output stored."

## `lib/pdf/extractText.ts`

```ts
export async function extractText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const data = await pdfParse(buffer, {
    pagerender: (pageData) => pageData.getTextContent().then((tc) => tc.items.map((i: any) => i.str).join(' ')),
  });
  // pdf-parse exposes per-page text via a custom render callback; concatenate with [PAGE N] markers.
  const pages: string[] = data.pagesText; // populated by the pagerender callback accumulator
  const marked = pages.map((pageText, i) => `[PAGE ${i + 1}]\n${pageText}`).join('\n\n');
  return { text: marked, pageCount: pages.length };
}
```

## `lib/pdf/validate.ts`

Pure functions, unit-testable in isolation (no I/O):

```ts
export function isValidMimeType(mimeType: string): boolean { return mimeType === 'application/pdf'; }
export function isWithinSizeLimit(bytes: number): boolean { return bytes <= 10_485_760; }
export function isWithinPageLimit(pageCount: number): boolean { return pageCount <= 20; }
export function isLikelyScanned(wordCount: number): boolean { return wordCount < 100; }
export function isWithinTokenLimit(tokenCount: number): boolean { return tokenCount <= 15000; }
```

## `lib/validation/uploadContractSchema.ts`

```ts
export const uploadContractSchema = z.object({
  contractType: z.enum(['nda', 'msa'], { errorMap: () => ({ message: 'Contract type must be NDA or MSA.' }) }),
});
```

## Standard term preview lists (static, not an AI call)

`lib/openai/prompts/nda.ts` exports `NDA_STANDARD_TERMS`:
`["Parties", "Effective Date", "Confidentiality Obligations", "Permitted Disclosures", "Term & Duration", "Governing Law", "Jurisdiction", "IP Ownership", "Non-Solicitation", "Breach & Remedy"]`

`lib/openai/prompts/msa.ts` exports `MSA_STANDARD_TERMS`:
`["Parties", "Service Scope", "Payment Terms", "Invoice Schedule", "Late Payment Penalty", "Liability Cap", "Indemnification", "IP Ownership", "Termination Clause", "Governing Law", "Dispute Resolution", "Notice Period"]`

## Edge cases

| Case | HTTP response | User-visible message |
|---|---|---|
| Non-PDF file uploaded | `400 INVALID_FILE_TYPE` | "Please upload a PDF file." |
| File > 10 MB | `400 FILE_TOO_LARGE` | "File is too large. Maximum size is 10 MB." |
| Missing/invalid `contract_type` | `400 INVALID_CONTRACT_TYPE` | "Contract type must be NDA or MSA." |
| Corrupted/unparsable PDF binary | `500 EXTRACTION_FAILED`, `retryable: true` | "We could not read this PDF. It may be corrupted. Please try again or upload a different file." |
| Scanned/image-only PDF (< 100 extracted words) | `422 SCANNED_PDF_UNSUPPORTED` | "Scanned PDFs are not supported yet." |
| > 20 pages | `422 TOO_MANY_PAGES` | "Maximum 20 pages supported." |
| > 15,000 tokens (dense 20-page contract) | `422 CONTRACT_TOO_LONG` | "This contract is too long for ContractIQ (max ~20 pages). Longer contract support is coming soon." |
| Supabase Storage upload fails (network/quota) | `201` still returned — non-blocking | `storage_upload_failed = true`, `file_path = null`; results page falls back to `TextViewerFallback` (`docs/specs/07-results-viewer.md`) |
| Non-NDA/MSA document uploaded (e.g. an invoice) under either type selection | `201` returned; extraction proceeds in `docs/specs/04-key-term-extraction.md` and produces low-confidence terms with a type-mismatch banner | Not rejected at upload — PRD requires graceful degradation, not rejection |

## Performance target

Upload + extraction (this route alone, excluding the separate `/process` AI call) must complete well within the overall ≤30s P95 budget for the full upload→results flow; `pdf-parse` on a 20-page text-layer PDF typically completes in under 1–2 seconds, leaving headroom for the OpenAI call in `docs/specs/04-key-term-extraction.md`.
