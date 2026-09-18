'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type { AccuracyRating, FeedbackRating } from '@/types/database'

interface FeedbackWidgetProps {
  contractId: string
}

export function FeedbackWidget({ contractId }: FeedbackWidgetProps) {
  const { user } = useAuth()
  const [rating, setRating] = useState<FeedbackRating | null>(null)
  const [accuracyRating, setAccuracyRating] = useState<AccuracyRating | null>(null)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (submitted) {
    return <p className="text-body-lg text-grey-700">Thanks for your feedback!</p>
  }

  const canSubmit = !!rating || !!accuracyRating || comment.trim().length > 0

  async function handleSubmit() {
    if (!user || !canSubmit) return
    setSubmitting(true)
    setSubmitError(null)

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.from('user_feedback').insert({
      contract_id: contractId,
      user_id: user.id,
      rating: rating ?? null,
      accuracy_rating: accuracyRating ?? null,
      comment: comment.trim() || null,
    })
    setSubmitting(false)

    if (error) {
      setSubmitError('Could not submit your feedback. Please try again.')
      return
    }
    setSubmitted(true)
  }

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-grey-100 bg-white p-6">
      <div className="flex flex-col gap-3">
        <span className="text-body-lg font-medium text-grey-900">How was this analysis?</span>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={rating === 'up'}
            onClick={() => setRating(rating === 'up' ? null : 'up')}
            className={cn(
              'rounded-md border p-2',
              rating === 'up' ? 'border-green-500 bg-green-50 text-green-700' : 'border-grey-200 text-grey-500',
            )}
          >
            <ThumbsUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-pressed={rating === 'down'}
            onClick={() => setRating(rating === 'down' ? null : 'down')}
            className={cn(
              'rounded-md border p-2',
              rating === 'down' ? 'border-red-500 bg-red-50 text-red-700' : 'border-grey-200 text-grey-500',
            )}
          >
            <ThumbsDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-body-lg font-medium text-grey-900">Were the extracted terms accurate?</span>
        <RadioGroup
          value={accuracyRating ?? undefined}
          onValueChange={(v) => setAccuracyRating(v as AccuracyRating)}
          className="flex gap-4"
        >
          {(['yes', 'partially', 'no'] as AccuracyRating[]).map((option) => (
            <div key={option} className="flex items-center gap-2">
              <RadioGroupItem value={option} id={`accuracy-${option}`} />
              <Label htmlFor={`accuracy-${option}`} className="capitalize font-normal">
                {option}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <Textarea
        placeholder="Anything else you'd like to share? (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      {submitError && (
        <p role="alert" className="text-body-sm text-red-700">
          {submitError}
        </p>
      )}

      <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className="self-start">
        Submit feedback
      </Button>
    </div>
  )
}
