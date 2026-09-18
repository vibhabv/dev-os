// Thin re-export — lib/security/rateLimiter.ts (skills/security-foundation/
// SKILL.md deliverable) is the canonical implementation. Kept at this path
// since withApiAuth.ts and existing tests (e.g. tests/integration/chat-
// route.test.ts) import/mock `checkLimit` from here specifically.
import { checkRateLimit } from '@/lib/security/rateLimiter'
import type { RateLimitAction } from '@/types/database'

export async function checkLimit(userId: string, action: RateLimitAction): Promise<boolean> {
  return checkRateLimit(userId, action)
}
