import { verifyContractOwnership, verifySessionOwnership } from '@/lib/security/chatSecurity'

describe('lib/security/chatSecurity', () => {
  test('verifyContractOwnership matches on user_id', () => {
    expect(verifyContractOwnership({ user_id: 'user-1' }, 'user-1')).toBe(true)
    expect(verifyContractOwnership({ user_id: 'user-2' }, 'user-1')).toBe(false)
    expect(verifyContractOwnership(null, 'user-1')).toBe(false)
  })

  test('verifySessionOwnership matches on user_id', () => {
    expect(verifySessionOwnership({ user_id: 'user-1' }, 'user-1')).toBe(true)
    expect(verifySessionOwnership({ user_id: 'user-2' }, 'user-1')).toBe(false)
    expect(verifySessionOwnership(null, 'user-1')).toBe(false)
  })
})
