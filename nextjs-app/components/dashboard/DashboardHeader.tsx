import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { UserMenu } from '@/components/auth/UserMenu'
import { OnboardingTooltip } from '@/components/ui/OnboardingTooltip'

export function DashboardHeader() {
  return (
    <header className="flex items-center justify-between border-b border-grey-100 px-6 py-4 md:px-28">
      <Link href="/dashboard" className="text-h5 text-grey-900">
        ContractIQ
      </Link>
      <div className="flex items-center gap-4">
        <OnboardingTooltip
          id="onboarding-review-contract"
          content="Start here — upload your first NDA or MSA to get an instant breakdown."
        >
          <Button asChild>
            <Link href="/contracts/new">Review a Contract</Link>
          </Button>
        </OnboardingTooltip>
        <UserMenu />
      </div>
    </header>
  )
}
