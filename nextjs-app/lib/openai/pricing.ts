export const PRICING = { inputPer1k: 0.005, outputPer1k: 0.015 }

export function calculateCostUsd(promptTokens: number, completionTokens: number): number {
  return (promptTokens / 1000) * PRICING.inputPer1k + (completionTokens / 1000) * PRICING.outputPer1k
}
