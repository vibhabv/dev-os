import { schedule } from '@netlify/functions'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { isNotFoundError } from '@/lib/api/isNotFoundError'

export const handler = schedule('@daily', async () => {
  const admin = createSupabaseAdminClient()
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { data: expired, error: selectErr } = await admin
    .from('contracts')
    .select('id, file_path')
    .not('file_path', 'is', null)
    .lt('last_accessed_at', cutoff)

  if (selectErr) {
    console.error('retention-cleanup: failed to query expired contracts', selectErr)
    return { statusCode: 200, body: JSON.stringify({ purged: 0, error: 'select_failed' }) }
  }

  let purged = 0

  for (const contract of expired ?? []) {
    if (!contract.file_path) continue

    const { error: removeErr } = await admin.storage.from('contracts').remove([contract.file_path])
    if (removeErr && !isNotFoundError(removeErr)) {
      console.error(`Failed to purge storage object for contract ${contract.id}`, removeErr)
      continue
    }

    const { error: updateErr } = await admin
      .from('contracts')
      .update({ file_path: null, file_purged_at: new Date().toISOString() })
      .eq('id', contract.id)

    if (updateErr) {
      console.error(`Failed to update file_path/file_purged_at for contract ${contract.id}`, updateErr)
      continue
    }

    purged += 1
  }

  return { statusCode: 200, body: JSON.stringify({ purged }) }
})
