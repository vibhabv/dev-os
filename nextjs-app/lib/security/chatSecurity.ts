// Explicit, reusable ownership checks for the chat surface. loadContractOwnedBy()
// (lib/api/loadContractOwnedBy.ts) already filters by owner, and chat_sessions.
// contract_id is unique per contract — so a session returned for an
// already-owned contract can only ever belong to that same user by
// construction. These functions make that invariant an explicit, checked
// assertion (defense in depth) rather than an implicit property of how the
// query happens to be written today, per skills/security-foundation/
// SKILL.md requirement 6.

export function verifyContractOwnership(contract: { user_id: string } | null, userId: string): boolean {
  return contract?.user_id === userId
}

export function verifySessionOwnership(session: { user_id: string } | null, userId: string): boolean {
  return session?.user_id === userId
}
