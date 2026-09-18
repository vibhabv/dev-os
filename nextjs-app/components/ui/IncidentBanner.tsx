import { AlertTriangle } from 'lucide-react'

interface IncidentBannerProps {
  message: string
  statusPageUrl?: string
}

export function IncidentBanner({ message, statusPageUrl }: IncidentBannerProps) {
  return (
    <div role="alert" className="flex items-center justify-center gap-2 bg-red-50 px-4 py-2 text-body-sm text-red-700">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
      {statusPageUrl && (
        <a href={statusPageUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">
          Status page
        </a>
      )}
    </div>
  )
}
