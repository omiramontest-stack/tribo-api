/// <reference types="node" />
import { PKPass } from 'passkit-generator'
import { Resvg } from '@resvg/resvg-js'
import type { Wallet } from '../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../domain/pass/entities/Pass.js'
import type { StampsData, MembershipData, PointsData, CashbackData, BundleData, GiftCardData, CouponData } from '../../domain/pass/entities/PassData.js'
import type { StampsRules, MembershipRules, PointsRules, CashbackRules, DaypassRules, BundleRules, GiftCardRules, CouponRules } from '../../domain/wallet/entities/WalletRules.js'

const API_URL = process.env.API_URL!
const PASS_TYPE_ID = process.env.APPLE_PASS_TYPE_ID!
const TEAM_ID = process.env.APPLE_TEAM_ID!

export type RecentTransaction = { label: string; value: string }

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgb(${r},${g},${b})`
}

function svgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, { fitTo: { mode: 'original' } })
  return Buffer.from(resvg.render().asPng())
}

function buildStampsStrip(current: number, total: number, primaryColor: string, accentColor: string): Buffer {
  const W = 750
  const cols = Math.min(5, total)
  const rows = Math.ceil(total / cols)
  const r = 40
  const gap = 20
  const step = r * 2 + gap

  const totalW = cols * step - gap
  const totalH = rows * step - gap
  const padX = (W - totalW) / 2 + r
  const padY = 44 + r
  const H = padY + totalH - r + 44

  let circles = ''
  for (let i = 0; i < total; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx = padX + col * step
    const cy = padY + row * step
    if (i < current) {
      circles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="white"/>`
      circles += `<text x="${cx}" y="${cy + 1}" text-anchor="middle" dominant-baseline="middle" font-size="34" font-family="system-ui, sans-serif" fill="${primaryColor}">✓</text>`
    } else {
      circles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.55)" stroke-width="3"/>`
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${primaryColor}"/>
        <stop offset="100%" stop-color="${accentColor}"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#grad)"/>
    ${circles}
  </svg>`

  return svgToPng(svg)
}

async function buildDaypassStripWithImage(imageUrl: string | null, primaryColor: string, accentColor: string, _eventName: string): Promise<Buffer> {
  const W = 750
  const H = 246

  if (imageUrl) {
    const imgBuf = await fetchLogo(imageUrl)
    if (imgBuf) {
      const b64 = imgBuf.toString('base64')
      const mime = imageUrl.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}">
        <image href="data:${mime};base64,${b64}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
        <rect width="${W}" height="${H}" fill="rgba(0,0,0,0.35)"/>
      </svg>`
      return svgToPng(svg)
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${primaryColor}"/>
        <stop offset="100%" stop-color="${accentColor}"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#grad)"/>
    <circle cx="80" cy="80" r="150" fill="rgba(255,255,255,0.06)"/>
    <circle cx="${W - 60}" cy="${H}" r="120" fill="rgba(255,255,255,0.06)"/>
  </svg>`
  return svgToPng(svg)
}

async function fetchLogo(logoUrl: string): Promise<Buffer | null> {
  try {
    const res = await fetch(logoUrl)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

function txBackFields(txs: RecentTransaction[]) {
  return txs.map((tx, i) => ({ key: `tx_${i}`, label: tx.label, value: tx.value }))
}

function buildBasePassJson(wallet: Wallet, pass: Pass) {
  return {
    formatVersion: 1,
    passTypeIdentifier: PASS_TYPE_ID,
    serialNumber: pass.token,
    teamIdentifier: TEAM_ID,
    organizationName: wallet.businessName,
    description: wallet.description || wallet.businessName,
    backgroundColor: hexToRgb(wallet.primaryColor),
    foregroundColor: 'rgb(255,255,255)',
    labelColor: 'rgb(255,255,255)',
    webServiceURL: `${API_URL}/`,
    authenticationToken: pass.token,
    barcodes: [
      {
        message: `${API_URL}/w/${pass.token}`,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
      },
    ],
  }
}

function buildStampsPassJson(
  base: ReturnType<typeof buildBasePassJson>,
  r: StampsRules,
  d: StampsData,
  pass: Pass,
  txs: RecentTransaction[],
) {
  return {
    ...base,
    storeCard: {
      headerFields: [
        { key: 'count', label: 'Sellos', value: `${d.currentStamps} / ${r.totalStamps}` },
      ],
      secondaryFields: [
        { key: 'name', label: 'Nombre', value: `${pass.firstName} ${pass.lastName}` },
        { key: 'reward', label: 'Recompensa', value: r.reward },
      ],
      backFields: [
        { key: 'info', label: '¿Cómo ganar sellos?', value: 'Gana un sello por cada visita.' },
        { key: 'remaining', label: 'Sellos faltantes', value: String(r.totalStamps - d.currentStamps) },
        { key: 'reward', label: 'Recompensa', value: r.reward },
        ...txBackFields(txs.slice(0, 1).map(tx => ({ label: 'Última actividad', value: tx.value }))),
      ],
    },
  }
}

function buildMembershipPassJson(
  base: ReturnType<typeof buildBasePassJson>,
  r: MembershipRules,
  d: MembershipData,
  pass: Pass,
  txs: RecentTransaction[],
) {
  return {
    ...base,
    generic: {
      primaryFields: [
        { key: 'level', label: 'Nivel', value: r.level },
      ],
      secondaryFields: [
        { key: 'name', label: 'Nombre', value: `${pass.firstName} ${pass.lastName}` },
        { key: 'since', label: 'Miembro desde', value: new Date(d.memberSince).toLocaleDateString('es-MX') },
      ],
      backFields: [
        { key: 'expires', label: 'Vencimiento', value: d.expiresAt ? new Date(d.expiresAt).toLocaleDateString('es-MX') : 'Sin vencimiento' },
        ...txBackFields(txs.slice(0, 1).map(tx => ({ label: 'Última renovación', value: tx.value }))),
      ],
    },
  }
}

function buildPointsPassJson(
  base: ReturnType<typeof buildBasePassJson>,
  r: PointsRules,
  d: PointsData,
  pass: Pass,
  txs: RecentTransaction[],
) {
  return {
    ...base,
    storeCard: {
      primaryFields: [
        { key: 'points', label: r.pointsLabel, value: String(d.currentPoints) },
      ],
      secondaryFields: [
        { key: 'reward', label: 'Recompensa', value: r.reward },
        { key: 'name', label: 'Nombre', value: `${pass.firstName} ${pass.lastName}` },
      ],
      backFields: [
        { key: 'threshold', label: 'Puntos para recompensa', value: String(r.rewardThreshold) },
        ...txBackFields(txs),
      ],
    },
  }
}

function buildCashbackPassJson(
  base: ReturnType<typeof buildBasePassJson>,
  r: CashbackRules,
  d: CashbackData,
  pass: Pass,
  txs: RecentTransaction[],
) {
  return {
    ...base,
    storeCard: {
      primaryFields: [
        { key: 'balance', label: 'Saldo cashback', value: `${r.currency} ${d.balance.toFixed(2)}` },
      ],
      secondaryFields: [
        { key: 'name', label: 'Nombre', value: `${pass.firstName} ${pass.lastName}` },
        { key: 'percent', label: 'Cashback', value: `${r.cashbackPercent}%` },
      ],
      backFields: [
        { key: 'info', label: 'Cómo funciona', value: `Acumulas ${r.cashbackPercent}% de cashback en cada compra.` },
        ...txBackFields(txs),
      ],
    },
  }
}

function buildDaypassPassJson(
  base: ReturnType<typeof buildBasePassJson>,
  r: DaypassRules,
  pass: Pass,
) {
  return {
    ...base,
    eventTicket: {
      primaryFields: [
        { key: 'event', label: 'Evento', value: r.eventName },
      ],
      secondaryFields: [
        { key: 'name', label: 'Nombre', value: `${pass.firstName} ${pass.lastName}` },
        { key: 'venue', label: 'Lugar', value: r.venue },
      ],
      auxiliaryFields: [
        { key: 'date', label: 'Fecha', value: new Date(r.eventDate).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
      ],
      backFields: [
        { key: 'info', label: 'Acceso', value: 'Pase de un solo uso. Presenta este código QR en la entrada del evento.' },
      ],
    },
  }
}

function buildBundlePassJson(
  base: ReturnType<typeof buildBasePassJson>,
  r: BundleRules,
  d: BundleData,
  pass: Pass,
) {
  return {
    ...base,
    storeCard: {
      primaryFields: [
        { key: 'remaining', label: r.label, value: String(d.remainingUses) },
      ],
      secondaryFields: [
        { key: 'name', label: 'Nombre', value: `${pass.firstName} ${pass.lastName}` },
        { key: 'total', label: 'Total usos', value: String(r.totalUses) },
      ],
      backFields: [
        { key: 'info', label: 'Cómo usar', value: `Presenta este código QR para consumir uno de tus ${r.totalUses} ${r.label}.` },
      ],
    },
  }
}

function buildGiftCardPassJson(
  base: ReturnType<typeof buildBasePassJson>,
  r: GiftCardRules,
  d: GiftCardData,
  pass: Pass,
  txs: RecentTransaction[],
) {
  return {
    ...base,
    storeCard: {
      primaryFields: [
        { key: 'balance', label: 'Saldo disponible', value: `${r.currency} ${d.currentBalance.toFixed(2)}` },
      ],
      secondaryFields: [
        { key: 'name', label: 'Nombre', value: `${pass.firstName} ${pass.lastName}` },
        { key: 'initial', label: 'Saldo inicial', value: `${r.currency} ${d.initialBalance.toFixed(2)}` },
      ],
      backFields: [
        { key: 'info', label: 'Cómo usar', value: 'Presenta este código QR para redimir tu saldo.' },
        ...txBackFields(txs),
      ],
    },
  }
}

function buildCouponPassJson(
  base: ReturnType<typeof buildBasePassJson>,
  r: CouponRules,
  d: CouponData,
  pass: Pass,
) {
  const discountLabel = r.discountType === 'percent'
    ? `${r.discount}% de descuento`
    : `${r.currency ?? ''} ${r.discount} de descuento`
  return {
    ...base,
    coupon: {
      primaryFields: [
        { key: 'discount', label: 'Descuento', value: discountLabel },
      ],
      secondaryFields: [
        { key: 'name', label: 'Nombre', value: `${pass.firstName} ${pass.lastName}` },
        { key: 'status', label: 'Estado', value: d.used ? 'Usado' : 'Disponible' },
      ],
      backFields: [
        { key: 'expires', label: 'Vence', value: d.expiresAt ? new Date(d.expiresAt).toLocaleDateString('es-MX') : 'Sin vencimiento' },
        { key: 'info', label: 'Cómo usar', value: 'Presenta este código QR al momento del pago para aplicar el descuento.' },
      ],
    },
  }
}

function buildPassJson(wallet: Wallet, pass: Pass, recentTransactions: RecentTransaction[]) {
  const base = buildBasePassJson(wallet, pass)
  const rules = wallet.rules
  const data = pass.data

  if (rules.type === 'stamps' && data.type === 'stamps')
    return buildStampsPassJson(base, rules as StampsRules, data as StampsData, pass, recentTransactions)

  if (rules.type === 'membership' && data.type === 'membership')
    return buildMembershipPassJson(base, rules as MembershipRules, data as MembershipData, pass, recentTransactions)

  if (rules.type === 'points' && data.type === 'points')
    return buildPointsPassJson(base, rules as PointsRules, data as PointsData, pass, recentTransactions)

  if (rules.type === 'cashback' && data.type === 'cashback')
    return buildCashbackPassJson(base, rules as CashbackRules, data as CashbackData, pass, recentTransactions)

  if (rules.type === 'daypass' && data.type === 'daypass')
    return buildDaypassPassJson(base, rules as DaypassRules, pass)

  if (rules.type === 'bundle' && data.type === 'bundle')
    return buildBundlePassJson(base, rules as BundleRules, data as BundleData, pass)

  if (rules.type === 'giftcard' && data.type === 'giftcard')
    return buildGiftCardPassJson(base, rules as GiftCardRules, data as GiftCardData, pass, recentTransactions)

  if (rules.type === 'coupon' && data.type === 'coupon')
    return buildCouponPassJson(base, rules as CouponRules, data as CouponData, pass)

  throw new Error('Unsupported wallet/pass type combination')
}

const PLACEHOLDER_ICON = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
)

export async function generatePkPass(wallet: Wallet, pass: Pass, recentTransactions: RecentTransaction[] = []): Promise<Buffer> {
  const passJson = buildPassJson(wallet, pass, recentTransactions)

  const signerCert = process.env.APPLE_SIGNER_CERT!.replace(/\\n/g, '\n')
  const signerKey = process.env.APPLE_SIGNER_KEY!.replace(/\\n/g, '\n')
  const wwdr = process.env.APPLE_WWDR_CERT!.replace(/\\n/g, '\n')

  const rules = wallet.rules
  const data = pass.data
  const extraFiles: Record<string, Buffer> = {}

  if (rules.type === 'stamps' && data.type === 'stamps') {
    const r = rules as StampsRules
    const d = data as StampsData
    const strip = buildStampsStrip(d.currentStamps, r.totalStamps, wallet.primaryColor, wallet.accentColor)
    extraFiles['strip.png'] = strip
    extraFiles['strip@2x.png'] = strip
  }

  if (rules.type === 'daypass') {
    const r = rules as DaypassRules
    const strip = await buildDaypassStripWithImage(r.imageUrl, wallet.primaryColor, wallet.accentColor, r.eventName)
    extraFiles['strip.png'] = strip
    extraFiles['strip@2x.png'] = strip
    extraFiles['strip@3x.png'] = strip
  }

  const logo = wallet.logoUrl ? await fetchLogo(wallet.logoUrl) : null
  const iconBuf = logo ?? PLACEHOLDER_ICON

  const pkpass = new PKPass(
    {
      'pass.json': Buffer.from(JSON.stringify(passJson)),
      'icon.png': iconBuf,
      'icon@2x.png': iconBuf,
      'icon@3x.png': iconBuf,
      'logo.png': iconBuf,
      'logo@2x.png': iconBuf,
      ...extraFiles,
    },
    {
      wwdr,
      signerCert,
      signerKey,
      signerKeyPassphrase: process.env.APPLE_SIGNER_KEY_PASSPHRASE || undefined,
    },
  )

  return pkpass.getAsBuffer()
}
