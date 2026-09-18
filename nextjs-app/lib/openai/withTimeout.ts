export class TimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
    // Restores the prototype chain — required for `instanceof TimeoutError` to work
    // reliably when TypeScript downlevels `class ... extends Error` to an ES5 target
    // (a well-known TS/ES5 pitfall). The process and chat Route Handlers both branch
    // on `err instanceof TimeoutError` to choose between 504 TIMEOUT and 502
    // OPENAI_ERROR, so this must hold regardless of the active compile target.
    Object.setPrototypeOf(this, TimeoutError.prototype)
  }
}

export async function withTimeout<T>(
  promiseFactory: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await promiseFactory(controller.signal)
  } catch (err: any) {
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      throw new TimeoutError(`OpenAI call exceeded ${ms}ms`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
