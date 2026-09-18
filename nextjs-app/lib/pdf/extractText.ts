import pdfParse from 'pdf-parse/lib/pdf-parse.js'

// pdf-parse (v1 API) does not itself expose a per-page text array — its
// `pagerender` callback is invoked once per page, strictly in page order
// (pdf-parse awaits each page sequentially before requesting the next), so a
// closure array accumulated inside the callback is a safe, ordered per-page
// capture, not a race-prone side effect.
export async function extractText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const pages: string[] = []

  await pdfParse(buffer, {
    pagerender: (pageData: any) =>
      pageData.getTextContent().then((tc: any) => {
        const pageText = tc.items.map((item: any) => item.str).join(' ')
        pages.push(pageText)
        return pageText
      }),
  })

  const marked = pages.map((pageText, i) => `[PAGE ${i + 1}]\n${pageText}`).join('\n\n')
  return { text: marked, pageCount: pages.length }
}
