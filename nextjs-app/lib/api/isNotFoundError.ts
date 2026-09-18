export function isNotFoundError(error: { message?: string; statusCode?: string } | null | undefined): boolean {
  if (!error) return false
  const message = error.message?.toLowerCase() ?? ''
  return error.statusCode === '404' || message.includes('not found') || message.includes('does not exist')
}
