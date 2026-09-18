'use client'

import { useState } from 'react'

const ONBOARDING_KEY = 'contractiq_onboarding_seen_v1'

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
    // Swallowed intentionally — the corresponding useState update still runs, so the
    // current session's UI still behaves correctly; only cross-session persistence is lost.
  }
}

export function useOnboarding() {
  const [seen, setSeen] = useState(() => safeGetItem(ONBOARDING_KEY) === 'true')

  function dismiss() {
    safeSetItem(ONBOARDING_KEY, 'true')
    setSeen(true)
  }

  return { seen, dismiss }
}
