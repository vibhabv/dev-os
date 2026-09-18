'use client'

import { useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { mapAuthError } from '@/lib/utils/authErrors'

interface SignInModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSwitchToSignUp: () => void
}

export function SignInModal({ open, onOpenChange, onSwitchToSignUp }: SignInModalProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const supabase = createSupabaseBrowserClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)

    if (signInError) {
      setError(mapAuthError(signInError.message))
      return
    }

    const redirect = searchParams.get('redirect')
    onOpenChange(false)
    router.push(redirect && redirect.startsWith('/') ? redirect : '/dashboard')
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setEmail('')
      setPassword('')
      setError(null)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>Welcome back</DialogTitle>
            <DialogDescription>Sign in to continue reviewing your contracts.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="signin-email">Email</Label>
              <Input
                id="signin-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="signin-password">Password</Label>
              <Input
                id="signin-password"
                type="password"
                required
                autoComplete="current-password"
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
              {submitting ? 'Signing in…' : 'Sign In'}
            </Button>
            <button
              type="button"
              onClick={onSwitchToSignUp}
              className="text-body-sm text-grey-500 hover:text-grey-900"
            >
              Don&apos;t have an account? Get started free
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
