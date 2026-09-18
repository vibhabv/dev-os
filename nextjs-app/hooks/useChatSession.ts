'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type { ChatMessage } from '@/types/domain'

export function useChatSession(contractId: string) {
  const { user } = useAuth()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!user) return
    let cancelled = false

    ;(async () => {
      setSessionError(null)
      const supabase = createSupabaseBrowserClient()
      const { data: session, error: selectErr } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('contract_id', contractId)
        .maybeSingle()

      if (cancelled) return

      if (selectErr) {
        setSessionError('Could not load this conversation. Please refresh.')
        return
      }
      if (session) {
        setSessionId(session.id)
        return
      }

      const { data: created, error: insertErr } = await supabase
        .from('chat_sessions')
        .insert({ contract_id: contractId, user_id: user.id })
        .select()
        .single()

      if (cancelled) return

      if (insertErr || !created) {
        setSessionError('Could not start a new conversation. Please refresh.')
        return
      }
      setSessionId(created.id)
    })()

    return () => {
      cancelled = true
    }
  }, [contractId, user])

  useEffect(() => {
    if (!sessionId) return
    const supabase = createSupabaseBrowserClient()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    ;(async () => {
      // createSupabaseBrowserClient() returns a singleton (per @supabase/ssr),
      // and RealtimeClient.channel(topic) reuses an existing channel object
      // for that topic instead of always creating a fresh one. removeChannel()
      // is async (it awaits channel.unsubscribe() before tearing it down), but
      // a React effect cleanup's returned promise is never awaited — so if
      // this effect re-runs (StrictMode's dev double-invoke, Fast Refresh, or
      // sessionId changing) before the previous run's cleanup has actually
      // finished removing its channel, `.channel()` below would return that
      // still-joined channel, and `.on('postgres_changes', ...)` on an
      // already-joined channel throws "cannot add `postgres_changes`
      // callbacks ... after `subscribe()`". Awaiting the stale channel's
      // removal first closes that race.
      const topic = `realtime:chat-${sessionId}`
      const stale = supabase.getChannels().find((c) => c.topic === topic)
      if (stale) await supabase.removeChannel(stale)
      if (cancelled) return

      channel = supabase
        .channel(`chat-${sessionId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `chat_session_id=eq.${sessionId}` },
          (payload) => {
            queryClient.setQueryData(['chat-messages', sessionId], (old: ChatMessage[] = []) => {
              if (old.some((m) => m.id === (payload.new as ChatMessage).id)) return old
              return [...old, payload.new as ChatMessage]
            })
          },
        )
        .subscribe()
    })()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [sessionId, queryClient])

  const messagesQuery = useQuery({
    queryKey: ['chat-messages', sessionId],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_session_id', sessionId!)
        .order('created_at', { ascending: true })
        .limit(200)
      if (error) throw error
      return data as ChatMessage[]
    },
    enabled: !!sessionId,
  })

  function appendOptimisticMessage(message: ChatMessage) {
    queryClient.setQueryData(['chat-messages', sessionId], (old: ChatMessage[] = []) => [...old, message])
  }

  function removeOptimisticMessage(id: string) {
    queryClient.setQueryData(['chat-messages', sessionId], (old: ChatMessage[] = []) =>
      old.filter((m) => m.id !== id),
    )
  }

  return {
    sessionId,
    sessionError,
    messages: messagesQuery.data ?? [],
    isLoading: messagesQuery.isLoading,
    messagesError: messagesQuery.isError,
    appendOptimisticMessage,
    removeOptimisticMessage,
  }
}
