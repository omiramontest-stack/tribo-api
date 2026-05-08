/// <reference types="node" />
import { GoogleAuth } from 'google-auth-library'
import jwt from 'jsonwebtoken'
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

function buildClassId(walletId: string) {
  return `${ISSUER_ID}.wallet_${walletId}`
}

function buildObjectId(passToken: string) {
  return `${ISSUER_ID}.pass_${passToken}`
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
  }
}

function buildLoyaltyObject(wallet: Wallet, pass: Pass) {
  const objectId = buildObjectId(pass.token)
  const classId = buildClassId(wallet.id)
  const rules = wallet.rules
  const data = pass.data

  let points = { balance: { string: '0' }, label: 'Puntos' }
  let secondaryText = ''

  if (rules.type === 'stamps' && data.type === 'stamps') {
    const r = rules as StampsRules
    const d = data as StampsData
    points = { balance: { string: `${d.currentStamps} / ${r.totalStamps}` }, label: 'Sellos' }
    secondaryText = `Recompensa: ${r.reward}`
  } else if (rules.type === 'points' && data.type === 'points') {
    const r = rules as PointsRules
    const d = data as PointsData
    points = { balance: { string: String(d.currentPoints) }, label: r.pointsLabel }
    secondaryText = `Recompensa a los ${r.rewardThreshold} puntos`
  } else if (rules.type === 'membership' && data.type === 'membership') {
    const r = rules as MembershipRules
    const d = data as MembershipData
    points = { balance: { string: r.level }, label: 'Nivel' }
    secondaryText = d.expiresAt
      ? `Vence: ${new Date(d.expiresAt).toLocaleDateString('es-MX')}`
      : 'Sin vencimiento'
  } else if (rules.type === 'cashback' && data.type === 'cashback') {
    const r = rules as CashbackRules
    const d = data as CashbackData
    points = { balance: { string: `${r.currency} ${d.balance.toFixed(2)}` }, label: 'Saldo cashback' }
    secondaryText = `Cashback: ${r.cashbackPercent}% por compra`
  } else if (rules.type === 'daypass' && data.type === 'daypass') {
    const r = rules as DaypassRules
    const _d = data as DaypassData
    points = { balance: { string: new Date(r.eventDate).toLocaleDateString('es-MX') }, label: 'Fecha' }
    secondaryText = `Lugar: ${r.venue}`
  } else if (rules.type === 'bundle' && data.type === 'bundle') {
    const r = rules as BundleRules
    const d = data as BundleData
    points = { balance: { string: `${d.remainingUses} / ${r.totalUses}` }, label: r.label }
    secondaryText = `Usos restantes: ${d.remainingUses}`
  } else if (rules.type === 'giftcard' && data.type === 'giftcard') {
    const r = rules as GiftCardRules
    const d = data as GiftCardData
    points = { balance: { string: `${r.currency} ${d.currentBalance.toFixed(2)}` }, label: 'Saldo disponible' }
    secondaryText = `Saldo inicial: ${r.currency} ${d.initialBalance.toFixed(2)}`
  } else if (rules.type === 'coupon' && data.type === 'coupon') {
    const r = rules as CouponRules
    const d = data as CouponData
    const discountLabel = r.discountType === 'percent' ? `${r.discount}%` : `${r.currency ?? ''} ${r.discount}`
    points = { balance: { string: discountLabel }, label: 'Descuento' }
    secondaryText = d.used ? 'Cupón usado' : (d.expiresAt ? `Vence: ${new Date(d.expiresAt).toLocaleDateString('es-MX')}` : 'Sin vencimiento')
  }

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

  const getRes = await client.request({
    url: `${BASE_URL}/loyaltyClass/${classId}`,
    method: 'GET',
  }).catch(e => ({ status: (e as { response?: { status?: number } }).response?.status ?? 500 }))

  if ((getRes as { status?: number }).status === 404 || (getRes as { data?: unknown }).data === undefined) {
    await client.request({
      url: `${BASE_URL}/loyaltyClass`,
      method: 'POST',
      data: buildLoyaltyClass(wallet),
    })
  } else {
    await client.request({
      url: `${BASE_URL}/loyaltyClass/${classId}`,
      method: 'PUT',
      data: buildLoyaltyClass(wallet),
    })
  }
}

export async function generateGoogleWalletUrl(wallet: Wallet, pass: Pass): Promise<string> {
  await ensureClassExists(wallet)

  const credentials = getCredentials()
  const loyaltyObject = buildLoyaltyObject(wallet, pass)

  const payload = {
    iss: credentials.client_email,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    payload: { loyaltyObjects: [loyaltyObject] },
  }

  const token = jwt.sign(payload, credentials.private_key, { algorithm: 'RS256' })
  return `https://pay.google.com/gp/v/save/${token}`
}

export async function updateGoogleWalletObject(wallet: Wallet, pass: Pass): Promise<void> {
  const auth = getAuth()
  const client = await auth.getClient()
  const objectId = buildObjectId(pass.token)

  await client.request({
    url: `${BASE_URL}/loyaltyObject/${objectId}`,
    method: 'PUT',
    data: buildLoyaltyObject(wallet, pass),
  }).catch(() => null)
}
