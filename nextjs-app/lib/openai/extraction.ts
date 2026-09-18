import { openaiExtractionProvider } from './providers/openai'
import type { ExtractionProvider } from './provider'
import type { ContractRecord, CustomKeyTerm } from '@/types/domain'
import type { ExtractionResult } from '@/lib/validation/extractionResultSchema'

// Swappable per docs/specs/04-key-term-extraction.md "Provider abstraction" —
// providers/anthropic.ts or providers/gemini.ts can replace this without any
// change to the route handler, as long as they implement ExtractionProvider.
const activeProvider: ExtractionProvider = openaiExtractionProvider

export async function runExtraction(contract: ContractRecord, customTerms: CustomKeyTerm[]): Promise<ExtractionResult> {
  return activeProvider.generateExtraction(contract, customTerms)
}
