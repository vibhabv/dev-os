export function CalibrationWarningBanner() {
  if (process.env.NEXT_PUBLIC_CALIBRATION_WARNING !== 'true') return null

  return (
    <div role="note" className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-body-sm text-yellow-800">
      Our confidence scores are currently being recalibrated and may be less accurate than usual. We recommend
      verifying all terms directly in the document.
    </div>
  )
}
