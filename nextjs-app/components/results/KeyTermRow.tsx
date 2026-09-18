'use client'

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { ConfidenceBadge } from '@/components/results/ConfidenceBadge'
import { SourceSentenceTooltip } from '@/components/results/SourceSentenceTooltip'
import { TermGlossaryTooltip } from '@/components/results/TermGlossaryTooltip'
import { useUiStore } from '@/lib/store/uiStore'
import type { KeyTerm } from '@/types/domain'

interface KeyTermRowProps {
  term: KeyTerm
  onUpdateValue: (termId: string, newValue: string) => Promise<{ error: unknown }>
}

export function KeyTermRow({ term, onUpdateValue }: KeyTermRowProps) {
  const setTargetPage = useUiStore((s) => s.setTargetPage)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(term.value)
  const [localValue, setLocalValue] = useState(term.value)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  useEffect(() => {
    setLocalValue(term.value)
    setDraft(term.value)
  }, [term.value])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  async function commit() {
    setEditing(false)
    if (draft === localValue) return

    const previous = localValue
    setLocalValue(draft)

    const { error } = await onUpdateValue(term.id, draft)
    if (error) {
      toast.error('Could not save your edit. Please try again.')
      setLocalValue(previous)
      setDraft(previous)
    }
  }

  function revert() {
    setDraft(localValue)
    setEditing(false)
  }

  const useTextarea = localValue.length > 80

  return (
    <div className="flex flex-col gap-2 border-b border-grey-50 px-4 py-4 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-body-lg font-medium text-grey-900">{term.term_name}</span>
        {term.term_source === 'custom' ? (
          <Badge variant="default">Custom</Badge>
        ) : (
          <TermGlossaryTooltip termName={term.term_name} />
        )}
        {term.is_edited && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Badge variant="secondary">Edited</Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent>Original AI extraction: {term.original_ai_value}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {editing ? (
        useTextarea ? (
          <Textarea
            ref={inputRef as React.Ref<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') revert()
              if (e.key === 'Enter' && e.metaKey) commit()
            }}
          />
        ) : (
          <Input
            ref={inputRef as React.Ref<HTMLInputElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') revert()
              if (e.key === 'Enter') commit()
            }}
          />
        )
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md px-2 py-1 text-left text-body-lg text-grey-900 hover:bg-grey-50"
        >
          {localValue}
        </button>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setTargetPage(term.page_number)}
          aria-label={`Go to page ${term.page_number}`}
          className="text-body-sm text-blue-500 hover:text-blue-700"
        >
          Page {term.page_number}
        </button>
        <ConfidenceBadge score={term.confidence_score} />
        <SourceSentenceTooltip sourceSentence={term.source_sentence} />
      </div>
    </div>
  )
}
