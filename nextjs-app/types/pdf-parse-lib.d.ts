// pdf-parse's package-root entry (index.js) has a known bug: it runs a
// debug-only code path (`if (!module.parent)`) that synchronously reads a
// fixture PDF from its own test/ directory — this evaluates true (and
// crashes the build) when Next.js/webpack bundles the module server-side, so
// we import its internal implementation module directly instead, which has
// no such side effect. @types/pdf-parse only covers the package root, so
// this is a minimal ambient declaration for the deep import.
declare module 'pdf-parse/lib/pdf-parse.js' {
  function PdfParse(
    dataBuffer: Buffer,
    options?: {
      pagerender?: (pageData: any) => string | Promise<string>
      max?: number
      version?: string
    },
  ): Promise<{
    numpages: number
    numrender: number
    info: unknown
    metadata: unknown
    text: string
    version: string | null
  }>
  export = PdfParse
}
