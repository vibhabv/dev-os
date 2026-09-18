import { validateExtractionSchema } from '@/lib/validation/extractionResultSchema'

describe('lib/validation/extractionResultSchema', () => {
  test('accepts a well-formed extraction result', () => {
    const valid = {
      detected_contract_type: 'nda',
      terms: [
        {
          term_name: 'Parties',
          value: 'Acme Inc. and Beta LLC',
          page_number: 1,
          confidence_score: 0.95,
          source_sentence: 'This Agreement is between Acme Inc. and Beta LLC.',
          term_source: 'standard',
        },
      ],
    }
    expect(validateExtractionSchema(valid)).toBe(true)
  })

  test('rejects a confidence_score outside 0-1', () => {
    const invalid = {
      detected_contract_type: 'nda',
      terms: [
        {
          term_name: 'Parties',
          value: 'Acme Inc.',
          page_number: 1,
          confidence_score: 95, // should be 0-1, not 0-100
          source_sentence: '...',
          term_source: 'standard',
        },
      ],
    }
    expect(validateExtractionSchema(invalid)).toBe(false)
  })

  test('rejects a missing detected_contract_type', () => {
    expect(validateExtractionSchema({ terms: [] })).toBe(false)
  })

  test('rejects a page_number less than 1', () => {
    const invalid = {
      detected_contract_type: 'msa',
      terms: [
        {
          term_name: 'Parties',
          value: 'Acme Inc.',
          page_number: 0,
          confidence_score: 0.5,
          source_sentence: '...',
          term_source: 'standard',
        },
      ],
    }
    expect(validateExtractionSchema(invalid)).toBe(false)
  })

  test('rejects a completely malformed payload', () => {
    expect(validateExtractionSchema(null)).toBe(false)
    expect(validateExtractionSchema('not json')).toBe(false)
    expect(validateExtractionSchema(42)).toBe(false)
  })
})
