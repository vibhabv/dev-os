'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useUiStore } from '@/lib/store/uiStore'
import { cn } from '@/lib/utils'

interface TextViewerFallbackProps {
  contractText: string
}

function parsePages(text: string): { pageNumber: number; text: string }[] {
  const matches = Array.from(text.matchAll(/\[PAGE (\d+)\]\n([\s\S]*?)(?=\[PAGE \d+\]|$)/g))
  return matches.map((m) => ({ pageNumber: Number(m[1]), text: m[2].trim() }))
}

export function TextViewerFallback({ contractText }: TextViewerFallbackProps) {
  const pages = useMemo(() => parsePages(contractText), [contractText])
  const targetPage = useUiStore((s) => s.targetPage)
  const refs = useRef<Record<number, HTMLElement | null>>({})

  useEffect(() => {
    if (targetPage && refs.current[targetPage]) {
      refs.current[targetPage]!.scrollIntoView({ behavior: 'smooth', block: 'start' })
      refs.current[targetPage]!.classList.add('bg-yellow-50')
      const timer = setTimeout(() => refs.current[targetPage]?.classList.remove('bg-yellow-50'), 2000)
      return () => clearTimeout(timer)
    }
  }, [targetPage])

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      {pages.map((p) => (
        <section
          key={p.pageNumber}
          ref={(el) => {
            refs.current[p.pageNumber] = el
          }}
          aria-label={`Page ${p.pageNumber}`}
          className={cn('rounded-md p-3 transition-colors duration-page')}
        >
          <h3 className="mb-2 text-body-sm font-medium text-grey-500">Page {p.pageNumber}</h3>
          <p className="whitespace-pre-wrap text-body-lg text-grey-900">{p.text}</p>
        </section>
      ))}
    </div>
  )
}
