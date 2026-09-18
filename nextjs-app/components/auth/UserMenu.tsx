'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { LogOut, Settings, ChevronDown } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { useAuth } from '@/hooks/useAuth'

export function UserMenu() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  if (!user) return null

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    router.push('/')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-body-sm text-grey-700 hover:bg-grey-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-body-sm font-medium text-blue-700">
            {user.email?.[0]?.toUpperCase() ?? '?'}
          </span>
          <span className="max-w-[160px] truncate text-body-lg text-grey-900">{user.email}</span>
          <ChevronDown className="h-4 w-4 text-grey-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <Link
          href="/account"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-body-lg text-grey-900 hover:bg-grey-50"
        >
          <Settings className="h-4 w-4" />
          Account settings
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-body-lg text-grey-900 hover:bg-grey-50"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </PopoverContent>
    </Popover>
  )
}
