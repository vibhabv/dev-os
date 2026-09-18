export type ApiErrorCode =
  | 'INVALID_FILE_TYPE' | 'FILE_TOO_LARGE' | 'INVALID_CONTRACT_TYPE'
  | 'SCANNED_PDF_UNSUPPORTED' | 'TOO_MANY_PAGES' | 'CONTRACT_TOO_LONG'
  | 'EXTRACTION_FAILED' | 'ALREADY_PROCESSED' | 'INVALID_MODEL_OUTPUT'
  | 'INVALID_MESSAGE' | 'CONTRACT_NOT_PROCESSED' | 'CHAT_HISTORY_LIMIT_REACHED'
  | 'EXPORT_GENERATION_FAILED' | 'DELETE_FAILED' | 'CONFIRMATION_REQUIRED'
  | 'ACCOUNT_DELETION_FAILED' | 'UNAUTHORIZED' | 'CONTRACT_NOT_FOUND'
  | 'RATE_LIMITED' | 'OPENAI_ERROR' | 'TIMEOUT' | 'INTERNAL_ERROR'
  | 'PROMPT_INJECTION_DETECTED' | 'MESSAGE_TOO_LONG' | 'LOGIN_FAILED' | 'VALIDATION_ERROR'

export interface ApiError {
  error: {
    code: ApiErrorCode
    message: string
    retryable: boolean
    fields?: Record<string, string>
  }
}

export interface KeyTerm {
  id: string
  contract_id: string
  custom_term_id: string | null
  term_source: 'standard' | 'custom'
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

export interface Contract {
  id: string
  user_id: string
  filename: string
  contract_type: 'nda' | 'msa'
  detected_contract_type: 'nda' | 'msa' | 'other' | null
  status: 'uploaded' | 'processing' | 'completed' | 'error'
  error_message: string | null
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

// Server-only — includes the full extracted contract_text, which is
// deliberately left off the base Contract type shared with the client
// (per docs/specs/00-overview-and-conventions.md's glossary) since most
// client-facing reads never need the full document body. Route Handlers
// that load a contract to pass to OpenAI (extraction, chat) or need to
// echo pipeline results use this instead.
export interface ContractRecord extends Contract {
  contract_text: string
}

export interface ChatMessage {
  id: string
  chat_session_id: string
  role: 'user' | 'assistant'
  content: string
  page_citation: number | null
  // Which QueryClassification (lib/openai/prompts/chatSystemPrompt.ts) produced
  // this reply — null for user-authored rows and for any row written before
  // this column existed.
  context_source: 'contract' | 'history' | 'both' | null
  created_at: string
}

export interface CustomKeyTerm {
  id: string
  contract_id: string
  user_id: string
  term_name: string
  is_manual: boolean
  created_at: string
}

export interface UserFeedback {
  id: string
  contract_id: string
  user_id: string
  rating: 'up' | 'down' | null
  accuracy_rating: 'yes' | 'partially' | 'no' | null
  comment: string | null
  created_at: string
}

export interface UserSettings {
  user_id: string
  corrections_opt_in: boolean
  created_at: string
  updated_at: string
}

export const HTTP_STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  INVALID_FILE_TYPE: 400,
  FILE_TOO_LARGE: 400,
  INVALID_CONTRACT_TYPE: 400,
  INVALID_MESSAGE: 400,
  ALREADY_PROCESSED: 400,
  CONFIRMATION_REQUIRED: 400,
  UNAUTHORIZED: 401,
  CONTRACT_NOT_FOUND: 404,
  CONTRACT_NOT_PROCESSED: 409,
  SCANNED_PDF_UNSUPPORTED: 422,
  TOO_MANY_PAGES: 422,
  CONTRACT_TOO_LONG: 422,
  INVALID_MODEL_OUTPUT: 422,
  CHAT_HISTORY_LIMIT_REACHED: 422,
  MESSAGE_TOO_LONG: 400,
  PROMPT_INJECTION_DETECTED: 400,
  VALIDATION_ERROR: 422,
  LOGIN_FAILED: 401,
  RATE_LIMITED: 429,
  EXTRACTION_FAILED: 500,
  DELETE_FAILED: 500,
  ACCOUNT_DELETION_FAILED: 500,
  EXPORT_GENERATION_FAILED: 500,
  OPENAI_ERROR: 502,
  TIMEOUT: 504,
  INTERNAL_ERROR: 500,
}
