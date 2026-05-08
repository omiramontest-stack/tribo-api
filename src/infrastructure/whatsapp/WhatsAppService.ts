const GRAPH_API = 'https://graph.facebook.com/v19.0'

const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
const templateName = process.env.WHATSAPP_TEMPLATE_NAME ?? 'pass_link'
const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'es_MX'

export async function sendPassLinkWhatsApp(opts: {
  to: string
  organizationName: string
  passUrl: string
}): Promise<void> {
  if (!phoneNumberId || !accessToken) {
    console.log(`[WhatsAppService] Pass link to ${opts.to}: ${opts.passUrl}`)
    return
  }

  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: opts.to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLanguage },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', parameter_name: 'organization_name', text: opts.organizationName },
              { type: 'text', parameter_name: 'download_link_wallet', text: opts.passUrl },
            ],
          },
        ],
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`WhatsApp API error ${res.status}: ${body}`)
  }
}
