export class InvalidModelOutputError extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'InvalidModelOutputError'
    // See lib/openai/withTimeout.ts's TimeoutError for why this is needed.
    Object.setPrototypeOf(this, InvalidModelOutputError.prototype)
  }
}
