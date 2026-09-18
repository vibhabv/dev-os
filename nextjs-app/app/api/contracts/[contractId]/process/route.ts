import { NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/withApiAuth'
import { jsonError } from '@/lib/api/jsonError'
import { loadContractOwnedBy } from '@/lib/api/loadContractOwnedBy'
import { loadCustomTerms } from '@/lib/api/loadCustomTerms'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { runExtraction } from '@/lib/openai/extraction'
import { InvalidModelOutputError } from '@/lib/openai/errors'
import { TimeoutError } from '@/lib/openai/withTimeout'

export const POST = withApiAuth(
  async (_req, { userId, params }) => {
    const supabaseServer = createSupabaseServerClient()

    const contract = await loadContractOwnedBy(params.contractId, userId)
    if (!contract) return jsonError('CONTRACT_NOT_FOUND', 'Contract not found.', 404, false)
    if (!['uploaded', 'error'].includes(contract.status)) {
      return jsonError('ALREADY_PROCESSED', 'This contract has already been processed.', 400, false)
    }

    const { error: processingUpdateErr } = await supabaseServer
      .from('contracts')
      .update({ status: 'processing' })
      .eq('id', contract.id)
    if (processingUpdateErr) {
      return jsonError('INTERNAL_ERROR', 'Something went wrong starting the analysis. Please try again.', 500, true)
    }

    const customTerms = await loadCustomTerms(contract.id)

    try {
      const result = await runExtraction(contract, customTerms)

      const rows = result.terms.map((t) => ({
        contract_id: contract.id,
        user_id: userId,
        custom_term_id:
          t.term_source === 'custom' ? (customTerms.find((c) => c.term_name === t.term_name)?.id ?? null) : null,
        term_source: t.term_source,
        term_name: t.term_name,
        value: t.value,
        page_number: t.page_number,
        confidence_score: t.source_sentence ? t.confidence_score * 100 : 0,
        source_sentence: t.source_sentence ?? '',
      }))

      const { data: insertedTerms, error: insertErr } = await supabaseServer.from('key_terms').insert(rows).select()

      if (insertErr || !insertedTerms) {
        await supabaseServer
          .from('contracts')
          .update({
            status: 'error',
            error_message: 'Something went wrong saving the extracted terms. Please try again.',
          })
          .eq('id', contract.id)
        return jsonError(
          'EXTRACTION_FAILED',
          'Something went wrong saving the extracted terms. Please try again.',
          500,
          true,
        )
      }

      const { error: completedUpdateErr } = await supabaseServer
        .from('contracts')
        .update({ status: 'completed', detected_contract_type: result.detected_contract_type })
        .eq('id', contract.id)

      if (completedUpdateErr) {
        return jsonError(
          'INTERNAL_ERROR',
          'Your results were saved, but we could not finish updating this contract. Please refresh in a moment.',
          500,
          true,
        )
      }

      return NextResponse.json({
        contract_id: contract.id,
        status: 'completed',
        detected_contract_type: result.detected_contract_type,
        key_terms: insertedTerms,
      })
    } catch (err) {
      const message =
        err instanceof InvalidModelOutputError
          ? 'We could not process this contract correctly. Please try again.'
          : 'OpenAI is temporarily unavailable — try again in a few minutes.'

      await supabaseServer.from('contracts').update({ status: 'error', error_message: message }).eq('id', contract.id)

      if (err instanceof InvalidModelOutputError) return jsonError('INVALID_MODEL_OUTPUT', message, 422, false)
      if (err instanceof TimeoutError) return jsonError('TIMEOUT', message, 504, true)
      return jsonError('OPENAI_ERROR', message, 502, true)
    }
  },
  { rateLimitAction: 'process' },
)
