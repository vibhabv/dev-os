import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ContractRecord } from '@/types/domain'

export async function loadContractOwnedBy(contractId: string, userId: string): Promise<ContractRecord | null> {
  const supabaseServer = createSupabaseServerClient()
  const { data: contract } = await supabaseServer.from('contracts').select('*').eq('id', contractId).maybeSingle()
  if (!contract || contract.user_id !== userId) return null
  return contract as ContractRecord
}
