'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageSquareText } from 'lucide-react'
import { useChatSession } from '@/hooks/useChatSession'
import { useAuth } from '@/hooks/useAuth'
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble'
import { ChatInput } from '@/components/chat/ChatInput'
import type { ChatMessage } from '@/types/domain'

interface ChatPanelProps {
  contractId: string
}

export function ChatPanel({ contractId }: ChatPanelProps) {
  const { user } = useAuth()
  const {
    sessionId,
    sessionError,
    messages,
    isLoading,
    messagesError,
    appendOptimisticMessage,
    removeOptimisticMessage,
  } = useChatSession(contractId)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  // setSending(true) below disables the input, but that's a React state
  // update — it doesn't take effect until the next render, leaving a brief
  // window where two rapid Enters/clicks can both call handleSend before the
  // button actually disables, sending the same message twice. This ref is
  // set synchronously, closing that race regardless of render timing.
  const sendingRef = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function handleSend(text: string) {
    if (!user || sendingRef.current) return
    sendingRef.current = true
    setSendError(null)
    setSending(true)

    const optimisticId = crypto.randomUUID()
    appendOptimisticMessage({
      id: optimisticId,
      chat_session_id: sessionId ?? '',
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
      page_citation: null,
    } as ChatMessage)

    try {
      const res = await fetch(`/api/contracts/${contractId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, id: optimisticId }),
      })

      if (!res.ok) {
        const err = await res.json()
        setSendError(err?.error?.message ?? 'Something went wrong. Please try again.')
        removeOptimisticMessage(optimisticId)
      }
    } catch {
      setSendError('Something went wrong. Please try again.')
      removeOptimisticMessage(optimisticId)
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  if (sessionError || messagesError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-body-sm text-red-700">{sessionError ?? 'Could not load this conversation. Please refresh.'}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-grey-100 px-4 py-3">
        <MessageSquareText className="h-4 w-4 text-blue-500" aria-hidden="true" />
        <h2 className="text-body-lg font-medium text-grey-900">Chat with contract</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4" aria-live="polite">
        {isLoading ? (
          <p className="text-body-sm text-grey-400">Loading conversation…</p>
        ) : messages.length === 0 ? (
          <p className="text-body-sm text-grey-400">Ask a question about this contract to get started.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <ChatMessageBubble key={message.id} message={message} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {sendError && (
        <p role="alert" className="px-4 py-1 text-body-sm text-red-700">
          {sendError}
        </p>
      )}

      <ChatInput disabled={sending || !sessionId} onSend={handleSend} />
    </div>
  )
}
