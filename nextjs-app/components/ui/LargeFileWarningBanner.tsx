'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

const BANNER_KEY = 'contractiq_large_file_banner_dismissed_v1'

function safeGetItem(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
  } catch {
    return null
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
  } catch {
    // Swallowed intentionally — setDismissed(true) still runs, so this session's banner is
    // still dismissed; only cross-session persistence of the dismissal is lost.
  }
}

export function LargeFileWarningBanner() {
  const [dismissed, setDismissed] = useState(() => safeGetItem(BANNER_KEY) === 'true')

  if (dismissed) return null

  return (
    <div role="note" className="flex items-start justify-between gap-4 rounded-lg bg-blue-50 px-4 py-3 text-body-sm text-blue-700">
      <span>
        For the best experience with large PDFs, use Chrome or Firefox on desktop. On mobile, uploads near the 10 MB
        limit may be slow on cellular connections.
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          safeSetItem(BANNER_KEY, 'true')
          setDismissed(true)
        }}
        className="shrink-0 text-blue-700 hover:text-blue-900"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
