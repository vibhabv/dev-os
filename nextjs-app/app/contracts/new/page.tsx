import Link from 'next/link'
import { UploadWizard } from './UploadWizard'

export default function UploadPage() {
  return (
    <div className="flex min-h-screen flex-col bg-grey-25">
      <header className="border-b border-grey-100 bg-white px-6 py-4 md:px-28">
        <Link href="/dashboard" className="text-h5 text-grey-900">
          ContractIQ
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10 md:py-16">
        <h1 className="text-h3 text-grey-900">Review a contract</h1>
        <UploadWizard />
      </main>
    </div>
  )
}
