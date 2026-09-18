// Re-exports the limits already enforced elsewhere in the app as a single
// security-facing reference point, rather than duplicating the numbers (and
// risking drift). All of these are already stricter than skills/security-
// foundation/SKILL.md's illustrative ceilings (200 pages, 5000 chars) —
// existing, tested, spec'd values were kept rather than loosened to match
// the skill's generic template.

export { isWithinSizeLimit as isWithinFileSizeLimit, isWithinPageLimit } from '@/lib/pdf/validate'

// docs/specs/03-pdf-upload-and-extraction.md — Supabase Storage bucket limit.
export const MAX_FILE_SIZE_BYTES = 10_485_760

// lib/pdf/validate.ts — isWithinPageLimit().
export const MAX_PAGE_COUNT = 20

// lib/validation/chatMessageSchema.ts — already enforced via Zod, stricter
// than the skill's 5000-character ceiling.
export const MAX_MESSAGE_LENGTH = 2000

// New: an explicit, configurable ceiling on how many prior chat_messages
// rows the Conversation Memory Layer (lib/openai/chat.ts's loadMessages(),
// docs/specs/09-contract-chat-and-realtime.md) may ever request in one call,
// independent of that feature's own smaller 10/20-turn windows — a defense-
// in-depth cap in case those per-classification limits are ever raised or
// misconfigured. Not currently wired into loadMessages()'s call sites, both
// of which already request far fewer (10 or 20) than this default.
export const MAX_CHAT_HISTORY = Number(process.env.MAX_CHAT_HISTORY ?? 100)

export function isWithinMessageLengthLimit(message: string): boolean {
  return message.length <= MAX_MESSAGE_LENGTH
}

export function isWithinChatHistoryLimit(requestedLimit: number): boolean {
  return requestedLimit <= MAX_CHAT_HISTORY
}
