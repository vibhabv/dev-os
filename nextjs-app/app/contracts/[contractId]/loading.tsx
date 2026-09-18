export default function ContractResultsLoading() {
  return (
    <div className="flex h-screen flex-col bg-grey-25">
      <div className="h-[65px] border-b border-grey-100 bg-white" />
      <div className="flex flex-1 gap-4 p-4">
        <div className="flex-1 animate-pulse rounded-lg bg-grey-100" />
        <div className="hidden w-[420px] animate-pulse rounded-lg bg-grey-100 lg:block" />
      </div>
    </div>
  )
}
