import { jsonError } from '@/lib/api/jsonError'

export function mapUnhandledErrorToEnvelope(err: unknown) {
  console.error('Unhandled Route Handler error:', err)
  return jsonError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500, true)
}
