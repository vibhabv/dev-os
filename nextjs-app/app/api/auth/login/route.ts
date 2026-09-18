import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { jsonError } from '@/lib/api/jsonError'
import { mapAuthError } from '@/lib/utils/authErrors'

// Not wrapped in withApiAuth — the caller isn't authenticated yet, by
// definition. No app-level rate limit is applied here: rate_limit_events.user_id
// is NOT NULL with a FK to auth.users (docs/specs/supabase-schema.sql), so it
// cannot key a limiter on requests that don't yet resolve to a known user —
// keying by email would leak which emails have accounts via timing/response
// differences, and keying by IP isn't available from this handler's inputs.
// Login abuse is covered instead by Supabase Auth's own server-side rate
// limiting, which applies regardless of what this app builds on top of it.
// Documented as a deliberate scope boundary in docs/security/security-plan.md.
const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', parsed.error.issues[0].message, 422, false)
  }

  // createSupabaseServerClient() uses next/headers' cookies() under the hood
  // (lib/supabase/server.ts), which a Route Handler is allowed to mutate —
  // unlike a Server Component render, the Set-Cookie header from this call
  // is correctly attached to the response.
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error || !data.session) {
    return jsonError('LOGIN_FAILED', mapAuthError(error?.message), 401, false)
  }

  return NextResponse.json({ user_id: data.session.user.id, email: data.session.user.email })
}
