import type { ISender, SendPayload } from './ISender.js'

export class SmsSender implements ISender {
  async send(payload: SendPayload): Promise<void> {
    const apiKey = process.env.TELNYX_API_KEY
    const fromNumber = process.env.TELNYX_PHONE_NUMBER

    if (!apiKey || !fromNumber) {
      console.log(`[SmsSender] Not configured — skipping SMS to ${payload.to}`)
      return
    }

    const res = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromNumber, to: payload.to, text: payload.body }),
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`Telnyx SMS error ${res.status}: ${error}`)
    }
  }
}
