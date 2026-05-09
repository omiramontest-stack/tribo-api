export async function sendPassLinkSms(opts: {
  to: string
  firstName: string
  organizationName: string
  passUrl: string
}): Promise<void> {
  const apiKey = process.env.TELNYX_API_KEY
  const fromNumber = process.env.TELNYX_PHONE_NUMBER

  if (!apiKey || !fromNumber) {
    console.log(`[SmsService] Pass link to ${opts.to}: ${opts.passUrl}`)
    return
  }

  const body = `${opts.organizationName}: Descarga tu wallet aquí: ${opts.passUrl}`

  const res = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromNumber, to: opts.to, text: body }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Telnyx SMS error ${res.status}: ${error}`)
  }
}
