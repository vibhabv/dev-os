import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { CustomKeyTerm } from '@/types/domain'

export async function loadCustomTerms(contractId: string): Promise<CustomKeyTerm[]> {
  const supabaseServer = createSupabaseServerClient()
  const { data } = await supabaseServer.from('custom_key_terms').select('*').eq('contract_id', contractId)
  return (data ?? []) as CustomKeyTerm[]
}
