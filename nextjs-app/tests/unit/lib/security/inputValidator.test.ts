import { validateFileUpload } from '@/lib/security/inputValidator'

describe('lib/security/inputValidator', () => {
  test('accepts a valid PDF', () => {
    expect(validateFileUpload({ name: 'contract.pdf', type: 'application/pdf', size: 1_000_000 })).toBeNull()
  })

  test('rejects a blocked extension before checking anything else', () => {
    const result = validateFileUpload({ name: 'malware.exe', type: 'application/pdf', size: 100 })
    expect(result?.code).toBe('BLOCKED_EXTENSION')
  })

  test('rejects other blocked extensions', () => {
    for (const name of ['script.js', 'payload.php', 'archive.zip', 'run.sh', 'batch.bat', 'exploit.py']) {
      expect(validateFileUpload({ name, type: 'application/pdf', size: 100 })?.code).toBe('BLOCKED_EXTENSION')
    }
  })

  test('rejects an unrecognized extension as invalid, not blocked', () => {
    const result = validateFileUpload({ name: 'notes.txt', type: 'text/plain', size: 100 })
    expect(result?.code).toBe('INVALID_FILE_TYPE')
  })

  test('rejects a spoofed MIME type on an allowed extension', () => {
    // Extension says .pdf but the browser/attacker-controlled Content-Type doesn't match.
    const result = validateFileUpload({ name: 'contract.pdf', type: 'application/x-msdownload', size: 100 })
    expect(result?.code).toBe('INVALID_MIME_TYPE')
  })

  test('rejects a file over the size limit', () => {
    const result = validateFileUpload({ name: 'contract.pdf', type: 'application/pdf', size: 10_485_761 })
    expect(result?.code).toBe('FILE_TOO_LARGE')
  })

  test('a renamed executable with a forged PDF Content-Type is still caught by the extension check', () => {
    const result = validateFileUpload({ name: 'totally-a-contract.pdf.exe', type: 'application/pdf', size: 100 })
    expect(result?.code).toBe('BLOCKED_EXTENSION')
  })
})
