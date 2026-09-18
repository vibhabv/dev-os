'use client'

import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  return {
    session,
    user: (session?.user ?? null) as User | null,
    loading,
    signOut: async () => {
      // Server-side sign-out first (clears the session via a real Set-Cookie
      // response header — skills/security-foundation/SKILL.md), then the
      // browser client's own signOut() to update this hook's reactive state
      // via onAuthStateChange, same as before. Calling it after the session
      // is already server-invalidated is a harmless no-op, not a race — it
      // only clears local client state.
      try {
        await fetch('/api/auth/logout', { method: 'POST' })
      } catch {
        // Network failure — fall through to the client-side signOut below so
        // the user isn't stuck "signed in" in the UI even if the server call
        // didn't land; worst case the server session outlives this tab.
      }
      const supabase = createSupabaseBrowserClient()
      await supabase.auth.signOut()
    },
  }
}
