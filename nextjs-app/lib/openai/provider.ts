import type { ContractRecord, CustomKeyTerm } from '@/types/domain'
import type { ExtractionResult } from '@/lib/validation/extractionResultSchema'

export interface ExtractionProvider {
  generateExtraction(contract: ContractRecord, customTerms: CustomKeyTerm[]): Promise<ExtractionResult>
}
