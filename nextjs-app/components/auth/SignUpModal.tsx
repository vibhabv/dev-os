'use client'

import { useState, type FormEvent } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { mapAuthError } from '@/lib/utils/authErrors'

interface SignUpModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSwitchToSignIn: () => void
}

export function SignUpModal({ open, onOpenChange, onSwitchToSignIn }: SignUpModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setSubmitting(true)
    const supabase = createSupabaseBrowserClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/auth/callback` },
    })
    setSubmitting(false)

    if (signUpError) {
      setError(mapAuthError(signUpError.message))
      return
    }

    setConfirmationSent(true)
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setEmail('')
      setPassword('')
      setError(null)
      setConfirmationSent(false)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {confirmationSent ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Check your email</DialogTitle>
              <DialogDescription>
                We sent a verification link to {email}. Click it to activate your account.
              </DialogDescription>
            </DialogHeader>
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
            <DialogHeader>
              <DialogTitle>Create your account</DialogTitle>
              <DialogDescription>Start reviewing contracts in minutes, not hours.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="text-body-sm text-red-700">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating account…' : 'Get Started Free'}
              </Button>
              <button
                type="button"
                onClick={onSwitchToSignIn}
                className="text-body-sm text-grey-500 hover:text-grey-900"
              >
                Already have an account? Sign in
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
