export const CHAT_PROMPT_VERSION = 'chat-v2.3'

export type QueryClassification = 'contract' | 'history' | 'both'

// Signals the question is about the conversation itself, not the document.
const HISTORY_KEYWORDS = [
  'earlier',
  'before',
  'previous',
  'you said',
  'we discussed',
  'we talked about',
  'last time',
  'above',
  'mentioned',
  'this conversation',
  'our conversation',
  'recap',
  'summarize our',
  'what did i ask',
  'what did you say',
  'what have we',
]

// Ambiguous pronoun-based continuations ("that", "this", "it") referring back
// to whatever was just discussed, without naming a document term or a
// history-specific phrase either — e.g. "what does that mean in practice"
// after an answer about governing law. These route straight to `both`
// (never `history` alone): `both` always includes contract text, so a false
// positive here never costs grounding, whereas `history` would drop the
// document entirely for what's very often actually a content question.
const FOLLOWUP_KEYWORDS = [
  'what does that mean',
  'what does this mean',
  'what does it mean',
  'does that mean',
  'does this mean',
  'explain that',
  'explain this',
  'what about that',
  'what about this',
  'elaborate',
  'in practice',
  'can you clarify',
  'what do you mean',
]

// Signals the question is about the document's content.
const CONTRACT_KEYWORDS = [
  'contract',
  'agreement',
  'clause',
  'section',
  'page',
  'term',
  'party',
  'parties',
  'liability',
  'payment',
  'termination',
  'terminate',
  'obligation',
  'indemnif',
  'confidential',
  'warrant',
  'governing law',
  'renewal',
  'expire',
  'expiration',
  'effective date',
  'signed',
  'deliverable',
  'penalty',
  'breach',
]

export function classifyQuery(message: string): QueryClassification {
  const lower = message.toLowerCase()
  const isFollowUp = FOLLOWUP_KEYWORDS.some((keyword) => lower.includes(keyword))
  const referencesHistory = HISTORY_KEYWORDS.some((keyword) => lower.includes(keyword))
  const referencesContract = CONTRACT_KEYWORDS.some((keyword) => lower.includes(keyword))

  if (isFollowUp) return 'both'
  if (referencesHistory && referencesContract) return 'both'
  if (referencesHistory) return 'history'
  return 'contract'
}

// The `contract`/`both` prompts append a not-found fallback: without it,
// GPT-4o tends to echo the question back rather than say it doesn't know
// when the document has no real answer, since neither base prompt otherwise
// instructs it what to do in that case.
const NOT_FOUND_FALLBACK = ' If the answer is not in the document, say "I cannot find this in the document."'

// None of the three base prompts specify an opening, and without one GPT-4o
// tends to restate the question as a preamble before answering it. Applied
// to all three since the habit isn't specific to one context type.
const NO_RESTATE = ' Do not restate or repeat the question in your response — answer it directly.'

// Without this, "answer only from the contract" was interpreted so literally
// that a plain-language follow-up like "what does that mean in practice"
// (after a fact was already correctly retrieved) got refused outright, even
// though the fact needed to answer it was already in hand. This permits
// brief plain-language explanation of an already-retrieved fact, while still
// forbidding anything not grounded in that fact — deliberately not "use
// general legal knowledge," which would open the door to real legal advice.
// Only on `contract`/`both`, which are the classifications that retrieve
// facts to explain; `history` is about the conversation itself.
const LIGHT_INTERPRETATION =
  ' You may briefly explain in plain language what an already-stated fact means in practice, but do not introduce any information beyond what is explicitly stated, and do not provide legal advice.'

const SYSTEM_PROMPTS: Record<QueryClassification, string> = {
  contract: `Answer only from the contract. Cite [Page X].${NOT_FOUND_FALLBACK}${LIGHT_INTERPRETATION}${NO_RESTATE}`,
  history: `Answer only from the conversation. End with [From conversation].${NO_RESTATE}`,
  both: `Answer from both. Attribute each fact to its source.${NOT_FOUND_FALLBACK}${LIGHT_INTERPRETATION}${NO_RESTATE}`,
}

export function buildChatSystemPrompt(classification: QueryClassification): string {
  return SYSTEM_PROMPTS[classification]
}
