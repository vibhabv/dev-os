import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/withApiAuth'
import { jsonError } from '@/lib/api/jsonError'
import { loadContractOwnedBy } from '@/lib/api/loadContractOwnedBy'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrCreateChatSession, loadMessages, classifyQuery, buildChatSystemPrompt, CHAT_PROMPT_VERSION } from '@/lib/openai/chat'
import { chatMessageSchema } from '@/lib/validation/chatMessageSchema'
import { openai } from '@/lib/openai/client'
import { withTimeout, TimeoutError } from '@/lib/openai/withTimeout'
import { withRetry } from '@/lib/openai/withRetry'
import { hashUserId } from '@/lib/openai/hashUserId'
import { logUsage } from '@/lib/openai/usageLogger'
import { verifyContractOwnership, verifySessionOwnership } from '@/lib/security/chatSecurity'
import { sanitizeForLLM } from '@/lib/security/promptInjectionGuard'
import { MAX_CHAT_HISTORY } from '@/lib/security/tokenLimiter'

const CONTRACT_TURN_LIMIT = 10
const HISTORY_TURN_LIMIT = 20

export const POST = withApiAuth(
  async (req: NextRequest, { userId, params }) => {
    const startedAt = Date.now()
    const supabaseServer = createSupabaseServerClient()

    const contract = await loadContractOwnedBy(params.contractId, userId)
    // loadContractOwnedBy() already filters by owner, so this can only ever
    // fail when `contract` is null — kept as an explicit, named assertion
    // (lib/security/chatSecurity.ts) per skills/security-foundation/SKILL.md
    // requirement 6, rather than relying solely on the implicit property of
    // how that query happens to be written.
    if (!contract || !verifyContractOwnership(contract, userId)) {
      return jsonError('CONTRACT_NOT_FOUND', 'Contract not found.', 404, false)
    }
    if (contract.status !== 'completed') {
      return jsonError('CONTRACT_NOT_PROCESSED', 'This contract has not finished processing yet.', 409, false)
    }

    const body = await req.json().catch(() => null)
    const parsed = chatMessageSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError('INVALID_MESSAGE', parsed.error.issues[0].message, 400, false)
    }

    const injectionCheck = sanitizeForLLM(parsed.data.message)
    if (!injectionCheck.safe) {
      return jsonError('PROMPT_INJECTION_DETECTED', 'This message could not be sent. Please rephrase your question.', 400, false)
    }

    const session = await getOrCreateChatSession(contract.id, userId)
    if (!verifySessionOwnership(session, userId)) {
      return jsonError('CONTRACT_NOT_FOUND', 'Contract not found.', 404, false)
    }

    // Classification and history retrieval both happen BEFORE the new user
    // message is saved. If history were loaded after the insert, this
    // message would appear inside its own "history" — corrupting the
    // turn-limit window and any future classifier that considers history.
    // The new message is appended to the OpenAI `messages` array manually,
    // below, since it deliberately is not part of `priorHistory`.
    const classification = classifyQuery(parsed.data.message)
    const turnLimit = Math.min(classification === 'history' ? HISTORY_TURN_LIMIT : CONTRACT_TURN_LIMIT, MAX_CHAT_HISTORY)
    const priorHistory = await loadMessages(session.id, turnLimit)
    const includeContractText = classification !== 'history'
    const systemPrompt = buildChatSystemPrompt(classification)
    const systemContent = includeContractText
      ? `${systemPrompt}\n\nDocument text:\n${contract.contract_text}`
      : systemPrompt

    const { error: insertErr } = await supabaseServer.from('chat_messages').insert({
      // Uses the client's optimistic-message id when supplied, so the
      // Realtime INSERT event for this row matches the bubble already
      // rendered in the sending tab instead of duplicating it — see
      // chatMessageSchema.ts.
      id: parsed.data.id,
      chat_session_id: session.id,
      user_id: userId,
      role: 'user',
      content: parsed.data.message,
    })

    if (insertErr) {
      if (insertErr.message.includes('Maximum 200 chat messages')) {
        return jsonError('CHAT_HISTORY_LIMIT_REACHED', "You've reached the chat history limit for this contract.", 422, false)
      }
      console.error('Failed to insert user chat_messages row', { contractId: contract.id, sessionId: session.id, error: insertErr })
      return jsonError('INTERNAL_ERROR', 'Something went wrong sending your message. Please try again.', 500, true)
    }

    let raw
    try {
      raw = await withRetry(
        () =>
          withTimeout(
            (signal) =>
              openai.chat.completions.create(
                {
                  model: 'gpt-4o',
                  temperature: 0.4,
                  max_tokens: 1000,
                  user: hashUserId(userId),
                  messages: [
                    { role: 'system', content: systemContent },
                    ...priorHistory.map((m) => ({ role: m.role, content: m.content })),
                    { role: 'user', content: parsed.data.message },
                  ],
                },
                { signal },
              ),
            20_000,
          ),
        { attempts: 3, backoffMs: [1000, 2000, 4000] },
      )
    } catch (err) {
      const message = 'OpenAI is temporarily unavailable — try again in a few minutes.'
      if (err instanceof TimeoutError) return jsonError('TIMEOUT', message, 504, true)
      return jsonError('OPENAI_ERROR', message, 502, true)
    }

    let content = raw.choices[0]?.message?.content ?? ''
    let pageCitation: number | null = null
    if (classification !== 'history') {
      const citationMatch = content.match(/\[Page (\d+)\]/)
      if (citationMatch) {
        pageCitation = Number(citationMatch[1])
      } else if (classification === 'contract' && !content.includes('(Page reference unavailable)')) {
        // The model sometimes echoes this exact fallback phrase itself when
        // its own prior turns (sent as conversation history) already
        // contain it — the guard avoids appending a second copy on top.
        content += ' (Page reference unavailable)'
      }
    }

    await logUsage({
      userId,
      contractId: contract.id,
      operation: 'chat',
      promptVersion: CHAT_PROMPT_VERSION,
      usage: {
        prompt_tokens: raw.usage?.prompt_tokens ?? 0,
        completion_tokens: raw.usage?.completion_tokens ?? 0,
      },
      durationMs: Date.now() - startedAt,
    })

    const { data: assistantMsg, error: assistantInsertErr } = await supabaseServer
      .from('chat_messages')
      .insert({
        chat_session_id: session.id,
        user_id: userId,
        role: 'assistant',
        content,
        page_citation: pageCitation,
        context_source: classification,
      })
      .select()
      .single()

    if (assistantInsertErr || !assistantMsg) {
      if (assistantInsertErr?.message.includes('Maximum 200 chat messages')) {
        return jsonError('CHAT_HISTORY_LIMIT_REACHED', "You've reached the chat history limit for this contract.", 422, false)
      }
      console.error('Failed to insert assistant chat_messages row', {
        contractId: contract.id,
        sessionId: session.id,
        error: assistantInsertErr,
      })
      return jsonError(
        'INTERNAL_ERROR',
        'We got a response but could not save it. Please refresh and check your chat history.',
        500,
        true,
      )
    }

    return NextResponse.json({
      message_id: assistantMsg.id,
      role: 'assistant',
      content,
      page_citation: pageCitation,
      context_source: classification,
      created_at: assistantMsg.created_at,
    })
  },
  { rateLimitAction: 'chat' },
)
