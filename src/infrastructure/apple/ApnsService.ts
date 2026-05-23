/// <reference types="node" />
import apn from 'apn'
import { logger } from '../logger/logger.js'

let provider: apn.Provider | null = null

function getProvider(): apn.Provider {
  if (!provider) {
    provider = new apn.Provider({
      token: {
        key: process.env.APPLE_APNS_KEY!.replace(/\\n/g, '\n'),
        keyId: process.env.APPLE_APNS_KEY_ID!,
        teamId: process.env.APPLE_TEAM_ID!,
      },
      production: true,
    })
  }
  return provider
}

export async function sendPassUpdateNotification(pushTokens: string[]): Promise<void> {
  if (!pushTokens.length) return
  const provider = getProvider()
  const note = new apn.Notification()
  note.topic = process.env.APPLE_PASS_TYPE_ID!
  const results = await Promise.allSettled(pushTokens.map(token => provider.send(note, token)))
  results.forEach(r => {
    if (r.status === 'fulfilled') logger.info({ result: r.value }, '[APNs] push sent')
    else logger.error({ err: r.reason }, '[APNs] push failed')
  })
}

export async function sendCampaignNotification(pushTokens: string[], title: string, body: string): Promise<void> {
  if (!pushTokens.length) return
  const provider = getProvider()
  const note = new apn.Notification()
  note.topic = process.env.APPLE_PASS_TYPE_ID!
  note.alert = { title, body }
  note.sound = 'default'
  const results = await Promise.allSettled(pushTokens.map(token => provider.send(note, token)))
  results.forEach(r => {
    if (r.status === 'fulfilled') logger.info({ result: r.value }, '[APNs] campaign push sent')
    else logger.error({ err: r.reason }, '[APNs] campaign push failed')
  })
}
