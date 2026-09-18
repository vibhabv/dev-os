export { chatMessageSchema } from '@/lib/validation/chatMessageSchema'
export { uploadContractSchema } from '@/lib/validation/uploadContractSchema'
export { extractionResultSchema } from '@/lib/validation/extractionResultSchema'

const BLOCKED_EXTENSIONS = ['.exe', '.js', '.mjs', '.cjs', '.php', '.zip', '.sh', '.bat', '.cmd', '.py', '.rb', '.ps1']
// skills/security-foundation/SKILL.md's generic guidance allows .pdf and
// .docx, but lib/pdf/extractText.ts only implements PDF parsing (pdf-parse)
// — docs/specs/03-pdf-upload-and-extraction.md is PDF-only end to end.
// Allowing .docx here would accept files the rest of the pipeline can't
// process, producing a confusing EXTRACTION_FAILED instead of a clear
// rejection. Scoped to this app's actual capability, not the skill's
// template list.
const ALLOWED_EXTENSIONS = ['.pdf']
const ALLOWED_MIME_TYPES = ['application/pdf']
const MAX_FILE_SIZE_BYTES = 10_485_760 // 10 MB — matches the Supabase Storage bucket limit

export type FileUploadValidationError =
  | { code: 'BLOCKED_EXTENSION'; message: string }
  | { code: 'INVALID_FILE_TYPE'; message: string }
  | { code: 'INVALID_MIME_TYPE'; message: string }
  | { code: 'FILE_TOO_LARGE'; message: string }

// Order matters: an explicitly blocked extension is rejected before an
// unrecognized one gets the generic "invalid type" message, and both
// extension checks happen before the (spoofable) MIME type is even looked
// at — a renamed .exe with a forged `Content-Type: application/pdf` header
// is still caught by the extension check first.
export function validateFileUpload(file: { name: string; type: string; size: number }): FileUploadValidationError | null {
  const lowerName = file.name.toLowerCase()
  const extension = lowerName.includes('.') ? lowerName.slice(lowerName.lastIndexOf('.')) : ''

  if (BLOCKED_EXTENSIONS.includes(extension)) {
    return { code: 'BLOCKED_EXTENSION', message: 'This file type is not allowed.' }
  }
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return { code: 'INVALID_FILE_TYPE', message: 'Please upload a PDF file.' }
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { code: 'INVALID_MIME_TYPE', message: 'Please upload a PDF file.' }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { code: 'FILE_TOO_LARGE', message: 'File is too large. Maximum size is 10 MB.' }
  }
  return null
}
