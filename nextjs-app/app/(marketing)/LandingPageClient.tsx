'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SignUpModal } from '@/components/auth/SignUpModal'
import { SignInModal } from '@/components/auth/SignInModal'
import { FooterAttribution } from '@/components/ui/FooterAttribution'
import { FileText, ShieldCheck, MessageSquareText } from 'lucide-react'

export function LandingPageClient() {
  const [signUpOpen, setSignUpOpen] = useState(false)
  const [signInOpen, setSignInOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex items-center justify-between px-6 py-4 md:px-28">
        <span className="text-h5 text-grey-900">ContractIQ</span>
        <Button variant="ghost" onClick={() => setSignInOpen(true)}>
          Sign In
        </Button>
      </header>

      <main className="flex flex-1 flex-col items-center gap-16 px-6 py-16 md:px-28 md:py-24">
        <section className="flex max-w-2xl flex-col items-center gap-6 text-center">
          <h1 className="text-h2 text-grey-900 md:text-h1">
            Understand any NDA or MSA in minutes, not hours.
          </h1>
          <p className="text-body-lg text-grey-500">
            Upload a contract and get an AI-extracted, page-cited, confidence-scored breakdown of every key
            term — plus a chat interface for follow-up questions. No lawyer required.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" onClick={() => setSignUpOpen(true)}>
              Get Started Free
            </Button>
            <Button size="lg" variant="outline" onClick={() => setSignInOpen(true)}>
              Sign In
            </Button>
          </div>
        </section>

        <section
          aria-label="Product preview"
          className="flex aspect-video w-full max-w-3xl items-center justify-center rounded-xl border border-grey-100 bg-grey-25 text-body-sm text-grey-400"
        >
          Product demo preview
        </section>

        <section className="grid w-full max-w-4xl gap-8 sm:grid-cols-3">
          <div className="flex flex-col items-center gap-3 text-center">
            <FileText className="h-6 w-6 text-blue-500" aria-hidden="true" />
            <h3 className="text-body-lg font-medium text-grey-900">Key terms, extracted</h3>
            <p className="text-body-sm text-grey-500">
              Every standard NDA or MSA term, pulled out with its exact page number.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 text-center">
            <ShieldCheck className="h-6 w-6 text-blue-500" aria-hidden="true" />
            <h3 className="text-body-lg font-medium text-grey-900">Confidence you can trust</h3>
            <p className="text-body-sm text-grey-500">
              Colour-coded confidence scores flag exactly what to double-check.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 text-center">
            <MessageSquareText className="h-6 w-6 text-blue-500" aria-hidden="true" />
            <h3 className="text-body-lg font-medium text-grey-900">Ask it anything</h3>
            <p className="text-body-sm text-grey-500">
              Chat with your contract and get answers grounded in the actual document.
            </p>
          </div>
        </section>
      </main>

      <FooterAttribution />

      <SignUpModal open={signUpOpen} onOpenChange={setSignUpOpen} onSwitchToSignIn={() => {
        setSignUpOpen(false)
        setSignInOpen(true)
      }} />
      <SignInModal open={signInOpen} onOpenChange={setSignInOpen} onSwitchToSignUp={() => {
        setSignInOpen(false)
        setSignUpOpen(true)
      }} />
    </div>
  )
}
