import http2 from 'http2'
import jwt from 'jsonwebtoken'
import { logger } from '../logger/logger.js'

const APNS_HOST = 'api.push.apple.com'
const APNS_PORT = 443

let cachedToken: { value: string; generatedAt: number } | null = null

function getJwtToken(): string {
  const now = Math.floor(Date.now() / 1000)
  // Regenerar si tiene más de 55 minutos (APNs rechaza tokens > 60 min)
  if (cachedToken && now - cachedToken.generatedAt < 55 * 60) {
    return cachedToken.value
  }
  const key = process.env.APPLE_APNS_KEY!.replace(/\\n/g, '\n')
  const token = jwt.sign({ iss: process.env.APPLE_TEAM_ID!, iat: now }, key, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: process.env.APPLE_APNS_KEY_ID! },
  })
  cachedToken = { value: token, generatedAt: now }
  return token
}

type PushType = 'background' | 'alert'

async function sendOne(pushToken: string, pushType: PushType, payload: object): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = http2.connect(`https://${APNS_HOST}:${APNS_PORT}`)
    client.on('error', (err) => { client.destroy(); reject(err) })

    const body = JSON.stringify(payload)
    const headers: http2.OutgoingHttpHeaders = {
      ':method': 'POST',
      ':path': `/3/device/${pushToken}`,
      ':scheme': 'https',
      ':authority': APNS_HOST,
      'authorization': `bearer ${getJwtToken()}`,
      'apns-topic': process.env.APPLE_PASS_TYPE_ID!,
      'apns-push-type': pushType,
      'apns-priority': pushType === 'background' ? '5' : '10',
      'apns-expiration': '0',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body).toString(),
    }

    const req = client.request(headers)
    req.setEncoding('utf8')

    let status = 0
    let responseData = ''

    req.on('response', (resHeaders) => {
      status = Number(resHeaders[':status'])
    })
    req.on('data', (chunk) => { responseData += chunk })
    req.on('end', () => {
      client.close()
      if (status === 200) {
        resolve()
      } else {
        reject(new Error(`APNs ${status}: ${responseData}`))
      }
    })
    req.on('error', (err) => { client.destroy(); reject(err) })
    req.write(body)
    req.end()
  })
}

async function sendToTokens(pushTokens: string[], pushType: PushType, payload: object, label: string): Promise<void> {
  if (!pushTokens.length) {
    logger.warn(`[APNs] ${label}: no push tokens, skipping`)
    return
  }
  logger.info({ count: pushTokens.length, topic: process.env.APPLE_PASS_TYPE_ID, pushType }, `[APNs] sending ${label}`)
  const results = await Promise.allSettled(pushTokens.map(t => sendOne(t, pushType, payload)))
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') logger.info({ token: pushTokens[i].slice(-8) }, `[APNs] ${label} delivered`)
    else logger.error({ token: pushTokens[i].slice(-8), err: (r.reason as Error).message }, `[APNs] ${label} failed`)
  })
}

export async function sendPassUpdateNotification(pushTokens: string[]): Promise<void> {
  await sendToTokens(pushTokens, 'background', {}, 'silent pass update')
}

export async function sendCampaignNotification(pushTokens: string[], title: string, body: string): Promise<void> {
  const payload = { aps: { alert: { title, body }, sound: 'default' } }
  await sendToTokens(pushTokens, 'alert', payload, `notification "${title}"`)
}
