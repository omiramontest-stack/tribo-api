import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'

export const MAX_SMS_SEGMENTS = 3

// GSM-7 basic charset — messages using only these chars cost 160 chars/segment
const GSM7 = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
)

function isGsm7(text: string): boolean {
  return [...text].every(c => GSM7.has(c))
}

export function countSmsSegments(text: string): number {
  const unicode = !isGsm7(text)
  const len = text.length
  if (unicode) {
    return len <= 70 ? 1 : Math.ceil(len / 67)
  }
  return len <= 160 ? 1 : Math.ceil(len / 153)
}

export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? '')
}

export function buildVariables(pass: Pass, wallet: Wallet, organizationName: string): Record<string, string> {
  const data = pass.data
  const apiUrl = process.env.API_URL ?? 'http://localhost:3000'

  return {
    firstName: pass.firstName,
    lastName: pass.lastName,
    fullName: `${pass.firstName} ${pass.lastName}`,
    phone: pass.phone,
    businessName: wallet.businessName,
    organizationName,
    passUrl: `${apiUrl}/passes/w/${pass.token}`,
    passToken: pass.token,
    stamps: data.type === 'stamps' ? String(data.currentStamps) : '',
    points: data.type === 'points' ? String(data.currentPoints) : '',
    balance: data.type === 'cashback' ? String(data.balance) : '',
  }
}
