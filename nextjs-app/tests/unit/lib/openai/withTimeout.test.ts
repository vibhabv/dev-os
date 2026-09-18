import { withTimeout, TimeoutError } from '@/lib/openai/withTimeout'

describe('lib/openai/withTimeout', () => {
  test('resolves normally when the promise settles before the timeout', async () => {
    const result = await withTimeout(async () => 'done', 50)
    expect(result).toBe('done')
  })

  test('throws TimeoutError when the promise takes longer than the timeout', async () => {
    const slow = (signal: AbortSignal) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve('too slow'), 100)
        signal.addEventListener('abort', () => {
          clearTimeout(timer)
          const err = new Error('aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })

    await expect(withTimeout(slow, 10)).rejects.toBeInstanceOf(TimeoutError)
  })

  test('propagates a non-timeout error unchanged', async () => {
    await expect(
      withTimeout(async () => {
        throw new Error('boom')
      }, 50),
    ).rejects.toThrow('boom')
  })
})
