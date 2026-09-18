import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

interface TermCorrectionSample {
  correction_id: string
  contract_id: string
  term_name: string
  original_ai_value: string | null
  corrected_value: string
  edited_at: string | null
}

// APPROVED DEFAULT (see the orchestrating agent's Phase 1 step 15 plan): the weekly
// drift-review sample is written to a new `correction_review_queue` table (added via
// docs/specs/supabase-schema-additions.sql — the original supabase-schema.sql is left
// untouched) rather than an external sheet, since no such external tool exists yet.
export async function writeToReviewQueue(admin: SupabaseClient<Database>, sample: TermCorrectionSample[]): Promise<void> {
  if (sample.length === 0) return

  const rows = sample
    .filter((s) => s.original_ai_value !== null)
    .map((s) => ({
      key_term_id: s.correction_id,
      contract_id: s.contract_id,
      term_name: s.term_name,
      original_ai_value: s.original_ai_value as string,
      corrected_value: s.corrected_value,
      flagged_reason: 'weekly_drift_sample',
    }))

  if (rows.length === 0) return

  const { error } = await admin.from('correction_review_queue').insert(rows)
  if (error) {
    console.error('Failed to write to correction_review_queue', error)
  }
}
