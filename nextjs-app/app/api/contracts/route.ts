import { NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/withApiAuth'
import { jsonError } from '@/lib/api/jsonError'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { extractText } from '@/lib/pdf/extractText'
import { countWords, isWithinPageLimit, isLikelyScanned, isWithinTokenLimit } from '@/lib/pdf/validate'
import { countTokens } from '@/lib/utils/countTokens'
import { uploadContractSchema } from '@/lib/validation/uploadContractSchema'
import { validateFileUpload } from '@/lib/security/inputValidator'
import { NDA_STANDARD_TERMS } from '@/lib/openai/prompts/nda'
import { MSA_STANDARD_TERMS } from '@/lib/openai/prompts/msa'

export const POST = withApiAuth(async (req, { userId }) => {
  const supabaseServer = createSupabaseServerClient()

  const form = await req.formData()
  const file = form.get('file') as File | null
  const contractType = form.get('contract_type') as string | null

  const parsed = uploadContractSchema.safeParse({ contractType })
  if (!parsed.success) {
    return jsonError(
      'INVALID_CONTRACT_TYPE',
      'Contract type must be NDA or MSA.',
      400,
      false,
      parsed.error.flatten().fieldErrors as Record<string, string>,
    )
  }

  if (!file) {
    return jsonError('INVALID_FILE_TYPE', 'Please upload a PDF file.', 400, false)
  }
  // Ordered: blocked extension → allowed extension → MIME type → size, per
  // lib/security/inputValidator.ts — extension checks happen before the
  // (client-controlled, spoofable) MIME type is even inspected.
  const uploadError = validateFileUpload(file)
  if (uploadError) {
    const code = uploadError.code === 'FILE_TOO_LARGE' ? 'FILE_TOO_LARGE' : 'INVALID_FILE_TYPE'
    return jsonError(code, uploadError.message, 400, false)
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let extraction: { text: string; pageCount: number }
  try {
    extraction = await extractText(buffer)
  } catch {
    return jsonError('EXTRACTION_FAILED', 'We could not read this PDF. It may be corrupted.', 500, true)
  }

  const wordCount = countWords(extraction.text)
  if (isLikelyScanned(wordCount)) {
    return jsonError(
      'SCANNED_PDF_UNSUPPORTED',
      'Scanned PDFs are not supported yet. Please upload a text-layer PDF.',
      422,
      false,
    )
  }
  if (!isWithinPageLimit(extraction.pageCount)) {
    return jsonError('TOO_MANY_PAGES', 'Maximum 20 pages supported.', 422, false)
  }
  const tokenCount = countTokens(extraction.text)
  if (!isWithinTokenLimit(tokenCount)) {
    return jsonError(
      'CONTRACT_TOO_LONG',
      'This contract is too long for ContractIQ (max ~20 pages). Longer contract support is coming soon.',
      422,
      false,
    )
  }

  const { data: contract, error: insertErr } = await supabaseServer
    .from('contracts')
    .insert({
      user_id: userId,
      filename: file.name,
      contract_type: parsed.data.contractType,
      contract_text: extraction.text,
      page_count: extraction.pageCount,
      token_count: tokenCount,
      file_size_bytes: file.size,
      status: 'uploaded',
    })
    .select()
    .single()

  if (insertErr || !contract) {
    return jsonError('EXTRACTION_FAILED', 'Something went wrong saving your contract. Please try again.', 500, true)
  }

  const path = `${userId}/${contract.id}/${file.name}`
  const { error: storageErr } = await supabaseServer.storage.from('contracts').upload(path, buffer, {
    contentType: 'application/pdf',
  })

  const { error: statusUpdateErr } = await supabaseServer
    .from('contracts')
    .update(storageErr ? { storage_upload_failed: true, file_path: null } : { file_path: path })
    .eq('id', contract.id)

  if (statusUpdateErr) {
    console.error(`Failed to record Storage status for contract ${contract.id}`, statusUpdateErr)
  }

  return NextResponse.json(
    {
      contract_id: contract.id,
      filename: contract.filename,
      contract_type: contract.contract_type,
      page_count: contract.page_count,
      status: contract.status,
      standard_terms_preview: parsed.data.contractType === 'nda' ? NDA_STANDARD_TERMS : MSA_STANDARD_TERMS,
    },
    { status: 201 },
  )
}, { rateLimitAction: 'upload' })
