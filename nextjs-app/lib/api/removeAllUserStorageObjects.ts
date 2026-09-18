import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Storage `list()` is shallow (one level per call), so this recurses into
// every per-contract subfolder under `{userId}/` and removes every object
// found. Best-effort: a missing object (already retention-purged) is not
// treated as a failure — only propagates a genuine Storage API error.
export async function removeAllUserStorageObjects(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<{ error: Error | null }> {
  const { data: contractFolders, error: listErr } = await admin.storage.from('contracts').list(userId)
  if (listErr) return { error: null }
  if (!contractFolders || contractFolders.length === 0) return { error: null }

  const allPaths: string[] = []

  for (const folder of contractFolders) {
    const subPath = `${userId}/${folder.name}`
    const { data: files } = await admin.storage.from('contracts').list(subPath)
    if (files && files.length > 0) {
      for (const file of files) {
        allPaths.push(`${subPath}/${file.name}`)
      }
    } else if (folder.name.includes('.')) {
      // A leaf object (no further nesting) rather than a folder.
      allPaths.push(subPath)
    }
  }

  if (allPaths.length === 0) return { error: null }

  const { error: removeErr } = await admin.storage.from('contracts').remove(allPaths)
  return { error: removeErr ? new Error(removeErr.message) : null }
}
