import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PdfRenderErrorFallbackProps {
  signedUrl: string
  onSwitchToText: () => void
}

export function PdfRenderErrorFallback({ signedUrl, onSwitchToText }: PdfRenderErrorFallbackProps) {
  return (
    <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-body-lg text-grey-900">This PDF couldn&apos;t be previewed.</p>
      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <a href={signedUrl} download>
            <Download className="h-4 w-4" /> Download PDF
          </a>
        </Button>
        <Button onClick={onSwitchToText}>View as text instead</Button>
      </div>
    </div>
  )
}
