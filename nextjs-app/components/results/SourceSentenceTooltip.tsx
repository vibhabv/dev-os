'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SourceSentenceTooltipProps {
  sourceSentence: string
}

export function SourceSentenceTooltip({ sourceSentence }: SourceSentenceTooltipProps) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 text-body-sm text-blue-500 hover:text-blue-700"
      >
        Why?
        <ChevronDown className={cn('h-3 w-3 transition-transform duration-micro', open && 'rotate-180')} />
      </button>
      {open && (
        <blockquote className="mt-2 rounded-md border-l-2 border-grey-200 bg-grey-25 px-3 py-2 text-body-sm italic text-grey-700">
          {sourceSentence || 'No supporting sentence was found for this term.'}
        </blockquote>
      )}
    </div>
  )
}
