import { cn } from '@/lib/utils'
import { PageCitationLink } from '@/components/chat/PageCitationLink'
import { ContextSourceBadge } from '@/components/chat/ContextSourceBadge'
import type { ChatMessage } from '@/types/domain'

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
      {!isUser && <ContextSourceBadge source={message.context_source} />}
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-4 py-2 text-body-lg',
          isUser ? 'bg-blue-500 text-white' : 'bg-grey-50 text-grey-900',
        )}
      >
        {message.content}
      </div>
      {!isUser && message.page_citation != null && <PageCitationLink page={message.page_citation} />}
    </div>
  )
}
