import { classifyQuery, buildChatSystemPrompt } from '@/lib/openai/prompts/chatSystemPrompt'

describe('lib/openai/prompts/chatSystemPrompt', () => {
  test('classifyQuery returns "contract" for a document-only question', () => {
    expect(classifyQuery('What is the payment term in this contract?')).toBe('contract')
    expect(classifyQuery('When does this agreement terminate?')).toBe('contract')
  })

  test('classifyQuery returns "history" for a question purely about the conversation', () => {
    expect(classifyQuery('What did I ask you earlier?')).toBe('history')
    expect(classifyQuery('Can you recap our conversation so far?')).toBe('history')
  })

  test('classifyQuery returns "both" when the question references history and the document', () => {
    expect(classifyQuery('What did you say earlier about the liability cap?')).toBe('both')
    expect(classifyQuery('As mentioned above, what page is the termination clause on?')).toBe('both')
  })

  test('classifyQuery returns "both" for an ambiguous pronoun-based follow-up, never bare "history"', () => {
    // A real regression: "what does that mean in practice" (following an
    // answer about governing law) matched neither keyword list, defaulted to
    // "contract", and the model — told to answer only from the document —
    // couldn't resolve "that" against the prior turn even though it was
    // right there in the message array.
    expect(classifyQuery('What does that mean in practice?')).toBe('both')
    expect(classifyQuery('Can you explain that?')).toBe('both')
    expect(classifyQuery('What do you mean by that?')).toBe('both')
  })

  test('buildChatSystemPrompt returns the contract-sourced prompt with the not-found fallback', () => {
    const prompt = buildChatSystemPrompt('contract')
    expect(prompt).toContain('Answer only from the contract. Cite [Page X].')
    expect(prompt).toContain('I cannot find this in the document')
  })

  test('buildChatSystemPrompt returns the history-sourced prompt', () => {
    const prompt = buildChatSystemPrompt('history')
    expect(prompt).toContain('Answer only from the conversation. End with [From conversation].')
  })

  test('buildChatSystemPrompt returns the both-sourced prompt with the not-found fallback', () => {
    const prompt = buildChatSystemPrompt('both')
    expect(prompt).toContain('Answer from both. Attribute each fact to its source.')
    expect(prompt).toContain('I cannot find this in the document')
  })

  test('buildChatSystemPrompt does not add the not-found fallback to the history prompt', () => {
    expect(buildChatSystemPrompt('history')).not.toContain('I cannot find this in the document')
  })

  test('buildChatSystemPrompt tells the model not to restate the question, for all three classifications', () => {
    expect(buildChatSystemPrompt('contract')).toContain('Do not restate or repeat the question')
    expect(buildChatSystemPrompt('history')).toContain('Do not restate or repeat the question')
    expect(buildChatSystemPrompt('both')).toContain('Do not restate or repeat the question')
  })

  test('buildChatSystemPrompt permits light interpretation of retrieved facts on contract/both, not history', () => {
    expect(buildChatSystemPrompt('contract')).toContain('You may briefly explain in plain language')
    expect(buildChatSystemPrompt('both')).toContain('You may briefly explain in plain language')
    expect(buildChatSystemPrompt('history')).not.toContain('You may briefly explain in plain language')
  })

  test('buildChatSystemPrompt still forbids legal advice and ungrounded information', () => {
    expect(buildChatSystemPrompt('contract')).toContain('do not provide legal advice')
    expect(buildChatSystemPrompt('both')).toContain('do not provide legal advice')
  })
})
