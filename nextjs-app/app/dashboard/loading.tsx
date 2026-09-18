export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-grey-25">
      <div className="h-[73px] border-b border-grey-100 bg-white" />
      <main className="flex flex-1 flex-col gap-10 px-6 py-10 md:px-28 md:py-16">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-grey-100" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <div className="h-6 w-40 animate-pulse rounded bg-grey-100" />
          <div className="h-64 animate-pulse rounded-lg bg-grey-100" />
        </div>
      </main>
    </div>
  )
}
