import { createSupabaseServerClient } from '@/lib/supabase/server'
import { jsonError } from '@/lib/api/jsonError'
import type { NextResponse } from 'next/server'

export type AuthResult = { userId: string; error?: undefined } | { userId?: undefined; error: NextResponse }

// Session-check primitive shared by withApiAuth.ts (wraps every existing
// authenticated route) and any Route Handler that needs the same check
// outside that wrapper's shape — e.g. app/api/auth/logout/route.ts, which
// isn't itself an "authenticated business-logic handler with optional rate
// limiting" the way withApiAuth's callers are.
export async function requireAuth(): Promise<AuthResult> {
  const supabase = createSupabaseServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return { error: jsonError('UNAUTHORIZED', 'You must be signed in to do this.', 401, false) }
  }
  return { userId: session.user.id }
}
