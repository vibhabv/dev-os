import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/security/authGuard'

// Server-side sign-out so the session cookie is cleared via a proper
// Set-Cookie response header, not just local client-side state. The client
// (hooks/useAuth.ts) must call this instead of the browser client's
// supabase.auth.signOut() directly, per skills/security-foundation/SKILL.md.
export async function POST() {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const supabase = createSupabaseServerClient()
  await supabase.auth.signOut()

  return NextResponse.json({ signed_out: true })
}
