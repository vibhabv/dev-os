import { createSupabaseServerClient } from '@/lib/supabase/server'
import { calculateCostUsd } from '@/lib/openai/pricing'
import type { UsageOperation } from '@/types/database'

export async function logUsage(args: {
  userId: string
  contractId: string | null
  operation: UsageOperation
  promptVersion: string
  usage: { prompt_tokens: number; completion_tokens: number }
  durationMs: number
}) {
  const supabaseServer = createSupabaseServerClient()
  const costUsd = calculateCostUsd(args.usage.prompt_tokens, args.usage.completion_tokens)

  const { error } = await supabaseServer.from('openai_usage_log').insert({
    user_id: args.userId,
    contract_id: args.contractId,
    operation: args.operation,
    prompt_version: args.promptVersion,
    input_tokens: args.usage.prompt_tokens,
    output_tokens: args.usage.completion_tokens,
    cost_usd: costUsd,
    duration_ms: args.durationMs,
  })

  if (error) {
    // Never throws — a lost usage-log row must not fail the already-completed
    // extraction/chat request it describes. Still logged (not dropped) since
    // cost-monitor.ts's budget alert depends on this table being complete.
    console.error('Failed to write openai_usage_log row', { userId: args.userId, operation: args.operation, error })
  }
}
