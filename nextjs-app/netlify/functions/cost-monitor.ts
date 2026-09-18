import { schedule } from '@netlify/functions'
import { startOfMonth } from 'date-fns'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { postSlackAlert } from '@/lib/monitoring/postSlackAlert'
import { getStorageUsagePercent } from '@/lib/monitoring/getStorageUsagePercent'

export const handler = schedule('@daily', async () => {
  const admin = createSupabaseAdminClient()
  const monthStart = startOfMonth(new Date()).toISOString()

  const { data } = await admin.from('openai_usage_log').select('cost_usd').gte('created_at', monthStart)
  const totalCost = (data ?? []).reduce((sum, r) => sum + Number(r.cost_usd), 0)
  const budget = Number(process.env.OPENAI_MONTHLY_BUDGET_USD ?? 500)

  if (totalCost >= budget * 0.8) {
    await postSlackAlert(
      process.env.SLACK_COST_ALERT_WEBHOOK_URL,
      `OpenAI spend this month: $${totalCost.toFixed(2)} (${Math.round((totalCost / budget) * 100)}% of $${budget} budget)`,
    )
  }

  const storagePercentUsed = await getStorageUsagePercent(admin)
  if (storagePercentUsed >= 70) {
    await postSlackAlert(
      process.env.SLACK_COST_ALERT_WEBHOOK_URL,
      `Supabase Storage usage at ${storagePercentUsed}% of plan quota.`,
    )
  }

  return { statusCode: 200, body: JSON.stringify({ totalCost, storagePercentUsed }) }
})
