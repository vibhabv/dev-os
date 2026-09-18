'use client'

import { useCallback, useRef, useState, type DragEvent } from 'react'
import { UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileDropzoneProps {
  disabled?: boolean
  uploading?: boolean
  onFileSelected: (file: File) => void
  error?: string | null
}

function validateFile(file: File): string | null {
  const looksLikePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!looksLikePdf) return 'Please upload a PDF file.'
  if (file.size > 10_485_760) return 'File is too large. Maximum size is 10 MB.'
  return null
}

export function FileDropzone({ disabled, uploading, onFileSelected, error }: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        setLocalError(validationError)
        return
      }
      setLocalError(null)
      onFileSelected(file)
    },
    [onFileSelected],
  )

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const displayError = error ?? localError

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click()
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-16 text-center transition-colors duration-micro',
          disabled ? 'cursor-not-allowed border-grey-100 bg-grey-25 opacity-60' : 'cursor-pointer border-grey-200 bg-white hover:bg-grey-25',
          dragging && 'border-blue-500 bg-blue-50',
        )}
      >
        <UploadCloud className="h-8 w-8 text-grey-400" aria-hidden="true" />
        {uploading ? (
          <p className="text-body-lg text-grey-700">Uploading and extracting text…</p>
        ) : (
          <>
            <p className="text-body-lg text-grey-900">Drag and drop your PDF here, or click to browse</p>
            <p className="text-body-sm text-grey-500">PDF only, up to 10 MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
      </div>
      {displayError && (
        <p role="alert" className="text-body-sm text-red-700">
          {displayError}
        </p>
      )}
    </div>
  )
}
