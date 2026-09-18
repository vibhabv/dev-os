'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ContractTypeSelector } from '@/components/upload/ContractTypeSelector'
import { FileDropzone } from '@/components/upload/FileDropzone'
import { KeyTermPreviewList } from '@/components/upload/KeyTermPreviewList'
import { CustomTermInput } from '@/components/upload/CustomTermInput'
import { ProcessingProgress } from '@/components/upload/ProcessingProgress'
import { LargeFileWarningBanner } from '@/components/ui/LargeFileWarningBanner'
import { OnboardingTooltip } from '@/components/ui/OnboardingTooltip'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import type { ContractType } from '@/types/database'
import type { CustomKeyTerm } from '@/types/domain'

type WizardStep = 'select-type' | 'preview' | 'processing'

export function UploadWizard() {
  const router = useRouter()
  const { user } = useAuth()
  const [step, setStep] = useState<WizardStep>('select-type')
  const [contractType, setContractType] = useState<ContractType | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [contractId, setContractId] = useState<string | null>(null)
  const [standardTerms, setStandardTerms] = useState<readonly string[]>([])
  const [customTerms, setCustomTerms] = useState<CustomKeyTerm[]>([])
  const [processError, setProcessError] = useState<string | null>(null)

  async function handleFileSelected(file: File) {
    if (!contractType) return
    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('contract_type', contractType)

      const res = await fetch('/api/contracts', { method: 'POST', body: formData })
      const body = await res.json()

      if (!res.ok) {
        setUploadError(body?.error?.message ?? 'Something went wrong. Please try again.')
        setUploading(false)
        return
      }

      setContractId(body.contract_id)
      setStandardTerms(body.standard_terms_preview)
      setStep('preview')
    } catch {
      setUploadError('Something went wrong. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function resetToStart() {
    setStep('select-type')
    setUploadError(null)
  }

  if (step === 'processing' && contractId) {
    return (
      <div className="flex flex-col gap-6">
        <ProcessingProgress
          contractId={contractId}
          onComplete={() => router.push(`/contracts/${contractId}`)}
          onError={(message) => setProcessError(message)}
        />
        {processError && (
          <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-body-sm text-red-700">{processError}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setProcessError(null)
                setStep('processing')
              }}
              className="self-start"
            >
              Try again
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (step === 'preview' && contractId && user) {
    return (
      <div className="flex flex-col gap-8">
        <OnboardingTooltip
          id="onboarding-confidence-legend"
          content="Green means high confidence, amber means check it, red means we recommend verifying manually."
        >
          <div className="flex items-center gap-4 text-body-sm text-grey-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> High confidence
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> Check it
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Verify manually
            </span>
          </div>
        </OnboardingTooltip>
        <KeyTermPreviewList standardTerms={standardTerms} customTerms={customTerms} />
        <CustomTermInput
          contractId={contractId}
          userId={user.id}
          customTerms={customTerms}
          onCustomTermsChange={setCustomTerms}
        />
        <Button size="lg" onClick={() => setStep('processing')} className="self-start">
          Process Contract
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <LargeFileWarningBanner />
      <ContractTypeSelector value={contractType} onChange={setContractType} />
      {uploadError ? (
        <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-body-sm text-red-700">{uploadError}</p>
          <Button size="sm" variant="outline" onClick={resetToStart} className="self-start">
            Try again
          </Button>
        </div>
      ) : (
        <FileDropzone disabled={!contractType} uploading={uploading} onFileSelected={handleFileSelected} />
      )}
    </div>
  )
}
