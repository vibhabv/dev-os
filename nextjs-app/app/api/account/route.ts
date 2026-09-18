import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/withApiAuth'
import { jsonError } from '@/lib/api/jsonError'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { removeAllUserStorageObjects } from '@/lib/api/removeAllUserStorageObjects'

export const DELETE = withApiAuth(async (req: NextRequest, { userId }) => {
  const body = await req.json().catch(() => null)
  if (body?.confirm !== true) {
    return jsonError('CONFIRMATION_REQUIRED', 'Confirmation is required to delete your account.', 400, false)
  }

  const admin = createSupabaseAdminClient()
  await removeAllUserStorageObjects(admin, userId)

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    return jsonError('ACCOUNT_DELETION_FAILED', 'Something went wrong deleting your account. Please try again.', 500, true)
  }

  return NextResponse.json({ deleted: true })
})
