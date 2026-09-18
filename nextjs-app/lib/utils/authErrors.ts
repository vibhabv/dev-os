const MAP: Record<string, string> = {
  'Invalid login credentials': 'Invalid email or password.',
  'User already registered': 'An account with this email already exists. Try signing in instead.',
  'Password should be at least 6 characters': 'Password must be at least 8 characters.',
  'Email not confirmed': 'Please verify your email before signing in — check your inbox for the confirmation link.',
}

export function mapAuthError(rawMessage: string | undefined | null): string {
  if (!rawMessage) return 'Something went wrong. Please try again.'
  return MAP[rawMessage] ?? 'Something went wrong. Please try again.'
}
