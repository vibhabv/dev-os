'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProcessingProgressProps {
  contractId: string
  onComplete: () => void
  onError: (message: string, retryable: boolean) => void
}

type Step = 1 | 2 | 3

const STEP_LABELS: Record<Step, string> = {
  1: 'Extracting text',
  2: 'Analysing with AI…',
  3: 'Compiling results…',
}

export function ProcessingProgress({ contractId, onComplete, onError }: ProcessingProgressProps) {
  const [step, setStep] = useState<Step>(2)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    async function run() {
      try {
        const res = await fetch(`/api/contracts/${contractId}/process`, { method: 'POST' })
        const body = await res.json()

        if (!res.ok) {
          onError(body?.error?.message ?? 'Something went wrong. Please try again.', body?.error?.retryable ?? true)
          return
        }

        setStep(3)
        onComplete()
      } catch {
        onError('Something went wrong. Please try again.', true)
      }
    }

    run()
  }, [contractId, onComplete, onError])

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      {([1, 2, 3] as Step[]).map((s) => (
        <div key={s} className="flex items-center gap-3">
          {s < step ? (
            <Check className="h-5 w-5 text-green-500" aria-hidden="true" />
          ) : s === step ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" aria-hidden="true" />
          ) : (
            <span className="h-5 w-5 rounded-full border border-grey-200" />
          )}
          <span className={cn('text-body-lg', s <= step ? 'text-grey-900' : 'text-grey-400')}>
            {STEP_LABELS[s]}
            {s === 1 ? ' ✓' : ''}
          </span>
        </div>
      ))}
    </div>
  )
}
