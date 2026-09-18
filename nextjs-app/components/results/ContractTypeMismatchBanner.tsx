import { AlertTriangle } from 'lucide-react'
import type { Contract } from '@/types/domain'

interface ContractTypeMismatchBannerProps {
  contract: Contract
}

export function ContractTypeMismatchBanner({ contract }: ContractTypeMismatchBannerProps) {
  if (!contract.detected_contract_type || contract.detected_contract_type === contract.contract_type) return null

  return (
    <div role="note" className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-body-sm text-yellow-800">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      This looks like it might be a different contract type — results may be less accurate.
    </div>
  )
}
