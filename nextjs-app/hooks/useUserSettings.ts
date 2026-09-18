'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export function useUserSettings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', user!.id).maybeSingle()
      if (error) throw error
      return data ?? { corrections_opt_in: false }
    },
    enabled: !!user,
  })

  const mutation = useMutation({
    mutationFn: async (optIn: boolean) => {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: user!.id, corrections_opt_in: optIn }, { onConflict: 'user_id' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings', user?.id] })
    },
  })

  return {
    settings: query.data,
    setCorrectionsOptIn: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.isError,
  }
}
