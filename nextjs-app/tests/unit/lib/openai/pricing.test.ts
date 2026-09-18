import { calculateCostUsd } from '@/lib/openai/pricing'

describe('lib/openai/pricing', () => {
  test('computes cost from input/output token counts at the documented per-1k rates', () => {
    // 15,000 input tokens + 2,000 output tokens ≈ the extraction cost target in spec 04
    const cost = calculateCostUsd(15000, 2000)
    expect(cost).toBeCloseTo(15 * 0.005 + 2 * 0.015, 6)
    expect(cost).toBeLessThanOrEqual(0.2) // spec 04's ≤$0.20/extraction target
  })

  test('returns 0 for zero tokens', () => {
    expect(calculateCostUsd(0, 0)).toBe(0)
  })

  test('input and output are priced independently', () => {
    expect(calculateCostUsd(1000, 0)).toBeCloseTo(0.005, 6)
    expect(calculateCostUsd(0, 1000)).toBeCloseTo(0.015, 6)
  })
})
