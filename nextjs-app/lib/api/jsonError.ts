import { NextResponse } from 'next/server'
import type { ApiErrorCode } from '@/types/domain'

export function jsonError(
  code: ApiErrorCode,
  message: string,
  httpStatus: number,
  retryable: boolean,
  fields?: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, retryable, ...(fields ? { fields } : {}) } },
    { status: httpStatus },
  )
}
