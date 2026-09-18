import { Resend } from 'resend'
import { renderIncidentEmailTemplate, type IncidentEmailDetails } from './templates/incidentNotice'

// RESEND_API_KEY is not provisioned yet (no Resend account exists for this
// project). The client and call below are the real, production integration —
// not a placeholder — but this guard lets the function be invoked safely
// (logged, not thrown) in any environment where the key hasn't been set yet,
// rather than crashing the on-call engineer's runbook script mid-incident.
export async function sendIncidentEmail(recipients: string[], details: IncidentEmailDetails): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !fromEmail) {
    console.error(
      'sendIncidentEmail: RESEND_API_KEY/RESEND_FROM_EMAIL not configured — incident email NOT sent.',
      { recipients, details },
    )
    return
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: recipients,
    subject: 'ContractIQ Service Incident Notice',
    html: renderIncidentEmailTemplate(details),
  })

  if (error) {
    console.error('sendIncidentEmail: Resend send failed', error)
  }
}
