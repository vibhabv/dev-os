import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// APPROVED DEFAULT (see the orchestrating agent's Phase 1 step 15 plan): there is no
// Supabase Management API token available to this project, so plan-quota usage is
// approximated by aggregating storage.objects row sizes directly via the service-role
// client, rather than calling the Management API's billing/usage endpoint.
const DEFAULT_QUOTA_BYTES = 107_374_182_400 // 100 GB — Supabase Pro plan default storage quota

export async function getStorageUsagePercent(admin: SupabaseClient<Database>): Promise<number> {
  const quotaBytes = Number(process.env.SUPABASE_STORAGE_QUOTA_BYTES ?? DEFAULT_QUOTA_BYTES)

  let totalBytes = 0
  let page = 0
  const pageSize = 1000

  // storage.objects is not part of the `public` schema exposed by the default client —
  // .schema('storage') targets it explicitly via the service-role connection.
  const storageSchemaClient = admin.schema('storage' as never) as unknown as SupabaseClient<Database>

  for (;;) {
    const { data, error } = await storageSchemaClient
      .from('objects' as never)
      .select('metadata')
      .range(page * pageSize, page * pageSize + pageSize - 1)

    if (error || !data || data.length === 0) break

    for (const row of data as unknown as { metadata: { size?: number } | null }[]) {
      totalBytes += row.metadata?.size ?? 0
    }

    if (data.length < pageSize) break
    page += 1
  }

  return Math.round((totalBytes / quotaBytes) * 100)
}
