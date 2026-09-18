import { schedule } from '@netlify/functions'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { postSlackAlert } from '@/lib/monitoring/postSlackAlert'
import { writeToReviewQueue } from '@/lib/monitoring/writeToReviewQueue'

interface RecentTermRow {
  is_edited: boolean
  contract_id: string
  contracts: { contract_type: 'nda' | 'msa' } | { contract_type: 'nda' | 'msa' }[] | null
}

function resolveContractType(row: RecentTermRow): 'nda' | 'msa' | null {
  const contracts = row.contracts
  if (!contracts) return null
  return Array.isArray(contracts) ? (contracts[0]?.contract_type ?? null) : contracts.contract_type
}

function groupCorrectionRateByContractType(rows: RecentTermRow[]): { nda: number; msa: number } {
  const counts = { nda: { total: 0, edited: 0 }, msa: { total: 0, edited: 0 } }

  for (const row of rows) {
    const type = resolveContractType(row)
    if (!type) continue
    counts[type].total += 1
    if (row.is_edited) counts[type].edited += 1
  }

  return {
    nda: counts.nda.total > 0 ? (counts.nda.edited / counts.nda.total) * 100 : 0,
    msa: counts.msa.total > 0 ? (counts.msa.edited / counts.msa.total) * 100 : 0,
  }
}

export const handler = schedule('@weekly', async () => {
  const admin = createSupabaseAdminClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: recentTerms } = await admin
    .from('key_terms')
    .select('is_edited, contract_id, contracts(contract_type)')
    .gte('created_at', sevenDaysAgo)

  const rows = (recentTerms ?? []) as unknown as RecentTermRow[]
  const total = rows.length
  const edited = rows.filter((t) => t.is_edited).length
  const rate = total > 0 ? (edited / total) * 100 : 0

  if (rate > 12) {
    await postSlackAlert(
      process.env.SLACK_QUALITY_ALERT_WEBHOOK_URL,
      `Correction rate over the last 7 days: ${rate.toFixed(1)}% (threshold: 12%). Triggering prompt review.`,
    )
  }

  const byType = groupCorrectionRateByContractType(rows)
  if (Math.abs(byType.nda - byType.msa) > 10) {
    await postSlackAlert(
      process.env.SLACK_QUALITY_ALERT_WEBHOOK_URL,
      `Correction rate disparity: NDA ${byType.nda.toFixed(1)}% vs MSA ${byType.msa.toFixed(1)}%.`,
    )
  }

  const { data: sample } = await admin
    .from('term_corrections')
    .select('*')
    .order('edited_at', { ascending: false })
    .limit(10)

  await writeToReviewQueue(admin, sample ?? [])

  return { statusCode: 200, body: JSON.stringify({ total, edited, rate, byType }) }
})
