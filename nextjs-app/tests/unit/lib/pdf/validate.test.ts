import {
  isValidMimeType,
  isWithinSizeLimit,
  isWithinPageLimit,
  isLikelyScanned,
  isWithinTokenLimit,
  countWords,
} from '@/lib/pdf/validate'

describe('lib/pdf/validate', () => {
  test('isValidMimeType accepts only application/pdf', () => {
    expect(isValidMimeType('application/pdf')).toBe(true)
    expect(isValidMimeType('image/png')).toBe(false)
    expect(isValidMimeType('')).toBe(false)
  })

  test('isWithinSizeLimit enforces the 10MB cap inclusively', () => {
    expect(isWithinSizeLimit(10_485_760)).toBe(true)
    expect(isWithinSizeLimit(10_485_761)).toBe(false)
    expect(isWithinSizeLimit(0)).toBe(true)
  })

  test('isWithinPageLimit enforces the 20-page cap inclusively', () => {
    expect(isWithinPageLimit(20)).toBe(true)
    expect(isWithinPageLimit(21)).toBe(false)
  })

  test('isLikelyScanned flags documents under 100 words', () => {
    expect(isLikelyScanned(99)).toBe(true)
    expect(isLikelyScanned(100)).toBe(false)
  })

  test('isWithinTokenLimit enforces the 15,000 token cap inclusively', () => {
    expect(isWithinTokenLimit(15000)).toBe(true)
    expect(isWithinTokenLimit(15001)).toBe(false)
  })

  test('countWords counts whitespace-separated tokens and ignores extra whitespace', () => {
    expect(countWords('  hello   world  ')).toBe(2)
    expect(countWords('')).toBe(0)
    expect(countWords('one\ntwo\tthree')).toBe(3)
  })
})
