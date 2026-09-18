import { NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/withApiAuth'
import { jsonError } from '@/lib/api/jsonError'
import { loadContractOwnedBy } from '@/lib/api/loadContractOwnedBy'
import { isNotFoundError } from '@/lib/api/isNotFoundError'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const DELETE = withApiAuth(async (_req, { userId, params }) => {
  const supabaseServer = createSupabaseServerClient()

  const contract = await loadContractOwnedBy(params.contractId, userId)
  if (!contract) return jsonError('CONTRACT_NOT_FOUND', 'Contract not found.', 404, false)

  if (contract.file_path) {
    const { error } = await supabaseServer.storage.from('contracts').remove([contract.file_path])
    if (error && !isNotFoundError(error)) {
      return jsonError('DELETE_FAILED', 'Could not delete this contract. Please try again.', 500, true)
    }
  }

  const { error: deleteErr } = await supabaseServer.from('contracts').delete().eq('id', contract.id)
  if (deleteErr) return jsonError('DELETE_FAILED', 'Could not delete this contract. Please try again.', 500, true)

  return NextResponse.json({ deleted: true, contract_id: contract.id })
})
