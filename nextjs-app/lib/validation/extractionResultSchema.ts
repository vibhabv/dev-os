import { z } from 'zod'

export const extractionTermSchema = z.object({
  term_name: z.string().min(1),
  value: z.string(),
  page_number: z.number().int().min(1),
  confidence_score: z.number().min(0).max(1),
  source_sentence: z.string(),
  term_source: z.enum(['standard', 'custom']),
})

export const extractionResultSchema = z.object({
  detected_contract_type: z.enum(['nda', 'msa', 'other']),
  terms: z.array(extractionTermSchema),
})

export type ExtractionTerm = z.infer<typeof extractionTermSchema>
export type ExtractionResult = z.infer<typeof extractionResultSchema>

export function validateExtractionSchema(data: unknown): data is ExtractionResult {
  return extractionResultSchema.safeParse(data).success
}
