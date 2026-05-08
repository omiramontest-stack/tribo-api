import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.RESEND_FROM_EMAIL ?? process.env.EMAIL_FROM ?? 'no-reply@walletapp.com'

export async function sendInvitationEmail(opts: {
  to: string
  organizationName: string
  role: string
  inviteUrl: string
}): Promise<void> {
  if (!resend) {
    console.log(`[EmailService] Invitation email to ${opts.to}: ${opts.inviteUrl}`)
    return
  }

  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Te invitaron a ${opts.organizationName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Te invitaron a ${opts.organizationName}</h2>
        <p>Tienes una invitación para unirte como <strong>${opts.role}</strong>.</p>
        <p>
          <a href="${opts.inviteUrl}" style="background:#000;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
            Aceptar invitación
          </a>
        </p>
        <p style="color:#888;font-size:12px">Este enlace expira en 7 días.</p>
      </div>
    `,
  })
}
