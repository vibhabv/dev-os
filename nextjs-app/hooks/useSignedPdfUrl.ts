'use client'

import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function useSignedPdfUrl(filePath: string | null) {
  return useQuery({
    queryKey: ['signed-pdf-url', filePath],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase.storage.from('contracts').createSignedUrl(filePath!, 3600)
      if (error) throw error
      return data.signedUrl
    },
    enabled: !!filePath,
    staleTime: 55 * 60 * 1000,
    retry: 1,
  })
}
