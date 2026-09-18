'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface MarkReviewCompleteButtonProps {
  contractId: string
  reviewedAt: string | null
}

export function MarkReviewCompleteButton({ contractId, reviewedAt }: MarkReviewCompleteButtonProps) {
  const [localReviewed, setLocalReviewed] = useState(!!reviewedAt)
  const [submitting, setSubmitting] = useState(false)

  if (localReviewed) {
    return (
      <Badge variant="success" className="gap-1">
        <Check className="h-3 w-3" /> Reviewed
      </Badge>
    )
  }

  async function markComplete() {
    setSubmitting(true)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase
      .from('contracts')
      .update({ reviewed_at: new Date().toISOString() })
      .eq('id', contractId)
    setSubmitting(false)

    if (error) {
      toast.error('Could not mark this reviewed. Please try again.')
      return
    }
    setLocalReviewed(true)
  }

  return (
    <Button variant="outline" onClick={markComplete} disabled={submitting}>
      Mark Review Complete
    </Button>
  )
}
