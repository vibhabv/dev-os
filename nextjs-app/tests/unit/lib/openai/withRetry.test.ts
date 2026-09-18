import { withRetry } from '@/lib/openai/withRetry'
import { TimeoutError } from '@/lib/openai/withTimeout'

describe('lib/openai/withRetry', () => {
  test('returns the result on first success without retrying', async () => {
    const fn = jest.fn().mockResolvedValue('ok')
    const result = await withRetry(fn, { attempts: 3, backoffMs: [1, 1] })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('retries on a retryable status code and eventually succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValueOnce('recovered')

    const result = await withRetry(fn, { attempts: 3, backoffMs: [1, 1] })
    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  test('retries on TimeoutError', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new TimeoutError('timed out')).mockResolvedValueOnce('ok')
    const result = await withRetry(fn, { attempts: 2, backoffMs: [1] })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  test('does not retry a non-retryable error (e.g. 400) and fails fast', async () => {
    const fn = jest.fn().mockRejectedValue({ status: 400 })
    await expect(withRetry(fn, { attempts: 3, backoffMs: [1, 1] })).rejects.toEqual({ status: 400 })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('exhausts all attempts and throws the last error', async () => {
    const fn = jest.fn().mockRejectedValue({ status: 500 })
    await expect(withRetry(fn, { attempts: 3, backoffMs: [1, 1] })).rejects.toEqual({ status: 500 })
    expect(fn).toHaveBeenCalledTimes(3)
  })
})
