'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageSquareText, X } from 'lucide-react'
import { useUiStore } from '@/lib/store/uiStore'
import { useContract } from '@/hooks/useContract'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { ResultsViewer } from '@/components/results/ResultsViewer'
import { KeyTermsPanel } from '@/components/results/KeyTermsPanel'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { DisclaimerBanner } from '@/components/results/DisclaimerBanner'
import { CalibrationWarningBanner } from '@/components/results/CalibrationWarningBanner'
import { ContractTypeMismatchBanner } from '@/components/results/ContractTypeMismatchBanner'
import { MarkReviewCompleteButton } from '@/components/results/MarkReviewCompleteButton'
import { DeleteContractButton } from '@/components/dashboard/DeleteContractButton'
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget'
import { useRouter } from 'next/navigation'
import { OnboardingTooltip } from '@/components/ui/OnboardingTooltip'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type MobileTab = 'viewer' | 'terms' | 'chat'

interface ResultsPageProps {
  contractId: string
}

export function ResultsPage({ contractId }: ResultsPageProps) {
  const router = useRouter()
  const { data: contract, isLoading, isError } = useContract(contractId)
  const setTargetPage = useUiStore((s) => s.setTargetPage)
  const [mobileTab, setMobileTab] = useState<MobileTab>('viewer')
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase
      .from('contracts')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', contractId)
      .then(({ error }) => {
        if (error) console.error('Failed to update last_accessed_at', { contractId, error })
      })

    return () => setTargetPage(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId])

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-body-sm text-grey-400">Loading…</div>
  }

  if (isError || !contract) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
        <p className="text-body-lg text-grey-700">We couldn&apos;t load this contract.</p>
        <Button asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    )
  }

  if (contract.status === 'error') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
        <p className="text-body-lg text-red-700">
          {contract.error_message ?? 'Something went wrong processing this contract.'}
        </p>
        <Button
          onClick={async () => {
            await fetch(`/api/contracts/${contractId}/process`, { method: 'POST' })
            window.location.reload()
          }}
        >
          Try again
        </Button>
      </div>
    )
  }

  if (contract.status !== 'completed') {
    return (
      <div className="flex h-screen items-center justify-center text-body-sm text-grey-400">
        This contract is still processing…
      </div>
    )
  }

  return (
    <div className="relative flex h-screen flex-col bg-grey-25">
      <header className="flex items-center justify-between border-b border-grey-100 bg-white px-6 py-4">
        <Link href="/dashboard" className="text-h5 text-grey-900">
          ContractIQ
        </Link>
        <div className="flex items-center gap-3">
          <span className="max-w-xs truncate text-body-sm text-grey-500">{contract.filename}</span>
          <MarkReviewCompleteButton contractId={contract.id} reviewedAt={contract.reviewed_at} />
          <DeleteContractButton contractId={contract.id} onDeleted={() => router.push('/dashboard')} />
        </div>
      </header>

      <div className="flex flex-col gap-3 px-6 py-3">
        <ContractTypeMismatchBanner contract={contract} />
        <CalibrationWarningBanner />
        <DisclaimerBanner />
      </div>

      <nav className="flex gap-2 border-b border-grey-100 px-6 lg:hidden" aria-label="Results view">
        {(['viewer', 'terms', 'chat'] as MobileTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className={cn(
              'border-b-2 px-3 py-2 text-body-sm capitalize',
              mobileTab === tab ? 'border-blue-500 text-blue-700' : 'border-transparent text-grey-500',
            )}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="flex flex-1 overflow-hidden">
        <div className={cn('flex-1 overflow-hidden lg:block', mobileTab === 'viewer' ? 'block' : 'hidden')}>
          <ResultsViewer contract={contract} contractText={contract.contract_text} />
        </div>
        <div
          className={cn(
            'w-full overflow-y-auto border-l border-grey-100 bg-white lg:block lg:w-[420px]',
            mobileTab === 'terms' ? 'block' : 'hidden',
          )}
        >
          <KeyTermsPanel contractId={contractId} />
          <div className="p-4">
            <FeedbackWidget contractId={contractId} />
          </div>
        </div>
        {/* Mobile/tablet chat tab renders in-place; desktop chat is a slide-over below */}
        <div className={cn('w-full overflow-hidden lg:hidden', mobileTab === 'chat' ? 'block' : 'hidden')}>
          <ChatPanel contractId={contractId} />
        </div>
      </div>

      {/* Desktop: floating chat trigger + slide-over panel (≥1024px) */}
      <div className="hidden lg:block">
        {!chatOpen && (
          <OnboardingTooltip
            id="onboarding-chat"
            content="Have a question about this contract? Ask it here in plain English."
          >
            <Button
              onClick={() => setChatOpen(true)}
              size="lg"
              className="fixed bottom-8 right-8 gap-2 rounded-full shadow-lg"
            >
              <MessageSquareText className="h-4 w-4" /> Chat with Contract
            </Button>
          </OnboardingTooltip>
        )}

        {chatOpen && (
          <div className="fixed inset-y-0 right-0 z-40 flex w-[420px] flex-col border-l border-grey-100 bg-white shadow-xl duration-modal animate-in slide-in-from-right">
            <div className="flex items-center justify-between border-b border-grey-100 px-4 py-3">
              <span className="text-body-lg font-medium text-grey-900">Chat with Contract</span>
              <button
                type="button"
                aria-label="Close chat"
                onClick={() => setChatOpen(false)}
                className="text-grey-400 hover:text-grey-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatPanel contractId={contractId} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
