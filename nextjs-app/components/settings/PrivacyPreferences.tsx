'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useUserSettings } from '@/hooks/useUserSettings'

export function PrivacyPreferences() {
  const { settings, setCorrectionsOptIn, isSaving } = useUserSettings()
  const [localOptIn, setLocalOptIn] = useState<boolean | null>(null)

  const checked = localOptIn ?? settings?.corrections_opt_in ?? false

  function handleToggle() {
    const next = !checked
    setLocalOptIn(next)
    setCorrectionsOptIn(next, {
      onSuccess: () => toast.success('Saved'),
      onError: () => {
        toast.error('Could not save your preference. Please try again.')
        setLocalOptIn(!next)
      },
    })
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-grey-100 bg-white p-6">
      <input
        type="checkbox"
        id="corrections-opt-in"
        checked={checked}
        onChange={handleToggle}
        disabled={isSaving}
        className="mt-1 h-4 w-4 rounded border-grey-300 text-blue-500 focus:ring-blue-500"
      />
      <label htmlFor="corrections-opt-in" className="text-body-lg text-grey-900">
        Help improve ContractIQ: share my term corrections anonymously (not your contract content) to improve
        extraction accuracy.
      </label>
    </div>
  )
}
