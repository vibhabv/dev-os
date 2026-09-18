'use client'

import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { ContractRecord } from '@/types/domain'

export function useContract(contractId: string) {
  return useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase.from('contracts').select('*').eq('id', contractId).single()
      if (error) throw error
      return data as ContractRecord
    },
  })
}
