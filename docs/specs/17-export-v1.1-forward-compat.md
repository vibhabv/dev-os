# 17 — Export to CSV/PDF (v1.1 — Forward-Compatibility Spec Only)

Implements PRD US-011 (P2/v1.1, not built in MVP); engineering doc Section 2 (Out of Scope for MVP), Section 9 (`GET /api/contracts/{contractId}/export`), Section 10 Phase 2.

**Status: not built in the MVP milestone.** This spec exists so the route contract and CSV-generation approach are unambiguous when v1.1 development begins, and so the MVP's frontend leaves the correct extension points (a disabled/hidden "Export" button, not a missing one entirely, is optional and not required — no MVP UI element references this feature).

## CSV export (client-side, no server route required)

When built, `components/results/ExportButton.tsx` will generate CSV directly from already-loaded `key_terms` data (no network call):

```ts
function exportToCsv(terms: KeyTerm[], filename: string) {
  const header = 'Term Name,Value,Page Number,Confidence Score,Edited\n';
  const rows = terms.map((t) =>
    [t.term_name, `"${t.value.replace(/"/g, '""')}"`, t.page_number, `${t.confidence_score}%`, t.is_edited ? 'Yes' : 'No'].join(',')
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  downloadBlob(blob, `${filename}-key-terms.csv`);
}
```

Must complete within 5 seconds (PRD constraint) — trivially satisfied since this is pure client-side string generation with no I/O.

## PDF summary export (server route)

### `GET /api/contracts/{contractId}/export?format=pdf`

- **Auth required:** Yes (+ ownership check).
- **Preconditions:** `contract.status === 'completed'` → else `409 CONTRACT_NOT_PROCESSED`.
- **Response `200`:** `Content-Type: application/pdf`, binary stream, `Content-Disposition: attachment; filename="{contract_name}-summary.pdf"`.
- **Implementation approach (when built):** server-side PDF generation (e.g. `@react-pdf/renderer` or `pdfkit`) rendering a formatted summary — contract filename/type, disclaimer banner text, and a table of all `key_terms` (term name, value, page, confidence) — from data already in `key_terms`/`contracts`, no additional OpenAI call.
- **Error responses:** `401 UNAUTHORIZED`, `404 CONTRACT_NOT_FOUND`, `409 CONTRACT_NOT_PROCESSED`, `500 EXPORT_GENERATION_FAILED`.
- **Performance target:** must complete within 5 seconds (PRD constraint).

## Why this is deferred

Per engineering doc Section 2, export is explicitly out of MVP scope (v1.1). This route is specified here only for architectural completeness/forward compatibility — implementing it is a v1.1 task, not part of the Stage 4 MVP feature-implementation checklist.
