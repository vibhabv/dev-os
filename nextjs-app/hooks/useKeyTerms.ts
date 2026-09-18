'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { KeyTerm } from '@/types/domain'

export function useKeyTerms(contractId: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['key-terms', contractId],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('key_terms')
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as KeyTerm[]
    },
  })

  async function updateTermValue(termId: string, newValue: string) {
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.from('key_terms').update({ value: newValue }).eq('id', termId)
    if (!error) queryClient.invalidateQueries({ queryKey: ['key-terms', contractId] })
    return { error }
  }

  return { terms: query.data ?? [], isLoading: query.isLoading, isError: query.isError, updateTermValue }
}
