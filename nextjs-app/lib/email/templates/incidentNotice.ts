export interface IncidentEmailDetails {
  summary: string
  startedAt: string
}

export function renderIncidentEmailTemplate({ summary, startedAt }: IncidentEmailDetails): string {
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ContractIQ Service Incident Notice</title>
  </head>
  <body style="margin:0;padding:0;background-color:#FAFAFA;font-family:'Inter Display',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFAFA;padding:48px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:12px;border:1px solid #DADADB;padding:32px;">
            <tr>
              <td>
                <h1 style="font-size:24px;line-height:32px;font-weight:500;color:#070A0E;margin:0 0 16px;">ContractIQ Service Incident Notice</h1>
                <p style="font-size:16px;line-height:24px;color:#4A4C4F;margin:0 0 16px;">
                  We want to let you know about a service incident that may have affected your account.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAEBEB;border:1px solid #F1C0C1;border-radius:8px;padding:16px;margin-bottom:16px;">
                  <tr>
                    <td style="font-size:12px;line-height:18px;color:#4A4C4F;padding-bottom:4px;">Incident started</td>
                  </tr>
                  <tr>
                    <td style="font-size:16px;line-height:24px;color:#070A0E;font-weight:500;padding-bottom:12px;">${startedAt}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;line-height:18px;color:#4A4C4F;padding-bottom:4px;">Summary</td>
                  </tr>
                  <tr>
                    <td style="font-size:16px;line-height:24px;color:#070A0E;">${summary}</td>
                  </tr>
                </table>
                <p style="font-size:16px;line-height:24px;color:#4A4C4F;margin:0;">
                  If you have any questions, please reply to this email and our team will follow up directly.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim()
}
