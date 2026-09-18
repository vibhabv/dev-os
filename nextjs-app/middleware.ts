import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const config = { matcher: ['/dashboard/:path*', '/contracts/:path*', '/account'] }

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: '', ...options })
        },
      },
    },
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    const url = new URL('/', req.url)
    url.searchParams.set('redirect', req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  if (process.env.BETA_MODE_ENABLED === 'true') {
    const { data: betaRow } = await supabase
      .from('beta_access')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (!betaRow && req.nextUrl.pathname !== '/beta-waitlist') {
      return NextResponse.redirect(new URL('/beta-waitlist', req.url))
    }
  }

  return res
}
