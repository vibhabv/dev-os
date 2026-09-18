'use client'

import { cn } from '@/lib/utils'
import type { ContractType } from '@/types/database'

interface ContractTypeSelectorProps {
  value: ContractType | null
  onChange: (value: ContractType) => void
}

const OPTIONS: { value: ContractType; label: string; description: string }[] = [
  { value: 'nda', label: 'NDA', description: 'Non-Disclosure Agreement' },
  { value: 'msa', label: 'MSA', description: 'Master Services Agreement' },
]

export function ContractTypeSelector({ value, onChange }: ContractTypeSelectorProps) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-body-lg font-medium text-grey-900">What kind of contract is this?</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left transition-colors duration-micro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              value === option.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-grey-200 bg-white hover:bg-grey-50',
            )}
          >
            <span className="text-body-lg font-medium text-grey-900">{option.label}</span>
            <span className="text-body-sm text-grey-500">{option.description}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
