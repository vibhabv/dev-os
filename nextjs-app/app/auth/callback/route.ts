import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/?error=auth_callback_failed', req.url))
  }

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    return NextResponse.redirect(new URL('/?error=auth_callback_failed', req.url))
  }

  if (process.env.BETA_MODE_ENABLED === 'true') {
    const admin = createSupabaseAdminClient()
    const { data: granted, error: rpcError } = await admin.rpc('grant_beta_access', {
      p_user_id: data.session.user.id,
    })

    if (rpcError) {
      return NextResponse.redirect(new URL('/beta-waitlist', req.url))
    }

    return NextResponse.redirect(new URL(granted ? '/dashboard' : '/beta-waitlist', req.url))
  }

  return NextResponse.redirect(new URL('/dashboard', req.url))
}
