'use client'

import { useEffect } from 'react'
import { useKeyTerms } from '@/hooks/useKeyTerms'
import { KeyTermRow } from '@/components/results/KeyTermRow'
import { useUiStore } from '@/lib/store/uiStore'

interface KeyTermsPanelProps {
  contractId: string
}

export function KeyTermsPanel({ contractId }: KeyTermsPanelProps) {
  const { terms, isLoading, isError, updateTermValue } = useKeyTerms(contractId)
  const setTargetPage = useUiStore((s) => s.setTargetPage)

  useEffect(() => {
    const firstLowConfidence = terms.find((t) => t.confidence_score < 50)
    if (firstLowConfidence) setTargetPage(firstLowConfidence.page_number)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-md bg-grey-100" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <p className="p-4 text-body-sm text-red-700">Could not load key terms. Please refresh.</p>
  }

  if (terms.length === 0) {
    return <p className="p-4 text-body-sm text-grey-400">No key terms found for this contract.</p>
  }

  return (
    <div>
      {terms.map((term) => (
        <KeyTermRow key={term.id} term={term} onUpdateValue={updateTermValue} />
      ))}
    </div>
  )
}
