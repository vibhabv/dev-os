import { Suspense } from 'react'
import { LandingPageClient } from './LandingPageClient'

export default function LandingPage() {
  return (
    <Suspense fallback={null}>
      <LandingPageClient />
    </Suspense>
  )
}
