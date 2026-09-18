'use client'

import { useUiStore } from '@/lib/store/uiStore'

export function PageCitationLink({ page }: { page: number }) {
  const setTargetPage = useUiStore((s) => s.setTargetPage)
  return (
    <button
      type="button"
      onClick={() => setTargetPage(page)}
      className="text-body-sm font-medium text-blue-500 hover:text-blue-700 hover:underline"
    >
      Source: Page {page}
    </button>
  )
}
