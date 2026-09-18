import { createMockSupabaseServer } from './testUtils/mockSupabaseServer'

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(),
}))
jest.mock('@/lib/rate-limit/checkLimit', () => ({
  checkLimit: jest.fn().mockResolvedValue(false),
}))

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { POST } from '@/app/api/contracts/route'

const mockedCreateClient = createSupabaseServerClient as jest.Mock

function makeRequest(formData?: FormData): any {
  return {
    formData: async () => formData ?? new FormData(),
  }
}

describe('POST /api/contracts', () => {
  beforeEach(() => {
    mockedCreateClient.mockReset()
  })

  test('returns 401 UNAUTHORIZED when there is no session', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseServer({ session: null }))

    const res: any = await POST(makeRequest(), { params: {} })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
    expect(body.error.retryable).toBe(false)
  })

  test('returns 400 INVALID_CONTRACT_TYPE when contract_type is missing/invalid', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseServer())

    const formData = new FormData()
    formData.set('contract_type', 'invoice') // not 'nda' | 'msa'

    const res: any = await POST(makeRequest(formData), { params: {} })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_CONTRACT_TYPE')
    expect(body.error.fields).toBeDefined()
  })

  test('returns 400 INVALID_FILE_TYPE when no file is attached', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseServer())

    const formData = new FormData()
    formData.set('contract_type', 'nda')

    const res: any = await POST(makeRequest(formData), { params: {} })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_FILE_TYPE')
  })
})
