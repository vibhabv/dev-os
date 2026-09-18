import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/types/domain'

const LABELS: Record<NonNullable<ChatMessage['context_source']>, string> = {
  contract: 'From document',
  history: 'From conversation',
  both: 'From document & conversation',
}

// Semantic Status Badge pattern (docs/design.md): bg [Color]-50, border
// [Color]-200, text [Color]-700, Paragraph Small Medium, rounded-sm, 2px 8px.
const COLOR_CLASSES: Record<NonNullable<ChatMessage['context_source']>, string> = {
  contract: 'bg-blue-50 border-blue-200 text-blue-700',
  history: 'bg-violet-50 border-violet-200 text-violet-700',
  both: 'bg-orange-50 border-orange-200 text-orange-700',
}

export function ContextSourceBadge({ source }: { source: ChatMessage['context_source'] }) {
  if (!source) return null

  return (
    <span
      className={cn(
        'inline-block w-fit rounded-sm border px-2 py-0.5 text-body-sm font-medium',
        COLOR_CLASSES[source],
      )}
    >
      {LABELS[source]}
    </span>
  )
}
