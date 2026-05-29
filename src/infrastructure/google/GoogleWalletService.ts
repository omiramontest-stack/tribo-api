/// <reference types="node" />
import { GoogleAuth } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import { logger } from '../logger/logger.js'
import type { Wallet } from '../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../domain/pass/entities/Pass.js'
import type { StampsData, MembershipData, PointsData, CashbackData, DaypassData, BundleData, GiftCardData, CouponData } from '../../domain/pass/entities/PassData.js'
import type { StampsRules, MembershipRules, PointsRules, CashbackRules, DaypassRules, BundleRules, GiftCardRules, CouponRules } from '../../domain/wallet/entities/WalletRules.js'

const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID!
const API_URL = process.env.API_URL!
const BASE_URL = 'https://walletobjects.googleapis.com/walletobjects/v1'

let _credentials: ReturnType<typeof JSON.parse> | null = null
function getCredentials() {
  if (!_credentials) _credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!)
  return _credentials
}

let _auth: GoogleAuth | null = null
function getAuth() {
  if (!_auth) {
    _auth = new GoogleAuth({
      credentials: getCredentials(),
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
    })
  }
  return _auth
}

function sanitizeId(id: string) {
  return id.replace(/-/g, '_')
}

function buildClassId(walletId: string) {
  return `${ISSUER_ID}.wallet_${sanitizeId(walletId)}`
}

function buildObjectId(passToken: string) {
  return `${ISSUER_ID}.pass_${sanitizeId(passToken)}`
}

function buildLoyaltyClass(wallet: Wallet) {
  const classId = buildClassId(wallet.id)
  const rules = wallet.rules

  let rewardsTier = 'Programa de lealtad'
  if (rules.type === 'stamps') rewardsTier = (rules as StampsRules).reward
  else if (rules.type === 'points') rewardsTier = (rules as PointsRules).reward
  else if (rules.type === 'membership') rewardsTier = (rules as MembershipRules).level
  else if (rules.type === 'cashback') rewardsTier = `${(rules as CashbackRules).cashbackPercent}% Cashback`
  else if (rules.type === 'daypass') rewardsTier = (rules as DaypassRules).eventName
  else if (rules.type === 'bundle') rewardsTier = (rules as BundleRules).label
  else if (rules.type === 'giftcard') rewardsTier = `Gift Card ${(rules as GiftCardRules).currency}`
  else if (rules.type === 'coupon') rewardsTier = `${(rules as CouponRules).discount}${(rules as CouponRules).discountType === 'percent' ? '%' : ` ${(rules as CouponRules).currency ?? ''}`} descuento`

  const textModulesData: { header: string; body: string; id: string }[] = []
  if (wallet.businessRules?.trim()) {
    textModulesData.push({ header: 'Términos y condiciones', body: wallet.businessRules, id: 'business_rules' })
  }

  return {
    id: classId,
    issuerName: wallet.businessName,
    programName: wallet.businessName,
    programLogo: {
      sourceUri: { uri: wallet.logoUrl || `${API_URL}/logo-placeholder.png` },
      contentDescription: { defaultValue: { language: 'es', value: wallet.businessName } },
    },
    hexBackgroundColor: wallet.primaryColor,
    reviewStatus: 'UNDER_REVIEW',
    rewardsTier,
    rewardsTierLabel: wallet.description,
    linksModuleData: {
      uris: [{ uri: `${API_URL}/w/`, description: 'Ver mi tarjeta', id: 'wallet_link' }],
    },
    ...(textModulesData.length > 0 ? { textModulesData } : {}),
  }
}

function buildLoyaltyObject(wallet: Wallet, pass: Pass) {
  const objectId = buildObjectId(pass.token)
  const classId = buildClassId(wallet.id)
  const rules = wallet.rules
  const data = pass.data

  let points = { balance: { string: '0' }, label: 'Puntos' }
  let secondaryText = ''

  function fmtExpiry(expiresAt?: string | null): string {
    return expiresAt ? `Vence: ${new Date(expiresAt).toLocaleDateString('es-MX')}` : 'Sin vencimiento'
  }

  if (rules.type === 'stamps' && data.type === 'stamps') {
    const r = rules as StampsRules
    const d = data as StampsData
    points = { balance: { string: `${d.currentStamps} / ${r.totalStamps}` }, label: 'Sellos' }
    secondaryText = `Recompensa: ${r.reward} · ${fmtExpiry(d.expiresAt)}`
  } else if (rules.type === 'points' && data.type === 'points') {
    const r = rules as PointsRules
    const d = data as PointsData
    points = { balance: { string: String(d.currentPoints) }, label: r.pointsLabel }
    secondaryText = `Recompensa a los ${r.rewardThreshold} puntos · ${fmtExpiry(d.expiresAt)}`
  } else if (rules.type === 'membership' && data.type === 'membership') {
    const r = rules as MembershipRules
    const d = data as MembershipData
    points = { balance: { string: r.level }, label: 'Nivel' }
    secondaryText = fmtExpiry(d.expiresAt)
  } else if (rules.type === 'cashback' && data.type === 'cashback') {
    const r = rules as CashbackRules
    const d = data as CashbackData
    points = { balance: { string: `${r.currency} ${d.balance.toFixed(2)}` }, label: 'Saldo cashback' }
    secondaryText = `Cashback: ${r.cashbackPercent}% por compra · ${fmtExpiry(d.expiresAt)}`
  } else if (rules.type === 'daypass' && data.type === 'daypass') {
    const r = rules as DaypassRules
    const _d = data as DaypassData
    points = { balance: { string: new Date(r.eventDate).toLocaleDateString('es-MX') }, label: 'Fecha' }
    secondaryText = `Lugar: ${r.venue}`
  } else if (rules.type === 'bundle' && data.type === 'bundle') {
    const r = rules as BundleRules
    const d = data as BundleData
    points = { balance: { string: `${d.remainingUses} / ${r.totalUses}` }, label: r.label }
    secondaryText = `Usos restantes: ${d.remainingUses} · ${fmtExpiry(d.expiresAt)}`
  } else if (rules.type === 'giftcard' && data.type === 'giftcard') {
    const r = rules as GiftCardRules
    const d = data as GiftCardData
    points = { balance: { string: `${r.currency} ${d.currentBalance.toFixed(2)}` }, label: 'Saldo disponible' }
    secondaryText = `Saldo inicial: ${r.currency} ${d.initialBalance.toFixed(2)} · ${fmtExpiry(d.expiresAt)}`
  } else if (rules.type === 'coupon' && data.type === 'coupon') {
    const r = rules as CouponRules
    const d = data as CouponData
    const discountLabel = r.discountType === 'percent' ? `${r.discount}%` : `${r.currency ?? ''} ${r.discount}`
    points = { balance: { string: discountLabel }, label: 'Descuento' }
    secondaryText = d.used ? 'Cupón usado' : fmtExpiry(d.expiresAt)
  }

  const stampImageModule = wallet.rules.type === 'stamps'
    ? [
        {
          mainImage: {
            sourceUri: {
              uri: `${API_URL}/passes/${pass.token}/stamp-strip?v=${(pass.data as StampsData).currentStamps}`,
            },
            contentDescription: { defaultValue: { language: 'es', value: 'Sellos acumulados' } },
          },
          id: 'stamp_grid',
        },
      ]
    : []

  return {
    id: objectId,
    classId,
    state: 'ACTIVE',
    accountId: pass.token,
    accountName: `${pass.firstName} ${pass.lastName}`,
    loyaltyPoints: points,
    textModulesData: [
      { header: 'Info', body: secondaryText, id: 'info' },
    ],
    ...(stampImageModule.length > 0 ? { imageModulesData: stampImageModule } : {}),
    barcode: {
      type: 'QR_CODE',
      value: `${API_URL}/w/${pass.token}`,
    },
    hexBackgroundColor: wallet.primaryColor,
  }
}

async function ensureClassExists(wallet: Wallet): Promise<void> {
  const auth = getAuth()
  const client = await auth.getClient()
  const classId = buildClassId(wallet.id)

  logger.debug({ classId }, '[GoogleWallet] ensureClassExists')

  let classExists = false

  try {
    const getRes = await client.request({ url: `${BASE_URL}/loyaltyClass/${classId}`, method: 'GET' })
    classExists = !!getRes.data
    logger.debug({ classId, classExists }, '[GoogleWallet] GET loyaltyClass OK')
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status ?? 500
    const body = (e as { response?: { data?: unknown } }).response?.data
    logger.error({ classId, status, body }, '[GoogleWallet] GET loyaltyClass error')
    if (status !== 404) throw new Error(`Google Wallet API error ${status}: ${JSON.stringify(body)}`)
  }

  if (!classExists) {
    logger.debug({ classId }, '[GoogleWallet] class not found, creating')
    try {
      await client.request({ url: `${BASE_URL}/loyaltyClass`, method: 'POST', data: buildLoyaltyClass(wallet) })
      logger.debug({ classId }, '[GoogleWallet] class created OK')
    } catch (e) {
      const body = (e as { response?: { data?: unknown } }).response?.data
      logger.error({ classId, body }, '[GoogleWallet] POST loyaltyClass error')
      throw e
    }
  } else {
    logger.debug({ classId }, '[GoogleWallet] class exists, updating')
    try {
      await client.request({ url: `${BASE_URL}/loyaltyClass/${classId}`, method: 'PUT', data: buildLoyaltyClass(wallet) })
      logger.debug({ classId }, '[GoogleWallet] class updated OK')
    } catch (e) {
      const body = (e as { response?: { data?: unknown } }).response?.data
      logger.error({ classId, body }, '[GoogleWallet] PUT loyaltyClass error')
      throw e
    }
  }
}

export async function generateGoogleWalletUrl(wallet: Wallet, pass: Pass): Promise<string> {
  logger.debug({ walletId: wallet.id, passToken: pass.token, issuerId: ISSUER_ID }, '[GoogleWallet] generateGoogleWalletUrl')

  await ensureClassExists(wallet)

  const credentials = getCredentials()
  const loyaltyObject = buildLoyaltyObject(wallet, pass)

  logger.debug({ objectId: loyaltyObject.id, classId: loyaltyObject.classId }, '[GoogleWallet] loyaltyObject')

  const payload = {
    iss: credentials.client_email,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    payload: { loyaltyObjects: [loyaltyObject] },
  }

  const token = jwt.sign(payload, credentials.private_key, { algorithm: 'RS256' })
  const url = `https://pay.google.com/gp/v/save/${token}`
  logger.debug({ iss: credentials.client_email }, '[GoogleWallet] URL generated OK')
  return url
}

export async function updateGoogleWalletObject(wallet: Wallet, pass: Pass): Promise<void> {
  const auth = getAuth()
  const client = await auth.getClient()
  const objectId = buildObjectId(pass.token)

  logger.debug({ objectId }, '[GoogleWallet] updateGoogleWalletObject')

  await client.request({
    url: `${BASE_URL}/loyaltyObject/${objectId}`,
    method: 'PUT',
    data: buildLoyaltyObject(wallet, pass),
  }).catch(e => {
    logger.error({ objectId, err: (e as Error).message }, '[GoogleWallet] updateGoogleWalletObject error')
    return null
  })
}
