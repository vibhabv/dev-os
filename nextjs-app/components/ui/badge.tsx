import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-sm border px-2 py-0.5 text-body-sm font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-blue-200 bg-blue-50 text-blue-700',
        secondary: 'border-grey-100 bg-grey-50 text-grey-700',
        success: 'border-green-200 bg-green-50 text-green-700',
        warning: 'border-yellow-200 bg-yellow-50 text-yellow-800',
        destructive: 'border-red-200 bg-red-50 text-red-700',
        outline: 'border-grey-200 text-grey-900',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
