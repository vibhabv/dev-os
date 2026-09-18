// pdfjs-dist's worker file uses `import.meta` at its top level, which breaks
// Next.js's webpack+Terser production build if it's imported and let webpack
// bundle/minify it as an asset. The fix is to serve it as a static file
// instead (referenced by plain string path, never imported), so it's copied
// here into public/ where Next serves it unprocessed — run on postinstall
// and before every build so it's never stale relative to the installed
// pdfjs-dist version.
const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs')
const destDir = path.join(__dirname, '..', 'public')
const dest = path.join(destDir, 'pdf.worker.min.mjs')

if (!fs.existsSync(src)) {
  console.warn('[copyPdfWorker] pdfjs-dist worker not found, skipping copy:', src)
  process.exit(0)
}

fs.mkdirSync(destDir, { recursive: true })
fs.copyFileSync(src, dest)
console.log('[copyPdfWorker] copied pdf.worker.min.mjs to public/')
