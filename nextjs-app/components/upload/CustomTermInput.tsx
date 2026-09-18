'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { CustomKeyTerm } from '@/types/domain'

interface CustomTermInputProps {
  contractId: string
  userId: string
  customTerms: CustomKeyTerm[]
  onCustomTermsChange: (terms: CustomKeyTerm[]) => void
}

const MAX_CUSTOM_TERMS = 5

export function CustomTermInput({ contractId, userId, customTerms, onCustomTermsChange }: CustomTermInputProps) {
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const atLimit = customTerms.length >= MAX_CUSTOM_TERMS

  async function handleAdd() {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Please enter a term name')
      return
    }

    setSubmitting(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { data, error: insertError } = await supabase
      .from('custom_key_terms')
      .insert({ contract_id: contractId, user_id: userId, term_name: trimmed, is_manual: true })
      .select()
      .single()
    setSubmitting(false)

    if (insertError) {
      setError(
        insertError.message.includes('Maximum 5 custom terms')
          ? 'Maximum 5 custom terms per contract.'
          : 'Could not add this term. Please try again.',
      )
      return
    }

    onCustomTermsChange([...customTerms, data as CustomKeyTerm])
    setValue('')
    setAdding(false)
  }

  async function handleRemove(customTermId: string) {
    const supabase = createSupabaseBrowserClient()
    const { error: deleteError } = await supabase.from('custom_key_terms').delete().eq('id', customTermId)
    if (deleteError) {
      setError('Could not remove this term. Please try again.')
      return
    }
    onCustomTermsChange(customTerms.filter((t) => t.id !== customTermId))
  }

  return (
    <div className="flex flex-col gap-3">
      {customTerms.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {customTerms.map((term) => (
            <li
              key={term.id}
              className="flex items-center gap-2 rounded-sm border border-blue-200 bg-blue-50 px-2 py-1 text-body-sm text-blue-700"
            >
              {term.term_name}
              <button
                type="button"
                aria-label={`Remove ${term.term_name}`}
                onClick={() => handleRemove(term.id)}
                className="text-blue-700 hover:text-blue-900"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. Exclusivity"
              maxLength={100}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
                if (e.key === 'Escape') {
                  setAdding(false)
                  setValue('')
                  setError(null)
                }
              }}
            />
            <Button size="sm" onClick={handleAdd} disabled={submitting}>
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false)
                setValue('')
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-body-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      ) : atLimit ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" variant="outline" disabled>
                <Plus className="h-4 w-4" /> Add Key Term
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Maximum 5 custom terms</TooltipContent>
        </Tooltip>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="self-start">
          <Plus className="h-4 w-4" /> Add Key Term
        </Button>
      )}
    </div>
  )
}
