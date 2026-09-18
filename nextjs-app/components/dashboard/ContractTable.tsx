'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { StatusChip } from '@/components/dashboard/StatusChip'
import { DeleteContractButton } from '@/components/dashboard/DeleteContractButton'
import { cn } from '@/lib/utils'
import type { Contract } from '@/types/domain'

type SortColumn = 'created_at' | 'filename' | 'contract_type'
type SortDirection = 'asc' | 'desc'

const COLUMNS: { key: SortColumn; label: string; defaultDirection: SortDirection }[] = [
  { key: 'filename', label: 'Name', defaultDirection: 'asc' },
  { key: 'contract_type', label: 'Type', defaultDirection: 'asc' },
  { key: 'created_at', label: 'Date', defaultDirection: 'desc' },
]

export function ContractTable() {
  const router = useRouter()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    supabase
      .from('contracts')
      .select('*')
      .order(sortColumn, { ascending: sortDirection === 'asc' })
      .then(({ data }) => {
        if (!cancelled) {
          setContracts((data ?? []) as Contract[])
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [sortColumn, sortDirection])

  function handleSort(column: SortColumn, defaultDirection: SortDirection) {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection(defaultDirection)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-h5 text-grey-900">All contracts</h2>
      <div className="overflow-x-auto rounded-lg border border-grey-100 bg-white">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-grey-100">
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-6 py-3 text-body-sm font-medium text-grey-500">
                  <button
                    type="button"
                    onClick={() => handleSort(col.key, col.defaultDirection)}
                    className="flex items-center gap-1 hover:text-grey-900"
                  >
                    {col.label}
                    {sortColumn === col.key &&
                      (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </button>
                </th>
              ))}
              <th className="px-6 py-3 text-body-sm font-medium text-grey-500">Status</th>
              <th className="px-6 py-3 text-body-sm font-medium text-grey-500" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-body-sm text-grey-400">
                  Loading…
                </td>
              </tr>
            ) : contracts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-body-sm text-grey-400">
                  No contracts yet.
                </td>
              </tr>
            ) : (
              contracts.map((contract) => (
                <tr
                  key={contract.id}
                  onClick={() => router.push(`/contracts/${contract.id}`)}
                  className={cn('cursor-pointer border-b border-grey-50 last:border-0 hover:bg-grey-25')}
                >
                  <td className="px-6 py-4 text-body-lg text-grey-900 truncate max-w-xs">{contract.filename}</td>
                  <td className="px-6 py-4 text-body-sm uppercase text-grey-500">{contract.contract_type}</td>
                  <td className="px-6 py-4 text-body-sm text-grey-500">
                    {format(new Date(contract.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4">
                    <StatusChip status={contract.status} />
                  </td>
                  <td className="px-6 py-4">
                    <DeleteContractButton
                      contractId={contract.id}
                      iconOnly
                      onDeleted={() => setContracts((prev) => prev.filter((c) => c.id !== contract.id))}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
