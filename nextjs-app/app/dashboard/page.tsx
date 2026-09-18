import Link from 'next/link'
import { format } from 'date-fns'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { SummaryCard } from '@/components/dashboard/SummaryCard'
import { StatusChip } from '@/components/dashboard/StatusChip'
import { ContractTable } from '@/components/dashboard/ContractTable'
import { Button } from '@/components/ui/button'
import type { Contract } from '@/types/domain'

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()

  const [{ count: totalCount }, { count: ndaCount }, { count: msaCount }, { data: recent }] = await Promise.all([
    supabase.from('contracts').select('*', { count: 'exact', head: true }),
    supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('contract_type', 'nda'),
    supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('contract_type', 'msa'),
    supabase.from('contracts').select('*').order('created_at', { ascending: false }).limit(5),
  ])

  const recentContracts = (recent ?? []) as Contract[]
  const hasContracts = (totalCount ?? 0) > 0

  return (
    <div className="flex min-h-screen flex-col bg-grey-25">
      <DashboardHeader />
      <main className="flex flex-1 flex-col gap-10 px-6 py-10 md:px-28 md:py-16">
        {!hasContracts ? (
          <section className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-grey-200 bg-white py-24 text-center">
            <h2 className="text-h4 text-grey-900">No contracts reviewed yet</h2>
            <p className="max-w-sm text-body-lg text-grey-500">
              Upload your first contract to begin — we&apos;ll extract every key term with page citations and
              confidence scores in under a minute.
            </p>
            <Button asChild size="lg">
              <Link href="/contracts/new">Review a Contract</Link>
            </Button>
          </section>
        ) : (
          <>
            <SummaryCard totalCount={totalCount ?? 0} ndaCount={ndaCount ?? 0} msaCount={msaCount ?? 0} />

            <section className="flex flex-col gap-4">
              <h2 className="text-h5 text-grey-900">Recent contracts</h2>
              <div className="overflow-hidden rounded-lg border border-grey-100 bg-white">
                <ul>
                  {recentContracts.map((contract) => (
                    <li key={contract.id} className="border-b border-grey-50 last:border-0">
                      <Link
                        href={`/contracts/${contract.id}`}
                        className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-grey-25"
                      >
                        <span className="truncate text-body-lg text-grey-900">{contract.filename}</span>
                        <span className="flex items-center gap-4 shrink-0">
                          <span className="text-body-sm uppercase text-grey-500">{contract.contract_type}</span>
                          <StatusChip status={contract.status} />
                          <span className="text-body-sm text-grey-500">
                            {format(new Date(contract.created_at), 'MMM d, yyyy')}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <ContractTable />
          </>
        )}
      </main>
    </div>
  )
}
