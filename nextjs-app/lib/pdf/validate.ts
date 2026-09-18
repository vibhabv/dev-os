export function isValidMimeType(mimeType: string): boolean {
  return mimeType === 'application/pdf'
}

export function isWithinSizeLimit(bytes: number): boolean {
  return bytes <= 10_485_760
}

export function isWithinPageLimit(pageCount: number): boolean {
  return pageCount <= 20
}

export function isLikelyScanned(wordCount: number): boolean {
  return wordCount < 100
}

export function isWithinTokenLimit(tokenCount: number): boolean {
  return tokenCount <= 15000
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}
