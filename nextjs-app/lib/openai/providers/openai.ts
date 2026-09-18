import { openai } from '../client'
import { withTimeout } from '../withTimeout'
import { withRetry } from '../withRetry'
import { hashUserId } from '../hashUserId'
import { logUsage } from '../usageLogger'
import { InvalidModelOutputError } from '../errors'
import { validateExtractionSchema } from '@/lib/validation/extractionResultSchema'
import { ndaPrompt } from '../prompts/nda'
import { msaPrompt } from '../prompts/msa'
import { buildExtractionSystemPrompt } from '../prompts/shared'
import type { ExtractionProvider } from '../provider'

function tryParseJson(content: string | null | undefined): unknown | null {
  if (!content) return null
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

export const openaiExtractionProvider: ExtractionProvider = {
  async generateExtraction(contract, customTerms) {
    const startedAt = Date.now()
    const promptFile = contract.contract_type === 'nda' ? ndaPrompt : msaPrompt
    const systemPrompt = buildExtractionSystemPrompt(
      promptFile,
      customTerms.map((t) => t.term_name),
    )
    const userHash = hashUserId(contract.user_id)

    const call = () =>
      withTimeout(
        (signal) =>
          openai.chat.completions.create(
            {
              model: 'gpt-4o',
              response_format: { type: 'json_object' },
              temperature: 0.1,
              max_tokens: 2000,
              user: userHash,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: contract.contract_text },
              ],
            },
            { signal },
          ),
        20_000,
      )

    let raw = await withRetry(call, { attempts: 3, backoffMs: [1000, 2000, 4000] })
    let parsed = tryParseJson(raw.choices[0]?.message?.content)

    if (!parsed) {
      const previousContent = raw.choices[0]?.message?.content ?? ''
      const retryCall = () =>
        withTimeout(
          (signal) =>
            openai.chat.completions.create(
              {
                model: 'gpt-4o',
                response_format: { type: 'json_object' },
                temperature: 0.1,
                max_tokens: 2000,
                user: userHash,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: contract.contract_text },
                  { role: 'assistant', content: previousContent },
                  {
                    role: 'user',
                    content: 'Your previous response was not valid JSON. Return only the JSON array, no explanation.',
                  },
                ],
              },
              { signal },
            ),
          20_000,
        )
      raw = await withRetry(retryCall, { attempts: 3, backoffMs: [1000, 2000, 4000] })
      parsed = tryParseJson(raw.choices[0]?.message?.content)
    }

    if (!parsed || !validateExtractionSchema(parsed)) {
      throw new InvalidModelOutputError()
    }

    await logUsage({
      userId: contract.user_id,
      contractId: contract.id,
      operation: 'extraction',
      promptVersion: promptFile.PROMPT_VERSION,
      usage: {
        prompt_tokens: raw.usage?.prompt_tokens ?? 0,
        completion_tokens: raw.usage?.completion_tokens ?? 0,
      },
      durationMs: Date.now() - startedAt,
    })

    return parsed
  },
}
