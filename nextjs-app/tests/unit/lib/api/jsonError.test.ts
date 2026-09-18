import { jsonError } from '@/lib/api/jsonError'

describe('lib/api/jsonError', () => {
  test('builds the standardized error envelope without fields', async () => {
    const res = jsonError('CONTRACT_NOT_FOUND', 'Contract not found.', 404, false)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toEqual({
      error: { code: 'CONTRACT_NOT_FOUND', message: 'Contract not found.', retryable: false },
    })
  })

  test('includes fields when provided (zod validation failures)', async () => {
    const res = jsonError('INVALID_CONTRACT_TYPE', 'Contract type must be NDA or MSA.', 400, false, {
      contractType: 'Contract type must be NDA or MSA.',
    })
    const body = await res.json()
    expect(body.error.fields).toEqual({ contractType: 'Contract type must be NDA or MSA.' })
  })

  test('retryable flag is passed through unchanged', async () => {
    const res = jsonError('OPENAI_ERROR', 'OpenAI is temporarily unavailable.', 502, true)
    const body = await res.json()
    expect(body.error.retryable).toBe(true)
  })
})
