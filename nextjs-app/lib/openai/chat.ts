import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ChatMessage } from '@/types/domain'
import type { Database } from '@/types/database'

type ChatSessionRow = Database['public']['Tables']['chat_sessions']['Row']

export async function getOrCreateChatSession(contractId: string, userId: string): Promise<ChatSessionRow> {
  const supabaseServer = createSupabaseServerClient()

  const { data: existing } = await supabaseServer
    .from('chat_sessions')
    .select('*')
    .eq('contract_id', contractId)
    .maybeSingle()

  if (existing) return existing

  const { data: created, error } = await supabaseServer
    .from('chat_sessions')
    .insert({ contract_id: contractId, user_id: userId })
    .select()
    .single()

  if (error || !created) throw error ?? new Error('Failed to create chat session')
  return created
}

// Returns the most recent `limit` messages, oldest first — NOT the oldest
// `limit` messages. Fetched newest-first so the cap applies to the tail of
// the conversation, then reversed back into chronological order for the
// prompt.
export async function loadMessages(sessionId: string, limit = 200): Promise<ChatMessage[]> {
  const supabaseServer = createSupabaseServerClient()
  const { data } = await supabaseServer
    .from('chat_messages')
    .select('*')
    .eq('chat_session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return ((data ?? []) as ChatMessage[]).reverse()
}

export { classifyQuery, buildChatSystemPrompt, CHAT_PROMPT_VERSION } from './prompts/chatSystemPrompt'
