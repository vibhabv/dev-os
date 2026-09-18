import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { RateLimitAction } from '@/types/database'

// Sliding-window limits, keyed by action. `process`/`chat` are the existing,
// already-documented values (docs/specs/13-rate-limiting-and-cost-control.md,
// docs/specs/04-key-term-extraction.md, docs/specs/09-contract-chat-and-
// realtime.md) — kept as-is rather than replaced with skills/security-
// foundation/SKILL.md's illustrative per-minute numbers, since these are
// approved, spec'd, and covered by existing tests. `upload` and `auth` are
// new: neither surface had any rate limit before this pass.
const WINDOW_MS: Record<RateLimitAction, number> = {
  process: 60 * 60 * 1000, // 1 hour
  chat: 60 * 60 * 1000, // 1 hour
  upload: 24 * 60 * 60 * 1000, // 1 day
  auth: 60 * 1000, // 1 minute
}

const LIMITS: Record<RateLimitAction, number> = {
  process: 20, // docs/specs/04-key-term-extraction.md
  chat: 60, // docs/specs/09-contract-chat-and-realtime.md
  upload: 20, // new — contract uploads had no cap before this pass
  auth: 10, // new — login attempts had no app-level cap before this pass
}

// Reads and writes always go through the service-role client, never the
// caller's own session — rate_limit_events has no UPDATE/DELETE RLS policy,
// so a user can't tamper with existing rows, but using the admin client here
// means this control never depends on RLS policy correctness for its
// integrity (skills/security-foundation/SKILL.md requirement 3: "so users
// cannot manipulate their own counts").
export async function checkRateLimit(userId: string, action: RateLimitAction): Promise<boolean> {
  const admin = createSupabaseAdminClient()
  const windowStart = new Date(Date.now() - WINDOW_MS[action]).toISOString()

  const { count } = await admin
    .from('rate_limit_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gt('created_at', windowStart)

  if ((count ?? 0) >= LIMITS[action]) return true

  await admin.from('rate_limit_events').insert({ user_id: userId, action })
  return false
}

export function retryAfterSeconds(action: RateLimitAction): number {
  return Math.ceil(WINDOW_MS[action] / 1000)
}
