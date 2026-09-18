import { TimeoutError } from '@/lib/openai/withTimeout'

const RETRYABLE_STATUS_CODES = new Set([408, 409, 429, 500, 502, 503, 504])

function isRetryable(err: any): boolean {
  if (err instanceof TimeoutError) return true
  const status = err?.status ?? err?.response?.status
  return typeof status === 'number' && RETRYABLE_STATUS_CODES.has(status)
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts: number; backoffMs: number[] },
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < opts.attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isRetryable(err)) throw err
      if (attempt < opts.attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, opts.backoffMs[attempt]))
      }
    }
  }
  throw lastErr
}
