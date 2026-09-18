import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/api/jsonError'
import { mapUnhandledErrorToEnvelope } from '@/lib/api/mapUnhandledErrorToEnvelope'
import { checkLimit } from '@/lib/rate-limit/checkLimit'
import { requireAuth } from '@/lib/security/authGuard'
import { retryAfterSeconds } from '@/lib/security/rateLimiter'
import type { RateLimitAction } from '@/types/database'

type RouteContext = { params: Record<string, string> }
type Handler = (req: NextRequest, ctx: { userId: string; params: Record<string, string> }) => Promise<Response>

export function withApiAuth(handler: Handler, opts?: { rateLimitAction?: RateLimitAction }) {
  return async (req: NextRequest, ctx: RouteContext): Promise<Response> => {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { userId } = auth

    if (opts?.rateLimitAction) {
      const limited = await checkLimit(userId, opts.rateLimitAction)
      if (limited) {
        const res = jsonError(
          'RATE_LIMITED',
          "You've made too many requests. Please wait a few minutes and try again.",
          429,
          true,
        )
        res.headers.set('Retry-After', String(retryAfterSeconds(opts.rateLimitAction)))
        return res
      }
    }

    try {
      return await handler(req, { userId, params: ctx.params })
    } catch (err) {
      return mapUnhandledErrorToEnvelope(err)
    }
  }
}

export type { NextResponse }
