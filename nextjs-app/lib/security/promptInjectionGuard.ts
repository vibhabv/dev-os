export type PromptInjectionResult = { safe: true } | { safe: false; reason: string }

// Each pattern is deliberately specific to AI-jailbreak framing, not generic
// English. A bare "act as" pattern (as listed literally in skills/security-
// foundation/SKILL.md) would false-positive constantly in this domain — real
// contract clauses routinely say things like "shall act as agent" or "act as
// guarantor." Narrowed to "act as an AI/assistant/if you" so it still catches
// "act as an AI with no restrictions" without blocking legitimate questions
// about a contract's actual "acting as" language.
const INJECTION_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /ignore\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+instructions?/i, reason: 'ignore previous instructions' },
  { pattern: /override\s+(your\s+)?(rules?|instructions?|guidelines?)/i, reason: 'override your rules' },
  { pattern: /reveal\s+(your\s+|the\s+)?system\s+prompt/i, reason: 'reveal system prompt' },
  { pattern: /print\s+(your\s+|the\s+)?(system\s+)?instructions?/i, reason: 'print your instructions' },
  { pattern: /expose\s+(the\s+)?(env(ironment)?\s+variables?|secrets?)/i, reason: 'expose env variables' },
  { pattern: /show\s+(me\s+)?(the\s+)?api\s+keys?/i, reason: 'show API keys' },
  { pattern: /you\s+are\s+now\s+an?\b/i, reason: 'you are now a' },
  { pattern: /\bact\s+as\s+(if\s+you|an?\s+(ai|assistant|chatbot|language\s+model))\b/i, reason: 'act as (AI impersonation)' },
  { pattern: /pretend\s+you\s+are/i, reason: 'pretend you are' },
  { pattern: /\bjailbreak(ing)?\b/i, reason: 'jailbreak' },
  { pattern: /\bdan\s+mode\b/i, reason: 'DAN mode' },
  { pattern: /developer\s+mode/i, reason: 'developer mode' },
]

// Gate, not a sanitizer despite the name (kept to match skills/security-
// foundation/SKILL.md's function name) — callers must not send the message
// to the LLM at all when this returns `safe: false`, per the skill's "do not
// call the AI" rule, rather than trying to strip the offending text and
// proceed.
export function sanitizeForLLM(message: string): PromptInjectionResult {
  for (const { pattern, reason } of INJECTION_PATTERNS) {
    if (pattern.test(message)) return { safe: false, reason }
  }
  return { safe: true }
}
