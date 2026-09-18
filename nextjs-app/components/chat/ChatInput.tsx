'use client'

import { useState, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface ChatInputProps {
  disabled?: boolean
  onSend: (text: string) => void
}

export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 border-t border-grey-100 p-4">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask a question about this contract…"
        disabled={disabled}
        maxLength={2000}
        aria-label="Chat message"
      />
      <Button type="submit" size="icon" disabled={disabled || !value.trim()} aria-label="Send message">
        <Send className="h-4 w-4" />
      </Button>
    </form>
  )
}
