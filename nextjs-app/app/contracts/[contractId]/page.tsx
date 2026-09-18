import { ResultsPage } from '@/components/results/ResultsPage'

export default function ContractResultsPage({ params }: { params: { contractId: string } }) {
  return <ResultsPage contractId={params.contractId} />
}
