'use client'

import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '@/lib/store/uiStore'
import { PdfRenderErrorFallback } from '@/components/results/PdfRenderErrorFallback'

interface PdfViewerProps {
  signedUrl: string
  onSwitchToText: () => void
}

export function PdfViewer({ signedUrl, onSwitchToText }: PdfViewerProps) {
  const targetPage = useUiStore((s) => s.targetPage)
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const [renderError, setRenderError] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        // Served as a static file from public/ (see scripts/copyPdfWorker.js) rather than
        // imported/bundled by webpack — pdfjs-dist's worker uses top-level `import.meta`,
        // which Next's production Terser pass cannot minify when webpack treats it as an
        // asset module.
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

        const loadingTask = pdfjsLib.getDocument({ url: signedUrl })
        const pdf = await loadingTask.promise
        if (cancelled || !containerRef.current) return

        containerRef.current.innerHTML = ''
        pageRefs.current = {}

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum)
          const viewport = page.getViewport({ scale: 1.3 })

          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.className = 'mx-auto block'

          const wrapper = document.createElement('div')
          wrapper.setAttribute('aria-label', `Page ${pageNum}`)
          wrapper.className = 'mb-4 rounded-md border border-grey-100 p-2 transition-shadow duration-page'
          wrapper.appendChild(canvas)
          containerRef.current.appendChild(wrapper)
          pageRefs.current[pageNum] = wrapper

          const context = canvas.getContext('2d')
          if (!context) continue
          await page.render({ canvasContext: context, viewport, canvas }).promise
          if (cancelled) return
        }

        if (!cancelled) setReady(true)
      } catch {
        if (!cancelled) setRenderError(true)
      }
    }

    render()

    return () => {
      cancelled = true
    }
  }, [signedUrl])

  useEffect(() => {
    if (!targetPage || !ready) return
    const el = pageRefs.current[targetPage]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el.classList.add('ring-2', 'ring-blue-500')
      const timer = setTimeout(() => el.classList.remove('ring-2', 'ring-blue-500'), 2000)
      return () => clearTimeout(timer)
    }
  }, [targetPage, ready])

  if (renderError) {
    return <PdfRenderErrorFallback signedUrl={signedUrl} onSwitchToText={onSwitchToText} />
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      {!ready && <p className="text-body-sm text-grey-400">Loading PDF…</p>}
      <div ref={containerRef} />
    </div>
  )
}
