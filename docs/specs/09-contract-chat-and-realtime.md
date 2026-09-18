# 09 — Contract Chat (Q&A) & Realtime Delivery

Implements PRD US-007, US-012, FR-08, FR-09; PRD Section 7 (Grounding Strategy), Section 8 (Prompt Strategy), Section 9 (Chat-layer guardrails); engineering doc Flow 4, Section 6 (Realtime), Section 8 (query classification), Section 9 `POST /api/contracts/{contractId}/chat`.

## Frontend: `components/chat/ChatPanel.tsx`

- Opens as a sidebar tab on desktop (≥1024px) or a full-screen tab on mobile.
- On first open (mount): loads or creates the chat session, loads prior messages, opens a Realtime subscription.

```ts
// hooks/useChatSession.ts
export function useChatSession(contractId: string) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    (async () => {
      setSessionError(null);
      const { data: session, error: selectErr } = await supabase.from('chat_sessions').select('*').eq('contract_id', contractId).maybeSingle();
      if (selectErr) {
        setSessionError('Could not load this conversation. Please refresh.');
        return;
      }
      if (session) {
        setSessionId(session.id);
        return;
      }
      const { data: created, error: insertErr } = await supabase.from('chat_sessions').insert({ contract_id: contractId, user_id: userId }).select().single();
      if (insertErr || !created) {
        setSessionError('Could not start a new conversation. Please refresh.');
        return;
      }
      setSessionId(created.id);
    })();
  }, [contractId]);

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`chat-${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `chat_session_id=eq.${sessionId}`,
      }, (payload) => {
        queryClient.setQueryData(['chat-messages', sessionId], (old: ChatMessage[] = []) => {
          if (old.some((m) => m.id === payload.new.id)) return old; // de-dupe against optimistic insert
          return [...old, payload.new as ChatMessage];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const messagesQuery = useQuery({
    queryKey: ['chat-messages', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase.from('chat_messages').select('*').eq('chat_session_id', sessionId).order('created_at', { ascending: true }).limit(200);
      if (error) throw error; // matches the useContract/useKeyTerms read pattern, docs/specs/07-results-viewer.md — surfaces as messagesQuery.isError rather than a silently empty list
      return data as ChatMessage[];
    },
    enabled: !!sessionId,
  });

  return {
    sessionId,
    sessionError, // set when the chat_sessions lookup/create itself fails — distinct from a message-load failure
    messages: messagesQuery.data ?? [],
    isLoading: messagesQuery.isLoading,
    messagesError: messagesQuery.isError,
  };
}
```

`ChatPanel.tsx` renders a distinct inline error state — "Could not load this conversation. Please refresh." — when `sessionError` is set (chat session itself never established) or when `messagesError` is `true` (session exists but the message history failed to load), instead of silently showing an empty conversation in either case.

RLS dependency: `chat_sessions_select_own`/`chat_sessions_insert_own`, `chat_messages_select_own`. Realtime Postgres Changes respects `chat_messages_select_own` (`auth.uid() = user_id`), so only the owning user's browser receives INSERT events even though the channel filter itself only scopes by `chat_session_id`.

## Sending a message

```tsx
async function sendMessage(text: string) {
  const optimisticId = crypto.randomUUID();
  appendOptimisticMessage({ id: optimisticId, role: 'user', content: text, created_at: new Date().toISOString(), page_citation: null });

  const res = await fetch(`/api/contracts/${contractId}/chat`, {
    method: 'POST',
    // `id: optimisticId` is required, not cosmetic — the server inserts the
    // user's chat_messages row with this exact id (chatMessageSchema.ts,
    // route.ts), so the Realtime INSERT event for it carries the same id as
    // the optimistic bubble already rendered here. Omitting it means the
    // dedup check below never matches (a fresh, different id is generated
    // server-side instead) and the user's own message renders twice — a real
    // regression caught in manual testing before this field existed.
    body: JSON.stringify({ message: text, id: optimisticId }),
  });

  if (!res.ok) {
    const err = await res.json();
    showInlineError(err.error.message); // e.g. rate-limit or history-cap message
    removeOptimisticMessage(optimisticId);
    return;
  }
  // The assistant response also arrives via the Realtime subscription above;
  // the fetch response itself is not separately rendered to avoid duplicate bubbles —
  // reconciliation is keyed by message id, and the Realtime INSERT event for the
  // *user* message (already optimistically shown) is de-duplicated by the same check.
}
```

## `POST /api/contracts/{contractId}/chat`

Wrapped in `withApiAuth(handler, { rateLimitAction: 'chat' })` (handler first, opts second — canonical signature defined in `docs/specs/00-overview-and-conventions.md`) — 60 calls/user/rolling hour.

**Request:** `{ "message": "string (1–2000 chars)", "id": "uuid (optional)" }`, validated by `lib/validation/chatMessageSchema.ts`:

```ts
export const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty.').max(2000, 'Message must be 2000 characters or fewer.'),
  id: z.string().uuid().optional(), // client's optimistic-message id — see "Sending a message" above
});
```

**Preconditions:** contract exists and owned by caller (else `404`); `contract.status === 'completed'` (else `409 CONTRACT_NOT_PROCESSED`).

**Conversation Memory Layer** — the handler resolves *what context to send* before it does anything else:

1. **Classify** the incoming message into `contract` | `history` | `both` via `classifyQuery()` (`lib/openai/prompts/chatSystemPrompt.ts`) — a keyword classifier over the raw message text (contract-content keywords vs. conversation-referencing keywords).
2. **Retrieve** prior history from the database — a `contract`/`both` classification loads the last 10 messages (`CONTRACT_TURN_LIMIT`); a `history` classification loads the last 20 (`HISTORY_TURN_LIMIT`), via `loadMessages(sessionId, limit)`. **This load happens before the new user message is inserted** — inserting first would fold the in-flight message into its own "history" window. The new message is appended to the OpenAI `messages` array separately, after the prior-history slice.
3. **Respond** with a system prompt matched to the classification (`buildChatSystemPrompt()`), and contract text is included in the system message only for `contract`/`both` — a `history` classification never sends `contract.contract_text` at all.
4. **Attribute** the source in the UI: the classification is persisted as `chat_messages.context_source` (`contract` | `history` | `both`, null for user rows) and returned in the response body, so `ContextSourceBadge.tsx` can render "From document" / "From conversation" / "From document & conversation" on the assistant's bubble — including after a page reload or a Realtime delivery to another tab, since it's a persisted column, not just an HTTP-response-only field.

**Handler (`lib/openai/chat.ts` orchestration):**

```ts
export const POST = withApiAuth(async (req, { userId, params }) => {
  const startedAt = Date.now(); // captured for the duration_ms KPI field, docs/specs/13-rate-limiting-and-cost-control.md
  const contract = await loadContractOwnedBy(params.contractId, userId);
  if (!contract) return jsonError('CONTRACT_NOT_FOUND', 'Contract not found.', 404, false);
  if (contract.status !== 'completed') return jsonError('CONTRACT_NOT_PROCESSED', 'This contract has not finished processing yet.', 409, false);

  const body = await req.json();
  const parsed = chatMessageSchema.safeParse(body);
  if (!parsed.success) return jsonError('INVALID_MESSAGE', parsed.error.issues[0].message, 400, false);

  const session = await getOrCreateChatSession(contract.id, userId);

  // Classification and history retrieval happen BEFORE the insert below —
  // see "Conversation Memory Layer" above.
  const classification = classifyQuery(parsed.data.message); // 'contract' | 'history' | 'both'
  const turnLimit = classification === 'history' ? HISTORY_TURN_LIMIT : CONTRACT_TURN_LIMIT; // 20 : 10
  const priorHistory = await loadMessages(session.id, turnLimit); // ascending, does NOT include the new message
  const includeContractText = classification !== 'history';
  const systemPrompt = buildChatSystemPrompt(classification);
  const systemContent = includeContractText
    ? `${systemPrompt}\n\nDocument text:\n${contract.contract_text}`
    : systemPrompt;

  const { error: insertErr } = await supabaseServer.from('chat_messages').insert({
    chat_session_id: session.id, user_id: userId, role: 'user', content: parsed.data.message,
  });
  if (insertErr) {
    // Distinguish the specific 200-message-cap trigger rejection (a real, user-facing,
    // expected outcome) from every OTHER insert failure (network blip, transient DB
    // error, etc.) — the latter must not be silently swallowed and fall through to
    // calling OpenAI as if the user's message had been saved, per the engineering doc's
    // "no silent failures... no request fails without either a successful response or a
    // user-visible error state" rule (Section 6). This mirrors the generic
    // `if (insertErr || !data)` pattern already used for the `contracts` insert
    // (docs/specs/03-pdf-upload-and-extraction.md) and the `key_terms` insert
    // (docs/specs/04-key-term-extraction.md) — every insert failure is handled, not just
    // the one this project happens to have a specific error code for.
    if (insertErr.message.includes('Maximum 200 chat messages')) {
      return jsonError('CHAT_HISTORY_LIMIT_REACHED', "You've reached the chat history limit for this contract.", 422, false);
    }
    return jsonError('INTERNAL_ERROR', 'Something went wrong sending your message. Please try again.', 500, true); // generic DB-write failure, not chat-domain-specific — see docs/specs/00-overview-and-conventions.md
  }

  let raw;
  try {
    // Wrapped with the shared 20s per-call timeout (lib/openai/withTimeout.ts,
    // docs/specs/00-overview-and-conventions.md) inside the retry loop, exactly as in
    // docs/specs/04-key-term-extraction.md — a TimeoutError on one attempt is retried
    // like any other transient failure.
    raw = await withRetry(() => withTimeout((signal) => openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.4,
      max_tokens: 1000,
      user: sha256(userId),
      messages: [
        { role: 'system', content: systemContent },
        ...priorHistory.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: parsed.data.message }, // the in-flight message, appended manually — it is not part of priorHistory
      ],
    }, { signal }), 20_000), { attempts: 3, backoffMs: [1000, 2000, 4000] });
  } catch (err) {
    const message = 'OpenAI is temporarily unavailable — try again in a few minutes.';
    if (err instanceof TimeoutError) return jsonError('TIMEOUT', message, 504, true); // all 3 retry attempts timed out
    return jsonError('OPENAI_ERROR', message, 502, true);
  }

  let content = raw.choices[0].message.content ?? '';
  let pageCitation: number | null = null;
  if (classification !== 'history') {
    const citationMatch = content.match(/\[Page (\d+)\]/);
    if (citationMatch) pageCitation = Number(citationMatch[1]);
    else if (classification === 'contract') content += ' (Page reference unavailable)'; // only enforced when the prompt mandated a citation
  }

  // logUsage() is called BEFORE the assistant-message insert, and unconditionally on this
  // path — the OpenAI call already succeeded and was billed at this point, regardless of
  // whether the subsequent DB insert below succeeds. Deferring this call until after the
  // insert (or making it conditional on the insert's success) would silently skip cost
  // logging for a call that genuinely happened and genuinely cost money, contradicting
  // docs/specs/13-rate-limiting-and-cost-control.md's "called after every successful
  // OpenAI call" invariant and engineering doc Section 8's usage-logging requirement.
  await logUsage({ userId, contractId: contract.id, operation: 'chat', promptVersion: CHAT_PROMPT_VERSION, usage: raw.usage, durationMs: Date.now() - startedAt });

  const { data: assistantMsg, error: assistantInsertErr } = await supabaseServer.from('chat_messages').insert({
    chat_session_id: session.id, user_id: userId, role: 'assistant', content, page_citation: pageCitation, context_source: classification,
  }).select().single();
  if (assistantInsertErr || !assistantMsg) {
    // The 200-message cap (trg_enforce_max_chat_messages) can legitimately trip HERE even
    // though the user-message insert above succeeded — the user message itself may have
    // been message #200, making the assistant reply message #201. This is a real,
    // foreseeable outcome (not just a generic transient-error case), so it gets the same
    // specific CHAT_HISTORY_LIMIT_REACHED handling as the user-message insert, not a
    // generic fallback that would hide the real cause from the user.
    if (assistantInsertErr?.message.includes('Maximum 200 chat messages')) {
      return jsonError('CHAT_HISTORY_LIMIT_REACHED', "You've reached the chat history limit for this contract.", 422, false);
    }
    return jsonError('INTERNAL_ERROR', 'We got a response but could not save it. Please refresh and check your chat history.', 500, true);
  }

  return NextResponse.json({
    message_id: assistantMsg.id, role: 'assistant', content, page_citation: pageCitation, context_source: classification, created_at: assistantMsg.created_at,
  });
}, { rateLimitAction: 'chat' }); // opts is the SECOND argument to withApiAuth — see canonical signature in docs/specs/00-overview-and-conventions.md
```

`CHAT_PROMPT_VERSION` (`'chat-v2.3'` — `v1.0` was the single always-both-context prompt; `v2.0` split it into three classification-specific prompts; `v2.1` added the not-found fallback; `v2.2` added the no-restate instruction; `v2.3` added the light-interpretation allowance below, a deliberate product decision, not a bug fix) is exported from `lib/openai/prompts/chatSystemPrompt.ts` alongside `buildChatSystemPrompt()`, analogous to the `PROMPT_VERSION` constant each extraction prompt file (`lib/openai/prompts/nda.ts`, `msa.ts`) exports per `docs/specs/04-key-term-extraction.md` — incremented on every content change to the base system prompt string(s) and logged alongside every `openai_usage_log` row for traceability of which prompt version produced which chat response.

**Delivery model:** both the user and assistant `chat_messages` rows are written server-side and delivered to the UI via the Realtime subscription (canonical path, multi-tab safe); the HTTP response body is an immediate optimistic-UI confirmation for the tab that issued the request only.

## System prompts (Conversation Memory Layer, one per `QueryClassification`)

> **Supersedes PRD Assumption 14.** The original single system prompt below always sent the document text *and* full conversation history together, regardless of classification. The Conversation Memory Layer instead selects one of three prompts and either includes or drops the document text based on classification — a `history`-classified question never sees `contract.contract_text`.

```
contract: "Answer only from the contract. Cite [Page X]. If the answer is not in the document, say \"I cannot find this in the document.\" You may briefly explain in plain language what an already-stated fact means in practice, but do not introduce any information beyond what is explicitly stated, and do not provide legal advice. Do not restate or repeat the question in your response — answer it directly."
history:  "Answer only from the conversation. End with [From conversation]. Do not restate or repeat the question in your response — answer it directly."
both:     "Answer from both. Attribute each fact to its source. If the answer is not in the document, say \"I cannot find this in the document.\" You may briefly explain in plain language what an already-stated fact means in practice, but do not introduce any information beyond what is explicitly stated, and do not provide legal advice. Do not restate or repeat the question in your response — answer it directly."
```

`classifyQuery()` (`lib/openai/prompts/chatSystemPrompt.ts`) is a regex/keyword classifier over the raw message text, checked in this order:
1. `FOLLOWUP_KEYWORDS` ("what does that mean", "explain that", "elaborate", "in practice", etc.) → always `both`, regardless of the other two lists. These are ambiguous pronoun-based continuations with no named antecedent — routing them to `history` would drop the document entirely for what's very often actually a content question, so `both` is the safe default: it never costs grounding on a false positive, since contract text is always included alongside history.
2. `CONTRACT_KEYWORDS` (contract/clause/page/term/liability/termination/etc.) vs. `HISTORY_KEYWORDS` (earlier/before/we discussed/mentioned/etc.) — both match → `both`; only history keywords match → `history`; otherwise → `contract` (the default).

Retrieval and prompt selection both key off this same classification — see "Conversation Memory Layer" above.

Three regressions surfaced in manual testing against the bare `chat-v2.0` prompts and classifier, each from a gap the terse initial design left unhandled:
- **Not-found fallback (`chat-v2.1`):** with no instruction for what to do when the document doesn't contain the answer, the model had nothing better to fall back to. Only added to `contract`/`both`, since `history` never has document text to search in the first place.
- **No-restate instruction (`chat-v2.2`):** with no specified opening, the model defaulted to restating the question as a preamble before answering it — even on a *correctly-found* answer (e.g. "what is the governing law" → "What is the governing law? The governing law is the laws of the State of Delaware. [Page 6]" all as one response). `chat-v2.1` alone did not fix this, since it only addressed the not-found case, not the restating habit — the two are unrelated. Added to all three prompts, since the habit isn't specific to one context type.
- **`FOLLOWUP_KEYWORDS` classifier path:** "what does that mean in practice," asked right after a governing-law answer, matched neither `CONTRACT_KEYWORDS` nor `HISTORY_KEYWORDS` and defaulted to `contract` — so the model, told to "answer only from the contract," couldn't resolve "that" against the prior turn even though it was present in the message array. This looked like "conversation memory isn't working" but was purely a classification gap, not a retrieval or prompt bug.

The `(Page reference unavailable)` fallback (route.ts) also gained a guard against double-appending: the model sometimes echoes that exact phrase itself when its own prior turns (sent back as conversation history) already contain it, and the fallback used to append a second copy on top whenever it didn't detect a `[Page X]` citation, regardless of whether the model's own text already included equivalent wording.

**Light interpretation (`chat-v2.3`) — a scope decision, not a bug fix.** After the `FOLLOWUP_KEYWORDS` fix above, "what does that mean in practice" correctly classified as `both` and correctly received both the document text and the prior "governing law" turn — but the model still answered "I cannot find this in the document," because neither source literally states what Delaware governing law *means in practice*; explaining that requires reasoning beyond verbatim retrieval, which every prompt up to `chat-v2.2` explicitly forbade. This was flagged to the user as a genuine product-scope question rather than silently patched: a strictly-grounded retrieval assistant that refuses to interpret is the safer default for a legal-document tool (avoids anything resembling legal advice), but makes plain-language follow-ups like this one unanswerable. The user chose to allow it. `LIGHT_INTERPRETATION` permits brief plain-language explanation of an already-retrieved fact while still forbidding any information not explicitly stated and explicitly forbidding legal advice — on `contract`/`both` only, since `history` is about the conversation itself, not document facts to interpret.

Other older guardrail language from the original single prompt (the "Based on the document…" prefix, the general-legal-knowledge disclaimer) remains intentionally dropped — a scope trade-off, not an oversight; watch `tests/integration/chat-hallucination.test.ts` (`docs/specs/18-testing-and-eval-strategy.md`) for further regressions.

## `PageCitationLink.tsx`

```tsx
export function PageCitationLink({ page }: { page: number }) {
  const setTargetPage = useUiStore((s) => s.setTargetPage);
  return <button onClick={() => setTargetPage(page)}>Source: Page {page}</button>;
}
```

Rendered inside `ChatMessageBubble.tsx` for any assistant message with a non-null `page_citation`.

## `ContextSourceBadge.tsx`

Renders the persisted `context_source` (`contract` | `history` | `both`) as a Semantic Status Badge (`docs/design.md`) above the assistant's bubble in `ChatMessageBubble.tsx` — Blue for "From document" (`contract`), Violet for "From conversation" (`history`), Orange for "From document & conversation" (`both`). Renders nothing for user messages or for any assistant row where `context_source` is null (rows written before this column existed).

## Chat empty state

`ChatPanel` shows "Ask a question about this contract to get started" when `messages.length === 0`.

## Edge cases

| Case | Behavior |
|---|---|
| `contract`-classified response missing `[Page X]` entirely | Regex fails to match; `" (Page reference unavailable)"` is appended to `content` before insert. Not enforced for `both` (citation is optional when facts may come from the conversation instead) or `history` (no citation is ever expected) |
| Question that is ambiguous between contract/history keywords | `classifyQuery()` is a keyword heuristic, not a semantic classifier — a misclassification sends the wrong context. The specific case of ambiguous pronoun follow-ups ("what does that mean") is handled via `FOLLOWUP_KEYWORDS` → `both` (never a silent drop to `history`), but a genuine contract-content question that happens to use only `HISTORY_KEYWORDS` words and no `CONTRACT_KEYWORDS` word (e.g. "what was mentioned above regarding fees" — "fees" isn't in `CONTRACT_KEYWORDS`) can still misclassify as pure `history` and lose the document text. No confidence threshold or fallback exists yet; a wrong classification produces a wrong-but-plausible answer, not an error |
| 200-message cap reached | `trg_enforce_max_chat_messages` rejects the insert — this can trip on either the *user* message insert (checked immediately, before any OpenAI call is made) or the *assistant* message insert (checked after the OpenAI call already succeeded, since the user's own message may have been the 200th); both cases return `422 CHAT_HISTORY_LIMIT_REACHED`, UI shows "You've reached the chat limit for this contract" and disables the input |
| Assistant-message insert fails for a reason other than the 200-cap (transient DB error) after the OpenAI call already succeeded | `logUsage()` still fires (called before this insert is attempted, so the already-incurred OpenAI cost is never silently unlogged); `500 INTERNAL_ERROR`, `retryable: true`; UI shows "We got a response but could not save it. Please refresh and check your chat history." — the assistant's answer may still be recoverable via Realtime if the insert actually landed but the `.select().single()` response race failed, though the common case is the insert itself did not commit |
| Rate limit exceeded (60/hour) | `429 RATE_LIMITED` before any OpenAI call; UI shows "Please wait a moment before sending another message" |
| Contract not yet `completed` | `409 CONTRACT_NOT_PROCESSED` — chat tab/button is not shown in the UI until processing completes, so this is primarily a defense-in-depth guard |
| User sends a message from two tabs at once | Both are optimistically rendered locally in their own tab, and each is a distinct HTTP request; the Realtime subscription delivers each committed row to *all* open tabs for that session, so eventually both tabs converge on the same ordered message list (de-duped by `id`) |
| OpenAI outage (5xx/network) exhausts retries | `502 OPENAI_ERROR`; the user message row is still persisted (it was inserted before the OpenAI call), so the conversation history is not lost — only the assistant reply is missing, and the UI shows a retryable error state on that turn (re-sending is just a new message, not a special "retry the assistant" action, since retrying a chat turn is not identical to retrying idempotent extraction) |
| Every retry attempt individually exceeds the 20s per-call budget | `504 TIMEOUT` (distinct from `502 OPENAI_ERROR` — `err instanceof TimeoutError`, per `lib/openai/withTimeout.ts`, `docs/specs/00-overview-and-conventions.md`); same "user message already persisted" guarantee applies |
| Chat groundedness regression test | `tests/integration/chat-hallucination.test.ts` feeds a question about a topic absent from a fixture contract and asserts the response contains "I cannot find this in the document" (`docs/specs/18-testing-and-eval-strategy.md`) |

## Performance & cost targets

- Chat response ≤15s P95 (single non-streaming OpenAI call, temperature 0.4, max_tokens 1000).
- Every call logs `input_tokens`/`output_tokens`/`cost_usd` to `openai_usage_log` via `lib/openai/usageLogger.ts` (`docs/specs/13-rate-limiting-and-cost-control.md`).
