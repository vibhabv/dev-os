// Hand-translated from docs/specs/supabase-schema.sql. The live Supabase
// project did not yet have this schema applied when this file was written
// (REST probe against /rest/v1/contracts returned PGRST205 "table not found"),
// and no Supabase CLI was available to generate types from a live connection —
// see the Phase 0 progress report for details. Keep this in sync with
// docs/specs/supabase-schema.sql by hand until `supabase gen types typescript`
// can be run against the applied schema.

export type ContractType = 'nda' | 'msa'
export type DetectedContractType = 'nda' | 'msa' | 'other'
export type ContractStatus = 'uploaded' | 'processing' | 'completed' | 'error'
export type TermSource = 'standard' | 'custom'
export type ChatRole = 'user' | 'assistant'
export type FeedbackRating = 'up' | 'down'
export type AccuracyRating = 'yes' | 'partially' | 'no'
export type UsageOperation = 'extraction' | 'chat'
export type RateLimitAction = 'process' | 'chat' | 'upload' | 'auth'

export interface Database {
  public: {
    Tables: {
      contracts: {
        Row: {
          id: string
          user_id: string
          filename: string
          contract_type: ContractType
          detected_contract_type: DetectedContractType | null
          status: ContractStatus
          error_message: string | null
          contract_text: string
          page_count: number
          token_count: number
          file_size_bytes: number
          file_path: string | null
          storage_upload_failed: boolean
          file_purged_at: string | null
          last_accessed_at: string
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          filename: string
          contract_type: ContractType
          detected_contract_type?: DetectedContractType | null
          status?: ContractStatus
          error_message?: string | null
          contract_text: string
          page_count: number
          token_count: number
          file_size_bytes: number
          file_path?: string | null
          storage_upload_failed?: boolean
          file_purged_at?: string | null
          last_accessed_at?: string
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['contracts']['Insert']>
        Relationships: []
      }
      custom_key_terms: {
        Row: {
          id: string
          contract_id: string
          user_id: string
          term_name: string
          is_manual: boolean
          created_at: string
        }
        Insert: {
          id?: string
          contract_id: string
          user_id: string
          term_name: string
          is_manual?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['custom_key_terms']['Insert']>
        Relationships: []
      }
      key_terms: {
        Row: {
          id: string
          contract_id: string
          user_id: string
          custom_term_id: string | null
          term_source: TermSource
          term_name: string
          value: string
          page_number: number
          confidence_score: number
          source_sentence: string
          is_edited: boolean
          original_ai_value: string | null
          edited_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          contract_id: string
          user_id: string
          custom_term_id?: string | null
          term_source: TermSource
          term_name: string
          value: string
          page_number: number
          confidence_score: number
          source_sentence: string
          is_edited?: boolean
          original_ai_value?: string | null
          edited_at?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['key_terms']['Insert']>
        Relationships: []
      }
      user_settings: {
        Row: {
          user_id: string
          corrections_opt_in: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          corrections_opt_in?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['user_settings']['Insert']>
        Relationships: []
      }
      chat_sessions: {
        Row: {
          id: string
          contract_id: string
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contract_id: string
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['chat_sessions']['Insert']>
        Relationships: []
      }
      chat_messages: {
        Row: {
          id: string
          chat_session_id: string
          user_id: string
          role: ChatRole
          content: string
          page_citation: number | null
          context_source: 'contract' | 'history' | 'both' | null
          created_at: string
        }
        Insert: {
          id?: string
          chat_session_id: string
          user_id: string
          role: ChatRole
          content: string
          page_citation?: number | null
          context_source?: 'contract' | 'history' | 'both' | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['chat_messages']['Insert']>
        Relationships: []
      }
      user_feedback: {
        Row: {
          id: string
          contract_id: string
          user_id: string
          rating: FeedbackRating | null
          accuracy_rating: AccuracyRating | null
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          contract_id: string
          user_id: string
          rating?: FeedbackRating | null
          accuracy_rating?: AccuracyRating | null
          comment?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['user_feedback']['Insert']>
        Relationships: []
      }
      openai_usage_log: {
        Row: {
          id: string
          user_id: string
          contract_id: string | null
          operation: UsageOperation
          prompt_version: string
          input_tokens: number
          output_tokens: number
          cost_usd: number
          duration_ms: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          contract_id?: string | null
          operation: UsageOperation
          prompt_version: string
          input_tokens: number
          output_tokens: number
          cost_usd: number
          duration_ms?: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['openai_usage_log']['Insert']>
        Relationships: []
      }
      rate_limit_events: {
        Row: {
          id: string
          user_id: string
          action: RateLimitAction
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action: RateLimitAction
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['rate_limit_events']['Insert']>
        Relationships: []
      }
      beta_access: {
        Row: {
          user_id: string
          granted_at: string
        }
        Insert: {
          user_id: string
          granted_at?: string
        }
        Update: Partial<Database['public']['Tables']['beta_access']['Insert']>
        Relationships: []
      }
      correction_review_queue: {
        Row: {
          id: string
          key_term_id: string
          contract_id: string
          term_name: string
          original_ai_value: string
          corrected_value: string
          flagged_reason: string
          created_at: string
        }
        Insert: {
          id?: string
          key_term_id: string
          contract_id: string
          term_name: string
          original_ai_value: string
          corrected_value: string
          flagged_reason: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['correction_review_queue']['Insert']>
        Relationships: []
      }
    }
    Views: {
      term_corrections: {
        Row: {
          correction_id: string
          contract_id: string
          term_name: string
          original_ai_value: string | null
          corrected_value: string
          edited_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      grant_beta_access: {
        Args: { p_user_id: string }
        Returns: boolean
      }
    }
  }
}
