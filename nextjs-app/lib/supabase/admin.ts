import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Service-role client — bypasses RLS entirely. Server-only: never import this
// module from a Client Component or anything bundled to the browser. Used
// exclusively by app/auth/callback/route.ts (beta grant RPC), account
// deletion, and netlify/functions/*.ts scheduled jobs, per docs/specs/00.
export function createSupabaseAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
