export function FooterAttribution() {
  const statusPageUrl = process.env.NEXT_PUBLIC_STATUS_PAGE_URL

  return (
    <footer className="flex flex-col items-center gap-2 border-t border-grey-100 px-4 py-6 text-body-sm text-grey-500">
      <p>Powered by OpenAI GPT-4o.</p>
      {statusPageUrl && (
        <a href={statusPageUrl} target="_blank" rel="noopener noreferrer" className="hover:text-grey-900">
          System status
        </a>
      )}
    </footer>
  )
}
