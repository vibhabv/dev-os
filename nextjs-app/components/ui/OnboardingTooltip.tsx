'use client'

import type { ReactNode } from 'react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { useOnboarding } from '@/hooks/useOnboarding'

interface OnboardingTooltipProps {
  id: string
  content: string
  children: ReactNode
}

export function OnboardingTooltip({ id, content, children }: OnboardingTooltipProps) {
  const { seen, dismiss } = useOnboarding()

  if (seen) return <>{children}</>

  return (
    <Popover open onOpenChange={(open) => !open && dismiss()}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent id={id} className="flex flex-col gap-3">
        <p className="text-body-lg text-grey-900">{content}</p>
        <Button size="sm" onClick={dismiss} className="self-start">
          Got it
        </Button>
      </PopoverContent>
    </Popover>
  )
}
