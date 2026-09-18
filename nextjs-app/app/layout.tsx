import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { IncidentBanner } from '@/components/ui/IncidentBanner'

// Google Fonts has no family literally named "Inter Display" — Inter is its
// closest/canonical web equivalent per docs/design.md's "Inter Display (all
// weights)" spec, loaded under the --font-inter-display token so component
// code and Tailwind's fontFamily.sans never reference the substitution.
const interDisplay = Inter({
  subsets: ['latin'],
  variable: '--font-inter-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ContractIQ',
  description: 'AI-powered NDA and MSA key-term extraction, page-cited and confidence-scored.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const bannerMessage = process.env.NEXT_PUBLIC_INCIDENT_BANNER

  return (
    <html lang="en" className={interDisplay.variable}>
      <body>
        <QueryProvider>
          <TooltipProvider delayDuration={150}>
            {bannerMessage && (
              <IncidentBanner message={bannerMessage} statusPageUrl={process.env.NEXT_PUBLIC_STATUS_PAGE_URL} />
            )}
            {children}
            <Toaster />
          </TooltipProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
