import { createHash } from 'crypto'

// Every OpenAI call passes this hash (never the raw Supabase user_id) as the
// `user` field, for OpenAI-side abuse monitoring without exposing internal
// identifiers — per docs/specs/04-key-term-extraction.md "Data-use config".
export function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex')
}
