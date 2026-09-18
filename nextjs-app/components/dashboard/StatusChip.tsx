import { Badge } from '@/components/ui/badge'
import type { Contract } from '@/types/domain'

const VARIANT_BY_STATUS: Record<Contract['status'], 'secondary' | 'default' | 'success' | 'destructive'> = {
  uploaded: 'secondary',
  processing: 'default',
  completed: 'success',
  error: 'destructive',
}

const LABEL_BY_STATUS: Record<Contract['status'], string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  completed: 'Completed',
  error: 'Error',
}

export function StatusChip({ status }: { status: Contract['status'] }) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{LABEL_BY_STATUS[status]}</Badge>
}
