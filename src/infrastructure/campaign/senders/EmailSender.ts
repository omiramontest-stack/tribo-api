import { Resend } from 'resend'
import type { ISender, SendPayload } from './ISender.js'

export class EmailSender implements ISender {
  private readonly _resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  private readonly _from = process.env.RESEND_FROM_EMAIL ?? 'no-reply@walletapp.com'

  async send(payload: SendPayload): Promise<void> {
    if (!this._resend) {
      console.log(`[EmailSender] Not configured — skipping email to ${payload.to}`)
      return
    }

    await this._resend.emails.send({
      from: this._from,
      to: payload.to,
      subject: `Mensaje de ${payload.organizationName}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <h2>${payload.organizationName}</h2>
          <p style="font-size:16px;line-height:1.6">${payload.body.replace(/\n/g, '<br>')}</p>
          ${payload.passUrl ? `<p><a href="${payload.passUrl}" style="background:#000;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Ver mi pase</a></p>` : ''}
        </div>
      `,
    })
  }
}
