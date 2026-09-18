import { Badge } from '@/components/ui/badge'
import type { CustomKeyTerm } from '@/types/domain'

interface KeyTermPreviewListProps {
  standardTerms: readonly string[]
  customTerms: CustomKeyTerm[]
}

export function KeyTermPreviewList({ standardTerms, customTerms }: KeyTermPreviewListProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-body-lg font-medium text-grey-900">We&apos;ll extract these key terms</h3>
      <ul className="flex flex-wrap gap-2">
        {standardTerms.map((term) => (
          <li key={term} className="rounded-sm border border-grey-200 bg-white px-2 py-1 text-body-sm text-grey-700">
            {term}
          </li>
        ))}
        {customTerms.map((term) => (
          <li
            key={term.id}
            className="flex items-center gap-1.5 rounded-sm border border-blue-200 bg-blue-50 px-2 py-1 text-body-sm text-blue-700"
          >
            {term.term_name}
            <Badge variant="default" className="px-1 py-0 text-[10px]">
              Custom
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  )
}
