# 00 — Overview & Shared Conventions

Cross-cutting conventions referenced by every other spec file in `docs/specs/`. Read this file first.

## Source documents

- `docs/ContractIQ_PRD.md` (v1.0) — product requirements
- `docs/engineering/engineering-doc.md` — approved architecture (Next.js 14 App Router + TypeScript, Next.js Route Handlers on Netlify Functions, single Supabase Postgres project with RLS, OpenAI GPT-4o, Netlify Scheduled Functions)

## Tech stack (fixed, do not re-litigate)

- **Frontend:** Next.js 14 App Router, TypeScript, React 18 (Server + Client Components), Tailwind CSS, `shadcn/ui`, TanStack Query, Zustand (`lib/store/uiStore.ts`), `@supabase/ssr`
- **Backend:** Next.js Route Handlers under `app/api/**/route.ts`, deployed as Netlify Functions via the Netlify Next.js Runtime
- **Scheduled jobs:** Netlify Scheduled Functions under `netlify/functions/*.ts`, using the Supabase service-role client
- **Database/Auth/Storage/Realtime:** Single Supabase project (Postgres + RLS, Supabase Auth email/password, Supabase Storage, Realtime Postgres Changes)
- **AI:** OpenAI GPT-4o via Chat Completions API, JSON mode for extraction
- **PDF:** `pdf-parse` (server-side text extraction), PDF.js (client-side rendering)
- **Email:** Resend (incident notifications)
- **Monitoring:** Uptime Robot, Instatus (status page), Slack webhooks

## Folder structure

See `docs/engineering/engineering-doc.md` Section 11 for the full tree. All file paths referenced in these specs match that tree exactly.

## Standardized API error envelope

Every Route Handler under `app/api/**` returns this shape on failure, and only this shape — **with exactly one documented exception:** `GET /api/health` (`docs/specs/16-incident-response-and-monitoring.md`) is unauthenticated, unwrapped by `withApiAuth`, and returns a bare `{ "status": "ok" | "degraded" }` body instead of this envelope, since it must remain reachable and machine-parseable by Uptime Robot without a session and without the auth-shaped error semantics below.

```ts
// types/domain.ts
export type ApiErrorCode =
  | 'INVALID_FILE_TYPE' | 'FILE_TOO_LARGE' | 'INVALID_CONTRACT_TYPE'
  | 'SCANNED_PDF_UNSUPPORTED' | 'TOO_MANY_PAGES' | 'CONTRACT_TOO_LONG'
  | 'EXTRACTION_FAILED' | 'ALREADY_PROCESSED' | 'INVALID_MODEL_OUTPUT'
  | 'INVALID_MESSAGE' | 'CONTRACT_NOT_PROCESSED' | 'CHAT_HISTORY_LIMIT_REACHED'
  | 'EXPORT_GENERATION_FAILED' | 'DELETE_FAILED' | 'CONFIRMATION_REQUIRED'
  | 'ACCOUNT_DELETION_FAILED' | 'UNAUTHORIZED' | 'CONTRACT_NOT_FOUND'
  | 'RATE_LIMITED' | 'OPENAI_ERROR' | 'TIMEOUT' | 'INTERNAL_ERROR';

export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;      // human-readable, safe to render directly in a toast/banner
    retryable: boolean;
    fields?: Record<string, string>; // present only on zod validation failures, see below
  };
}
```

**There is no generic `VALIDATION_ERROR` fallback code in this project.** Every route that performs zod validation already has a domain-specific `ApiErrorCode` for its validation failure (`INVALID_CONTRACT_TYPE` for `POST /api/contracts`'s `contract_type` field, `INVALID_MESSAGE` for chat's `message` field, `CONFIRMATION_REQUIRED` for account deletion's `confirm` field, etc.) — each spec file's zod schema failure maps to that route's specific code, never a generic one, so `ApiErrorCode` intentionally has no catch-all validation member. `fields` (zod's `error.flatten().fieldErrors`) is still populated on any of these domain-specific validation failures when the underlying error has field-level detail worth surfacing (e.g. a future multi-field form), not just on a dedicated code.

HTTP status code mapping (used consistently across every route spec):

| Code | HTTP status | retryable |
|---|---|---|
| `INVALID_FILE_TYPE` | 400 | false |
| `FILE_TOO_LARGE` | 400 | false |
| `INVALID_CONTRACT_TYPE` | 400 | false |
| `INVALID_MESSAGE` | 400 | false |
| `ALREADY_PROCESSED` | 400 | false |
| `CONFIRMATION_REQUIRED` | 400 | false |
| `UNAUTHORIZED` | 401 | false |
| `CONTRACT_NOT_FOUND` | 404 | false |
| `CONTRACT_NOT_PROCESSED` | 409 | false |
| `SCANNED_PDF_UNSUPPORTED` | 422 | false |
| `TOO_MANY_PAGES` | 422 | false |
| `CONTRACT_TOO_LONG` | 422 | false |
| `INVALID_MODEL_OUTPUT` | 422 | false |
| `CHAT_HISTORY_LIMIT_REACHED` | 422 | false |
| `RATE_LIMITED` | 429 | true |
| `EXTRACTION_FAILED` | 500 | true |
| `DELETE_FAILED` | 500 | true |
| `ACCOUNT_DELETION_FAILED` | 500 | true |
| `EXPORT_GENERATION_FAILED` | 500 | true |
| `OPENAI_ERROR` | 502 | true |
| `TIMEOUT` | 504 | true |
| `INTERNAL_ERROR` | 500 | true |

## `jsonError()` helper (`lib/api/jsonError.ts`)

The single function every Route Handler calls to construct the standardized error envelope above. Every call site across every spec file (`docs/specs/00`, `03`, `04`, `09`, `12`, `14`, etc.) uses this exact signature and argument order:

```ts
export function jsonError(
  code: ApiErrorCode,
  message: string,
  httpStatus: number,
  retryable: boolean,
  fields?: Record<string, string>,
): NextResponse {
  return NextResponse.json({ error: { code, message, retryable, ...(fields ? { fields } : {}) } }, { status: httpStatus });
}
```

`fields` is the optional 5th argument, populated only on the rare zod-validation failure whose underlying error has field-level detail worth surfacing to the client (per "Request validation" below). Concretely, in `docs/specs/03-pdf-upload-and-extraction.md`, the `uploadContractSchema.safeParse` failure branch passes it:

```ts
const parsed = uploadContractSchema.safeParse({ contractType });
if (!parsed.success) {
  return jsonError('INVALID_CONTRACT_TYPE', 'Contract type must be NDA or MSA.', 400, false, parsed.error.flatten().fieldErrors);
}
```

Every other `jsonError(...)` call site in this project omits the 5th argument (the failure has no meaningful field-level breakdown beyond its single error code/message — e.g. `RATE_LIMITED`, `CONTRACT_NOT_FOUND`), which is why most call sites shown throughout `docs/specs/` are written with exactly 4 arguments; that is the expected, normal form for those routes, not an inconsistency with this signature.

## `supabaseServer` — the Route Handler Supabase client (`lib/supabase/server.ts`)

Every Route Handler DB write/read shown throughout `docs/specs/` (`03`, `04`, `09`, `13`, `14`, etc.) uses a symbol called `supabaseServer`. **This is a session-bound, RLS-enforced client — never a service-role client** — created fresh inside every Route Handler invocation via:

```ts
// lib/supabase/server.ts
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // anon key — NOT the service-role key. RLS is fully enforced on every call made through this client.
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => cookieStore.set({ name, value, ...options }),
        remove: (name, options) => cookieStore.set({ name, value: '', ...options }),
      },
    },
  );
}
```

Every route handler body calls `const supabaseServer = createSupabaseServerClient();` once near the top (this is the literal, unabbreviated meaning of the bare `supabaseServer` symbol used everywhere else in `docs/specs/` — it is shorthand for this call, not a module-level singleton). Because it's built via Next.js App Router's `cookies()` (from `next/headers`), it correctly reads the *current request's* session cookies even though `cookies()` takes no explicit request argument — Next.js binds it to the in-flight request via its own per-request async context, so a fresh call inside each Route Handler invocation is always scoped to that invocation's caller, not shared or stale across concurrent requests. This is a **separate client instance** from the one `withApiAuth` creates internally to resolve `session`/`userId` (`docs/specs/00-overview-and-conventions.md`'s `withApiAuth()` section, above) — both instances are constructed the same way and both resolve to the same request's cookies, so they are equivalent in what they're authorized to do, just not the same JS object.

**Why this reconciles with engineering doc Section 6's "RLS is the source of truth... Route Handlers additionally re-verify ownership as defense-in-depth":** because `supabaseServer` carries the calling user's session (not a service-role bypass), every insert/update/select made through it is still subject to the exact same RLS policies as a direct-from-browser `supabase-js` call (`docs/specs/supabase-schema.sql`) — e.g. `key_terms_insert_own` still requires `auth.uid() = user_id` on the `POST /api/contracts/{id}/process` insert in `docs/specs/04-key-term-extraction.md`. The `loadContractOwnedBy()`/ownership-check pattern (`docs/specs/00-overview-and-conventions.md`, "Ownership re-verification") is explicitly *defense-in-depth on top of* this RLS enforcement, not a replacement for it — both layers are real and both are active on every Route Handler request.

**The only client in this project that bypasses RLS** is the service-role `admin` client (`lib/supabase/admin.ts`, `createAdminClient()`), used exclusively where the engineering doc's architecture calls for it: Netlify Scheduled Functions (`docs/specs/13`, `14`), account deletion (`docs/specs/12-account-settings-and-privacy.md`), and the beta-cohort grant RPC (`docs/specs/01-auth-and-session.md`). Every other backend DB call in this project — every `supabaseServer` call — is RLS-enforced.

## `withApiAuth()` higher-order handler

`lib/api/withApiAuth.ts` wraps every authenticated Route Handler:

```ts
type Handler = (req: NextRequest, ctx: { userId: string; params: any }) => Promise<Response>;

export function withApiAuth(handler: Handler, opts?: { rateLimitAction?: 'process' | 'chat' }) {
  return async (req: NextRequest, ctx: { params: any }) => {
    const supabase = createServerClient(/* cookies from req */);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return jsonError('UNAUTHORIZED', 'You must be signed in to do this.', 401, false);
    }
    if (opts?.rateLimitAction) {
      const limited = await checkLimit(session.user.id, opts.rateLimitAction);
      if (limited) {
        return jsonError('RATE_LIMITED', "You've made too many requests. Please wait a few minutes and try again.", 429, true);
      }
    }
    try {
      return await handler(req, { userId: session.user.id, params: ctx.params });
    } catch (err) {
      return mapUnhandledErrorToEnvelope(err); // logs + returns a 500 envelope as last resort
    }
  };
}
```

Every route spec below assumes this wrapper is applied and does not re-describe session/auth-failure handling per route. **Signature is fixed: `withApiAuth(handler, opts?)` — the handler is always the first argument, `opts` (if any) is always the second.** Every call site in every spec file must match this order exactly; a call written as `withApiAuth(opts, handler)` is a spec bug, not an alternate valid form.

### `mapUnhandledErrorToEnvelope()` (`lib/api/mapUnhandledErrorToEnvelope.ts`) and `INTERNAL_ERROR`

The last-resort catch inside `withApiAuth` above, for any error a handler *throws* rather than explicitly returning as a `jsonError(...)` response (e.g. an unexpected exception from a Supabase call, a bug, or any other truly unanticipated failure):

```ts
export function mapUnhandledErrorToEnvelope(err: unknown): NextResponse {
  console.error('Unhandled Route Handler error:', err); // Netlify Function invocation logs, docs/specs/16-incident-response-and-monitoring.md
  return jsonError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500, true);
}
```

`INTERNAL_ERROR` (500, retryable) is the generic code this produces, and is also used **directly** (not via a throw) at the small number of call sites elsewhere in this project where a Supabase write fails in a way that has no more specific `ApiErrorCode` available and is not itself the endpoint's primary domain (e.g. the `chat_messages` user-message insert failing for a reason other than the 200-message-cap trigger, `docs/specs/09-contract-chat-and-realtime.md`) — those call sites construct `jsonError('INTERNAL_ERROR', ..., 500, true)` explicitly rather than relying on an uncaught throw, so the failure is handled inline (e.g. contract status can still be updated first) rather than silently propagating past other cleanup logic. This is distinct from `EXTRACTION_FAILED`, which is reserved for failures that are specifically part of the PDF-upload/extraction or key-term-persistence domain (`docs/specs/03-pdf-upload-and-extraction.md`, `docs/specs/04-key-term-extraction.md`) — using `EXTRACTION_FAILED` for an unrelated route (e.g. chat) would be a domain-code mismatch, which is exactly why `INTERNAL_ERROR` exists as the generic option.

## OpenAI per-call timeout enforcement (`lib/openai/withTimeout.ts`)

Implements the engineering doc's "≤20 seconds per OpenAI call P95" Model Requirement and the documented `504 TIMEOUT` error response on both `POST /api/contracts/{id}/process` (`docs/specs/04-key-term-extraction.md`) and `POST /api/contracts/{id}/chat` (`docs/specs/09-contract-chat-and-realtime.md`). Every OpenAI SDK call in this project is wrapped with an explicit timeout, not left to the SDK's own default (which has no fixed relationship to the PRD's 20s budget):

```ts
export class TimeoutError extends Error {}

export async function withTimeout<T>(promiseFactory: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await promiseFactory(controller.signal);
  } catch (err: any) {
    if (err?.name === 'AbortError' || controller.signal.aborted) throw new TimeoutError(`OpenAI call exceeded ${ms}ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
```

Usage pattern (both `lib/openai/extraction.ts` and `lib/openai/chat.ts` follow this exact shape): each OpenAI SDK call is made as `withTimeout((signal) => openai.chat.completions.create({ ...params }, { signal }), 20_000)`, and this call is itself what gets passed to `withRetry()` for the 3x exponential-backoff retry loop — a `TimeoutError` on any individual attempt is retried like any other transient failure; only if all 3 attempts either time out or otherwise fail does the route handler catch a final error and choose between `502 OPENAI_ERROR` (non-timeout failure) and `504 TIMEOUT` (`err instanceof TimeoutError`) as shown in the route handler code in `docs/specs/04-key-term-extraction.md` and `docs/specs/09-contract-chat-and-realtime.md`.

## Retry with exponential backoff (`lib/openai/withRetry.ts`)

Implements the PRD's and engineering doc's explicit "3 retries with exponential backoff (1s/2s/4s) for transient errors (5xx, timeout, `429` from OpenAI itself)" requirement (engineering doc Section 6 "Error handling," Section 8 "Fallback behavior on OpenAI outage"). Used by every OpenAI call site (`lib/openai/extraction.ts`, `lib/openai/chat.ts`) wrapping a `withTimeout(...)`-wrapped call, per the usage pattern above.

```ts
const RETRYABLE_STATUS_CODES = new Set([408, 409, 429, 500, 502, 503, 504]);

function isRetryable(err: any): boolean {
  if (err instanceof TimeoutError) return true; // treated as transient — see withTimeout above
  const status = err?.status ?? err?.response?.status;
  return typeof status === 'number' && RETRYABLE_STATUS_CODES.has(status);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts: number; backoffMs: number[] } // backoffMs.length must be attempts - 1
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < opts.attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // Non-retryable errors (e.g. a 400 — malformed request, or any error not in
      // RETRYABLE_STATUS_CODES / not a TimeoutError) fail fast on the FIRST attempt —
      // they are never retried, since retrying a deterministically-failing request
      // only burns the 20s-per-call / 30s-total-flow budget for no benefit.
      if (!isRetryable(err)) throw err;
      if (attempt < opts.attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, opts.backoffMs[attempt]));
      }
    }
  }
  throw lastErr;
}
```

**Non-transient errors are never retried.** A `400` (malformed request — e.g. a prompt-assembly bug) or any other OpenAI error not in `RETRYABLE_STATUS_CODES` propagates immediately on the first attempt via `throw err` inside the `catch` block, before any `setTimeout` backoff runs — this is what keeps a genuinely fatal error from wastefully consuming all 3 attempts and blowing the 20s-per-call / 30s-total-flow latency budgets referenced throughout `docs/specs/04-key-term-extraction.md` and `docs/specs/09-contract-chat-and-realtime.md`. `TimeoutError` (from the nested `withTimeout` call) and any 5xx/408/409/429 are the only conditions retried, matching "transient errors (5xx, timeout, 429)" verbatim from the engineering doc.

## Domain-specific error classes (`lib/openai/errors.ts`)

Two custom `Error` subclasses, alongside `TimeoutError` above, are thrown internally by `lib/openai/extraction.ts` and caught by the route handlers to select the correct error-envelope code:

```ts
export class InvalidModelOutputError extends Error {} // thrown when the model's JSON fails schema validation after the single corrective retry (docs/specs/04-key-term-extraction.md) — maps to 422 INVALID_MODEL_OUTPUT
```

`TimeoutError` (declared above) and `InvalidModelOutputError` are imported by both `lib/openai/extraction.ts` and the `app/api/contracts/{id}/process/route.ts` / `app/api/contracts/{id}/chat/route.ts` route handlers wherever `err instanceof ...` checks are used.

## Ownership re-verification (defense in depth)

For every route that loads a resource by ID (contract, chat session), after the Supabase query the handler must check `resource.user_id === ctx.userId` and return `CONTRACT_NOT_FOUND` (404) — not `UNAUTHORIZED` — if it does not match. Returning 404 instead of 403 avoids confirming the resource exists to a non-owner.

### `loadContractOwnedBy()` (`lib/api/loadContractOwnedBy.ts`)

The shared helper that implements the rule above for every contract-scoped route (`docs/specs/04-key-term-extraction.md`, `docs/specs/09-contract-chat-and-realtime.md`, `docs/specs/14-retention-and-deletion.md`). It returns `null` on a missing-or-not-owned contract — it does **not** throw — so the caller's `404 CONTRACT_NOT_FOUND` is always an explicit, visible `if` check in the route handler, never dependent on `withApiAuth`'s catch-all `mapUnhandledErrorToEnvelope` (which is a last-resort `500` for genuinely unexpected errors, not the mechanism for an expected "not found" outcome):

```ts
export async function loadContractOwnedBy(contractId: string, userId: string): Promise<Contract | null> {
  const { data: contract } = await supabaseServer.from('contracts').select('*').eq('id', contractId).maybeSingle();
  if (!contract || contract.user_id !== userId) return null;
  return contract;
}
```

Every call site follows this exact pattern immediately after the call:

```ts
const contract = await loadContractOwnedBy(params.contractId, userId);
if (!contract) return jsonError('CONTRACT_NOT_FOUND', 'Contract not found.', 404, false);
```

This two-line pattern (call + explicit null-check-and-return) is what every "Contract exists and `contract.user_id === userId` → else `404 CONTRACT_NOT_FOUND`" precondition bullet elsewhere in this project means concretely — the precondition prose is shorthand for these two lines, not for relying on an exception path.

## Request validation

All Route Handler JSON bodies are validated with `zod` schemas in `lib/validation/*.ts`. On failure, return `400` with that route's domain-specific `ApiErrorCode` (see "There is no generic `VALIDATION_ERROR` fallback code" above) and, where the underlying zod error has field-level detail worth surfacing, `fields` populated from `error.flatten().fieldErrors`.

## Direct-Supabase-client operations

Several operations (listed per-feature in later spec files) are performed directly from the browser via `supabase-js`, relying on Postgres RLS as the sole authorization boundary — no Route Handler exists for these. This is intentional (per engineering doc Section 9) to keep latency low and the backend surface minimal. Every such operation is still documented with its exact table, exact query shape, and exact RLS policy it depends on (defined in `docs/specs/supabase-schema.sql`).

## Naming conventions (verbatim from engineering doc Section 12)

| Category | Convention | Example |
|---|---|---|
| Component files | PascalCase | `KeyTermsPanel.tsx` |
| Non-component files | camelCase | `extractText.ts` |
| Folders | kebab-case | `rate-limit/` |
| Hooks | camelCase, `use` prefix | `useChatSession.ts` |
| DB tables | snake_case, plural | `key_terms` |
| DB triggers | `trg_` prefix | `trg_capture_term_correction` |
| Env vars | SCREAMING_SNAKE_CASE, `NEXT_PUBLIC_` only if client-exposed | `OPENAI_API_KEY` |

## Design system

Every component built from these specs must apply `/design-system` (Stage 4 rule) — colors, spacing, typography sourced from `docs/design.md`. Component specs below describe structure, state, and data contracts, not visual styling.

## Glossary of shared types

```ts
// types/domain.ts
export interface KeyTerm {
  id: string;
  contract_id: string;
  custom_term_id: string | null;
  term_source: 'standard' | 'custom';
  term_name: string;
  value: string;
  page_number: number;
  confidence_score: number; // 0–100
  source_sentence: string;
  is_edited: boolean;
  original_ai_value: string | null;
  edited_at: string | null;
  created_at: string;
}

export interface Contract {
  id: string;
  user_id: string;
  filename: string;
  contract_type: 'nda' | 'msa';
  detected_contract_type: 'nda' | 'msa' | 'other' | null;
  status: 'uploaded' | 'processing' | 'completed' | 'error';
  error_message: string | null;
  page_count: number;
  token_count: number;
  file_size_bytes: number;
  file_path: string | null;
  storage_upload_failed: boolean;
  file_purged_at: string | null;
  last_accessed_at: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  chat_session_id: string;
  role: 'user' | 'assistant';
  content: string;
  page_citation: number | null;
  created_at: string;
}
```
