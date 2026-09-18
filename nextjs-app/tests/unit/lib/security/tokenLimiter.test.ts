import { isWithinMessageLengthLimit, isWithinChatHistoryLimit, MAX_MESSAGE_LENGTH, MAX_CHAT_HISTORY } from '@/lib/security/tokenLimiter'

describe('lib/security/tokenLimiter', () => {
  test('isWithinMessageLengthLimit enforces MAX_MESSAGE_LENGTH', () => {
    expect(isWithinMessageLengthLimit('a'.repeat(MAX_MESSAGE_LENGTH))).toBe(true)
    expect(isWithinMessageLengthLimit('a'.repeat(MAX_MESSAGE_LENGTH + 1))).toBe(false)
  })

  test('isWithinChatHistoryLimit enforces MAX_CHAT_HISTORY', () => {
    expect(isWithinChatHistoryLimit(MAX_CHAT_HISTORY)).toBe(true)
    expect(isWithinChatHistoryLimit(MAX_CHAT_HISTORY + 1)).toBe(false)
  })

  test('MAX_CHAT_HISTORY defaults to 100 when MAX_CHAT_HISTORY env var is unset', () => {
    expect(MAX_CHAT_HISTORY).toBe(Number(process.env.MAX_CHAT_HISTORY ?? 100))
  })
})
