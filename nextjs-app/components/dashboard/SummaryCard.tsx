interface SummaryCardProps {
  totalCount: number
  ndaCount: number
  msaCount: number
}

export function SummaryCard({ totalCount, ndaCount, msaCount }: SummaryCardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="flex flex-col gap-2 rounded-lg border border-grey-100 bg-white p-6">
        <span className="text-body-sm text-grey-500">Total contracts</span>
        <span className="text-h3 text-grey-900">{totalCount}</span>
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-grey-100 bg-white p-6">
        <span className="text-body-sm text-grey-500">NDAs</span>
        <span className="text-h3 text-grey-900">{ndaCount}</span>
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-grey-100 bg-white p-6">
        <span className="text-body-sm text-grey-500">MSAs</span>
        <span className="text-h3 text-grey-900">{msaCount}</span>
      </div>
    </div>
  )
}
