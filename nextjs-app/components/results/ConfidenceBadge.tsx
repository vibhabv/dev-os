import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

interface ConfidenceBadgeProps {
  score: number
}

function getTier(score: number): 'high' | 'medium' | 'low' {
  if (score >= 80) return 'high'
  if (score >= 50) return 'medium'
  return 'low'
}

const TIER_CLASSES: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-green-50 text-green-700 border-green-200',
  medium: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  low: 'bg-red-50 text-red-700 border-red-200',
}

export function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  const tier = getTier(score)
  const rounded = Math.round(score)

  const badge = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-body-sm font-medium',
        TIER_CLASSES[tier],
      )}
    >
      {tier === 'low' && <AlertTriangle className="h-3 w-3" aria-label="Low confidence" />}
      {rounded}%
    </span>
  )

  if (tier !== 'low') return badge

  // "Non-dismissible" means no close (×) affordance — Radix's hover/focus-triggered
  // tooltip already satisfies that; forcing it permanently open would fight the
  // always-visible inline text rendered below for mobile instead of complementing it.
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>Low confidence — we recommend verifying this in the document directly.</TooltipContent>
      </Tooltip>
      <p className="mt-1 text-body-sm text-red-700 sm:hidden">
        Low confidence — we recommend verifying this in the document directly.
      </p>
    </>
  )
}
