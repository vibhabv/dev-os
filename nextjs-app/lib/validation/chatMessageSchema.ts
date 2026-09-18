import { z } from 'zod'

export const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty.').max(2000, 'Message must be 2000 characters or fewer.'),
  // Client-generated id for the optimistic user-message bubble. When present,
  // the server inserts the row with this exact id so the Realtime INSERT
  // event for it carries the same id as the optimistic entry already
  // rendered in this tab — without this, the dedup check in
  // useChatSession.ts's postgres_changes handler (`old.some(m => m.id ===
  // payload.new.id)`) never matches (a fresh, different id is generated
  // server-side instead), and the user's own message renders twice.
  id: z.string().uuid().optional(),
})
