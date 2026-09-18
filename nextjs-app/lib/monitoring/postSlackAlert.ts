export async function postSlackAlert(webhookUrl: string | undefined, text: string): Promise<void> {
  if (!webhookUrl) {
    console.error('Slack webhook URL not configured — alert not sent:', text)
    return
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) {
      console.error('Slack alert failed', { status: res.status, text })
    }
  } catch (err) {
    // Never throws — a failed alert must not fail the scheduled function's overall run
    // (docs/specs/13-rate-limiting-and-cost-control.md edge cases table).
    console.error('Slack alert threw', err)
  }
}
