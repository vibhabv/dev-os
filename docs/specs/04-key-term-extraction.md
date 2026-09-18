# 04 — Key Term Extraction (GPT-4o)

Implements PRD US-002 (extraction half), US-005 (custom terms half — see also `docs/specs/06-custom-key-terms.md`), FR-04, FR-05; engineering doc Flow 3 steps 4–5, Section 8 (AI Architecture), Section 9 `POST /api/contracts/{contractId}/process`.

## Frontend trigger

`components/upload/ProcessingProgress.tsx` renders 3 static steps: "Extracting text ✓" (already done at upload), "Analysing with AI…", "Compiling results…". On mount it calls `POST /api/contracts/{contractId}/process`; the 3-step UI is driven purely by client-side elapsed-time heuristics (not server push, since the call is a single synchronous request bounded at ~20–30s) — step 2 shows immediately, step 3 shows once the response is received, then the page navigates to `/contracts/{contractId}`.

## `POST /api/contracts/{contractId}/process`

Wrapped in `withApiAuth(handler, { rateLimitAction: 'process' })` (handler first, opts second — canonical signature defined in `docs/specs/00-overview-and-conventions.md`) — 20 calls/user/rolling hour (`docs/specs/13-rate-limiting-and-cost-control.md`).

**Request:** `{}` (empty body).

**Preconditions:**
1. Contract exists and `contract.user_id === userId` → else `404 CONTRACT_NOT_FOUND`.
2. `contract.status IN ('uploaded', 'error')` → else `400 ALREADY_PROCESSED` (a `completed` contract cannot be re-processed via this route; re-extraction is not a supported user action in the MVP).

**HTTP status reconciliation note:** the engineering doc's own prose for this endpoint (Section 9) is internally inconsistent — its "Validation" bullet says the already-completed case "return[s] `409`," while its own immediately-following "Error responses" enumeration for this same endpoint lists `400 ALREADY_PROCESSED` and no `409` at all. This spec resolves that self-contradiction in favor of `400 ALREADY_PROCESSED`, for two reasons: (1) it's what the eng-doc's own enumerated Error-responses list for this exact endpoint actually specifies, and (2) it's consistent with `docs/specs/00-overview-and-conventions.md`'s fixed HTTP-status mapping table, which maps `ALREADY_PROCESSED → 400` project-wide (no other endpoint uses `409` for an analogous "this resource is already in a terminal state" case — compare `CONTRACT_NOT_PROCESSED → 409` on the chat route, `docs/specs/09-contract-chat-and-realtime.md`, which is a different semantic: chat requires processing to have *already happened*, whereas this route requires it to *not have* happened yet).

**Pipeline (`lib/openai/extraction.ts`):**

```ts
export async function runExtraction(contract: Contract, customTerms: CustomKeyTerm[]): Promise<ExtractionResult> {
  const startedAt = Date.now(); // captured for the duration_ms KPI field, docs/specs/13-rate-limiting-and-cost-control.md
  const promptFile = contract.contract_type === 'nda' ? ndaPrompt : msaPrompt;
  const systemPrompt = buildExtractionSystemPrompt(promptFile, customTerms.map(t => t.term_name));

  // Every OpenAI call is wrapped with the shared 20s per-call timeout (lib/openai/withTimeout.ts,
  // docs/specs/00-overview-and-conventions.md) *inside* the retry loop — a TimeoutError on one
  // attempt is retried like any other transient failure by withRetry().
  const call = () => withTimeout((signal) => openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 2000,
    user: sha256(contract.user_id),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: contract.contract_text },
    ],
  }, { signal }), 20_000);

  let raw = await withRetry(call, { attempts: 3, backoffMs: [1000, 2000, 4000] });
  let parsed = tryParseJson(raw.choices[0].message.content);

  if (!parsed) {
    // Single corrective retry per PRD Section 8 "Error recovery"
    const retryCall = () => withTimeout((signal) => openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 2000,
      user: sha256(contract.user_id),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contract.contract_text },
        { role: 'assistant', content: raw.choices[0].message.content },
        { role: 'user', content: 'Your previous response was not valid JSON. Return only the JSON array, no explanation.' },
      ],
    }, { signal }), 20_000);
    raw = await withRetry(retryCall, { attempts: 3, backoffMs: [1000, 2000, 4000] });
    parsed = tryParseJson(raw.choices[0].message.content);
  }

  if (!parsed || !validateExtractionSchema(parsed)) {
    throw new InvalidModelOutputError();
  }

  await logUsage({
    userId: contract.user_id, contractId: contract.id, operation: 'extraction',
    promptVersion: promptFile.PROMPT_VERSION, usage: raw.usage, durationMs: Date.now() - startedAt,
  });

  return parsed;
}
```

**Route handler orchestration:**

```ts
export const POST = withApiAuth(async (req, { userId, params }) => {
  const contract = await loadContractOwnedBy(params.contractId, userId);
  if (!contract) return jsonError('CONTRACT_NOT_FOUND', 'Contract not found.', 404, false);
  if (!['uploaded', 'error'].includes(contract.status)) {
    return jsonError('ALREADY_PROCESSED', 'This contract has already been processed.', 400, false);
  }

  const { error: processingUpdateErr } = await supabaseServer.from('contracts').update({ status: 'processing' }).eq('id', contract.id);
  if (processingUpdateErr) return jsonError('INTERNAL_ERROR', 'Something went wrong starting the analysis. Please try again.', 500, true);
  const customTerms = await loadCustomTerms(contract.id);

  try {
    const result = await runExtraction(contract, customTerms);
    const rows = result.terms.map((t) => ({
      contract_id: contract.id,
      user_id: userId,
      custom_term_id: t.term_source === 'custom' ? customTerms.find(c => c.term_name === t.term_name)?.id ?? null : null,
      term_source: t.term_source,
      term_name: t.term_name,
      value: t.value,
      page_number: t.page_number,
      confidence_score: t.source_sentence ? t.confidence_score * 100 : 0, // missing source_sentence forced to 0 confidence
      source_sentence: t.source_sentence ?? '',
    }));
    // .select() is chained onto the insert to get the DB-generated `id` (and any other
    // server-computed defaults) back — the engineering doc's documented response schema
    // for this endpoint (Section 9) includes "id": "uuid" per key term, so the response
    // below must return the DB-returned rows, not the pre-insert local `rows` array.
    const { data: insertedTerms, error: insertErr } = await supabaseServer.from('key_terms').insert(rows).select();
    if (insertErr || !insertedTerms) {
      // A Supabase write failure here is not an OpenAI failure — handled as its own
      // distinct response (matching the EXTRACTION_FAILED code already used for the
      // analogous "contract row failed to save" case in docs/specs/03-pdf-upload-and-extraction.md)
      // rather than falling through to the OpenAI-specific catch block below, whose
      // message ("OpenAI is temporarily unavailable") would be misleading for a DB error.
      // Best-effort — if this status update also fails, the route still returns the
      // accurate EXTRACTION_FAILED response below; the contract is left at 'processing'
      // in that unlikely double-failure case, same residual risk as any other unchecked
      // write, but the client is never told a false 'completed'/'error' outcome.
      await supabaseServer.from('contracts').update({ status: 'error', error_message: 'Something went wrong saving the extracted terms. Please try again.' }).eq('id', contract.id);
      return jsonError('EXTRACTION_FAILED', 'Something went wrong saving the extracted terms. Please try again.', 500, true);
    }
    const { error: completedUpdateErr } = await supabaseServer.from('contracts').update({
      status: 'completed',
      detected_contract_type: result.detected_contract_type,
    }).eq('id', contract.id);
    if (completedUpdateErr) {
      // The key_terms rows ARE already durably persisted at this point (the insert above
      // succeeded) — only the contracts.status flip failed. Returning a hard error here
      // (rather than an inaccurate 200 "completed") is deliberate: the contract is left
      // at 'processing', which is NOT one of this route's own re-processable statuses
      // ('uploaded' | 'error', precondition above) — so a manual status correction (or a
      // dedicated retry-safe reconciliation job) would be needed to un-stick it. This is
      // an accepted, narrow residual gap: no PRD/eng-doc requirement demands a self-healing
      // status machine, and failing loudly here is strictly better than the silent
      // client/DB divergence this fix replaces (client would otherwise see 200/'completed'
      // while the DB row still reads 'processing').
      return jsonError('INTERNAL_ERROR', 'Your results were saved, but we could not finish updating this contract. Please refresh in a moment.', 500, true);
    }

    return NextResponse.json({
      contract_id: contract.id, status: 'completed',
      detected_contract_type: result.detected_contract_type,
      key_terms: insertedTerms,
    });
  } catch (err) {
    const message = err instanceof InvalidModelOutputError
      ? 'We could not process this contract correctly. Please try again.'
      : 'OpenAI is temporarily unavailable — try again in a few minutes.';
    // Best-effort, intentionally unchecked: unlike the two writes above (which gate what
    // the client is told, so their failure must be caught), the response codes returned
    // below are already accurate regardless of whether this particular status-flip
    // persists — the client is correctly told the operation failed either way. A failure
    // here only means the DB row itself may remain at 'processing' rather than flipping
    // to 'error' (same narrow residual gap as the 'completed' case above), not a false
    // response to the caller.
    await supabaseServer.from('contracts').update({ status: 'error', error_message: message }).eq('id', contract.id);
    if (err instanceof InvalidModelOutputError) return jsonError('INVALID_MODEL_OUTPUT', message, 422, false);
    if (err instanceof TimeoutError) return jsonError('TIMEOUT', message, 504, true); // all 3 retry attempts timed out (lib/openai/withTimeout.ts, docs/specs/00-overview-and-conventions.md)
    return jsonError('OPENAI_ERROR', message, 502, true);
  }
}, { rateLimitAction: 'process' }); // opts is the SECOND argument to withApiAuth — see canonical signature in docs/specs/00-overview-and-conventions.md
```

**Retry-without-re-upload:** because `contract_text` already persists, a failed `/process` call leaves the contract in `status: 'error'`, re-processable by calling this same endpoint again (its precondition explicitly allows `status = 'error'`).

## Extraction JSON schema (exact contract, per engineering doc Section 8)

```json
{
  "detected_contract_type": "nda" | "msa" | "other",
  "terms": [
    {
      "term_name": "string",
      "value": "string",
      "page_number": 1,
      "confidence_score": 0.925,
      "source_sentence": "string",
      "term_source": "standard" | "custom"
    }
  ]
}
```

`lib/validation/extractionResultSchema.ts` (zod, used both for the runtime `validateExtractionSchema()` call above and for `tests/eval/`):

```ts
export const extractionTermSchema = z.object({
  term_name: z.string().min(1),
  value: z.string(),
  page_number: z.number().int().min(1),
  confidence_score: z.number().min(0).max(1),
  source_sentence: z.string(),
  term_source: z.enum(['standard', 'custom']),
});
export const extractionResultSchema = z.object({
  detected_contract_type: z.enum(['nda', 'msa', 'other']),
  terms: z.array(extractionTermSchema),
});
```

## Prompt files

`lib/openai/prompts/nda.ts` and `lib/openai/prompts/msa.ts` each export:
- `PROMPT_VERSION` (e.g. `'nda-v1.0'`)
- The standard term list (shared with `docs/specs/03-pdf-upload-and-extraction.md`)
- 3 few-shot labelled examples (full input contract excerpt → expected JSON output) embedded directly in the system prompt string
- `buildExtractionSystemPrompt(promptFile, customTermNames: string[])`, which appends: `"Additionally extract the following custom terms using the same JSON structure, with term_source set to \"custom\": {customTermNames.join(', ')}"` when `customTermNames.length > 0`

System prompt skeleton (both files share this structure):

```
You are ContractIQ's contract extraction engine. You will be given the full text of a {NDA|MSA} contract with [PAGE N] markers indicating page boundaries.

Extract the following standard terms: {STANDARD_TERMS.join(', ')}.
{if customTermNames.length: "Also extract these custom terms: {customTermNames.join(', ')}, each with term_source: \"custom\"."}

For each term return: term_name, value (the extracted text/answer), page_number (the 1-indexed page where the value was found, from the nearest preceding [PAGE N] marker), confidence_score (a float 0.0–1.0 representing your own certainty), source_sentence (the exact verbatim sentence the value was drawn from), and term_source ("standard" or "custom").

Also return detected_contract_type: your best guess at whether this is actually an "nda", "msa", or "other" document, independent of what the user selected.

If a term is not present in the document, still include it in the array with value: "Not found in document", confidence_score: 0, and source_sentence: "".

Return ONLY a JSON object matching this exact schema, no other text:
{ "detected_contract_type": "...", "terms": [ ... ] }

Few-shot examples:
[3 labelled NDA examples embedded here] / [3 labelled MSA examples embedded here]
```

## Provider abstraction

`lib/openai/provider.ts` defines the interface `generateExtraction(contract, customTerms): Promise<ExtractionResult>` implemented by `lib/openai/providers/openai.ts`. `runExtraction()` above calls through this interface, not the OpenAI SDK directly, so `providers/anthropic.ts` or `providers/gemini.ts` can be swapped in later (per PRD Assumption 1 fallback plan) without changing the route handler.

## `Contract type mismatch` banner (frontend)

`components/results/ContractTypeMismatchBanner.tsx` renders on the results page if `contract.detected_contract_type !== null && contract.detected_contract_type !== contract.contract_type`, with copy: "This looks like it might be a different contract type — results may be less accurate."

## Edge cases

| Case | Behavior |
|---|---|
| Already-`completed` contract re-submitted to `/process` | `400 ALREADY_PROCESSED` |
| OpenAI 5xx/timeout/429 exhausts 3 retries | `contract.status = 'error'`, `502 OPENAI_ERROR` (or `504 TIMEOUT` if the per-call 20s budget is exceeded), UI shows "OpenAI is temporarily unavailable — try again in a few minutes" with a retry button that re-calls this same endpoint |
| Model returns invalid JSON twice (initial + corrective retry) | `contract.status = 'error'`, `422 INVALID_MODEL_OUTPUT` |
| Model returns a term missing `source_sentence` | Route handler forces `confidence_score = 0` for that term server-side before insert (per PRD "a term with no supporting sentence is treated as unreliable") — the model's self-reported confidence for that term is discarded |
| `detected_contract_type` differs from user-selected `contract_type` | Extraction still proceeds and is stored; UI shows `ContractTypeMismatchBanner` — soft warning only, not a rejection (PRD: "graceful degradation") |
| Non-contract document uploaded (e.g. invoice) | Model extracts what it can; most/all terms return low confidence; UI shows ⚠️ warnings broadly, consistent with PRD Section 11 "Consequences of bad input" |
| Rate limit exceeded (20 calls/hour) | `429 RATE_LIMITED` before any OpenAI call is made (checked in `withApiAuth`) |

## Cost & performance targets

- ≤ $0.20 per 20-page extraction (~15,000 input tokens + ≤2,000 output tokens at $0.005/1k input + $0.015/1k output ≈ $0.097 typical) — logged per-call via `lib/openai/usageLogger.ts` (`docs/specs/13-rate-limiting-and-cost-control.md`).
- ≤20s per OpenAI call P95; combined with upload (`docs/specs/03-pdf-upload-and-extraction.md`), total upload→results ≤30s P95.

## Data-use / no-training configuration

Every OpenAI call (this route and `docs/specs/09-contract-chat-and-realtime.md`) sets `user: sha256(userId)` — a hash, never the raw Supabase `user_id` — for OpenAI-side abuse monitoring without exposing ContractIQ's internal identifiers. Separately, the OpenAI **organization account** (dashboard-level setting, not a per-request API parameter) must be configured for zero data retention / no training on API inputs before any production contract data is sent, satisfying PRD's "no contract content used to train third-party models." This account-level configuration is a one-time procurement/ops task tracked alongside the other legal/DPA dependencies in `docs/specs/02-beta-access-and-launch-gates.md` — it is not something application code can enforce or verify at runtime.
