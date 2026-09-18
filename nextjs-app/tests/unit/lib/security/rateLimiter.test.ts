// checkRateLimit() and retryAfterSeconds() were previously covered only
// indirectly — every integration test mocks `@/lib/rate-limit/checkLimit`
// wholesale (tests/integration/chat-route.test.ts,
// tests/integration/contracts-route.test.ts), so the actual window/limit
// math in lib/security/rateLimiter.ts had zero test coverage anywhere in the
// suite. This file closes that gap directly.

const selectMock = jest.fn()
const insertMock = jest.fn().mockResolvedValue({ error: null })
const fromMock = jest.fn(() => ({ select: selectMock, insert: insertMock }))

jest.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ from: fromMock }),
}))

import { checkRateLimit, retryAfterSeconds } from '@/lib/security/rateLimiter'

function mockCount(count: number) {
  selectMock.mockReturnValue({
    eq: () => ({
      eq: () => ({
        gt: jest.fn().mockResolvedValue({ count }),
      }),
    }),
  })
}

describe('lib/security/rateLimiter', () => {
  beforeEach(() => {
    fromMock.mockClear()
    selectMock.mockReset()
    insertMock.mockClear()
  })

  test('checkRateLimit returns false and records an event when under the limit', async () => {
    mockCount(5) // well under the 20/day `upload` limit
    const limited = await checkRateLimit('user-1', 'upload')
    expect(limited).toBe(false)
    expect(insertMock).toHaveBeenCalledWith({ user_id: 'user-1', action: 'upload' })
  })

  test('checkRateLimit returns true and does not record an event once at the limit', async () => {
    mockCount(20) // at the `upload` limit (20/day)
    const limited = await checkRateLimit('user-1', 'upload')
    expect(limited).toBe(true)
    expect(insertMock).not.toHaveBeenCalled()
  })

  test('checkRateLimit reads/writes via the admin (service-role) client, not a session-bound one', async () => {
    mockCount(0)
    await checkRateLimit('user-1', 'chat')
    expect(fromMock).toHaveBeenCalledWith('rate_limit_events')
  })

  test('retryAfterSeconds matches each action\'s configured window', () => {
    expect(retryAfterSeconds('process')).toBe(60 * 60) // 1 hour
    expect(retryAfterSeconds('chat')).toBe(60 * 60) // 1 hour
    expect(retryAfterSeconds('upload')).toBe(24 * 60 * 60) // 1 day
    expect(retryAfterSeconds('auth')).toBe(60) // 1 minute
  })
})
