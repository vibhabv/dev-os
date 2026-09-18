'use client'

import { useState } from 'react'
import { useSignedPdfUrl } from '@/hooks/useSignedPdfUrl'
import { PdfViewer } from '@/components/results/PdfViewer'
import { TextViewerFallback } from '@/components/results/TextViewerFallback'
import type { Contract } from '@/types/domain'

interface ResultsViewerProps {
  contract: Contract
  contractText: string
}

export function ResultsViewer({ contract, contractText }: ResultsViewerProps) {
  const [manualTextFallback, setManualTextFallback] = useState(false)
  const hasStorageCandidate = !!contract.file_path && !contract.storage_upload_failed
  const signedUrlQuery = useSignedPdfUrl(hasStorageCandidate ? contract.file_path : null)

  if (manualTextFallback || !hasStorageCandidate || signedUrlQuery.isError) {
    return <TextViewerFallback contractText={contractText} />
  }

  if (signedUrlQuery.isLoading || !signedUrlQuery.data) {
    return (
      <div className="flex h-full flex-col gap-3 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-md bg-grey-100" />
        ))}
      </div>
    )
  }

  return <PdfViewer signedUrl={signedUrlQuery.data} onSwitchToText={() => setManualTextFallback(true)} />
}
