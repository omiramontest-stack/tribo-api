/// <reference types="node" />
import { PKPass } from 'passkit-generator'
import type { Wallet } from '../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../domain/pass/entities/Pass.js'
import type { WalletType } from '../../domain/wallet/entities/Wallet.js'
import type { Geofence } from '../../domain/wallet/entities/Geofence.js'
import type { PassBuilder } from './builders/PassBuilder.js'
import { StampsPassBuilder } from './builders/StampsPassBuilder.js'
import { MembershipPassBuilder } from './builders/MembershipPassBuilder.js'
import { PointsPassBuilder } from './builders/PointsPassBuilder.js'
import { CashbackPassBuilder } from './builders/CashbackPassBuilder.js'
import { DaypassPassBuilder } from './builders/DaypassPassBuilder.js'
import { BundlePassBuilder } from './builders/BundlePassBuilder.js'
import { GiftCardPassBuilder } from './builders/GiftCardPassBuilder.js'
import { CouponPassBuilder } from './builders/CouponPassBuilder.js'
import { StampsStripGenerator } from './assets/StampsStripGenerator.js'
import { PointsStripGenerator } from './assets/PointsStripGenerator.js'
import { fetchImageBuffer, PLACEHOLDER_ICON } from './utils/imageUtils.js'
import { ensureWcagContrast } from './utils/colorUtils.js'
import { themeBackFields, type RecentTransaction } from './utils/passFieldUtils.js'
import { resolveWalletTheme } from '../../domain/wallet/entities/WalletTheme.js'
import type { PlatformBranding } from '../../domain/branding/PlatformBranding.js'

export type { RecentTransaction }

// Strip generators son stateless — se instancian una sola vez y se comparten.
const stampsGenerator = new StampsStripGenerator()
const pointsGenerator = new PointsStripGenerator()

const builders: Record<WalletType, PassBuilder> = {
  stamps:     new StampsPassBuilder(stampsGenerator),
  membership: new MembershipPassBuilder(),
  points:     new PointsPassBuilder(pointsGenerator),
  cashback:   new CashbackPassBuilder(),   // sin strip — usa backgroundColor del pass
  daypass: new DaypassPassBuilder(),
  bundle: new BundlePassBuilder(),
  giftcard: new GiftCardPassBuilder(),
  coupon: new CouponPassBuilder(),
}

const APPLE_PASS_STYLES = ['storeCard', 'coupon', 'eventTicket', 'generic', 'boardingPass'] as const

/** Anexa backFields al estilo de pase que el builder produjo (storeCard, coupon, …). */
function appendBackFields(passJson: object, fields: unknown[]): void {
  if (fields.length === 0) return

  const json = passJson as Record<string, { backFields?: unknown[] } | undefined>
  const styleKey = APPLE_PASS_STYLES.find(k => json[k])
  if (!styleKey) return

  const style = json[styleKey]!
  style.backFields = [...(style.backFields ?? []), ...fields]
}

export async function generatePkPass(
  wallet: Wallet,
  pass: Pass,
  recentTransactions: RecentTransaction[] = [],
  geofences: Geofence[] = [],
  branding: PlatformBranding | null = null,
): Promise<Buffer> {
  const builder = builders[wallet.rules.type]
  if (!builder) throw new Error(`No builder registered for wallet type: ${wallet.rules.type}`)

  // El guard de contraste asume texto BLANCO: oscurece un fondo demasiado claro
  // para que el blanco sea legible. Solo lo aplicamos cuando el texto efectivo es
  // blanco; si el negocio eligió un color de texto propio, respetamos su diseño —
  // la legibilidad ya se valida al guardar (assertThemeContrast).
  const isWhiteText = resolveWalletTheme(wallet).colors.foreground.toUpperCase() === '#FFFFFF'
  const safeWallet: Wallet = isWhiteText
    ? { ...wallet, primaryColor: ensureWcagContrast(wallet.primaryColor) }
    : wallet

  const [passJson, extraAssets] = await Promise.all([
    builder.buildJson(safeWallet, pass, recentTransactions, geofences),
    builder.buildAssets(safeWallet, pass),
  ])

  // Datos de contacto del theme → backFields, inyectados una sola vez aquí en lugar
  // de en cada uno de los 8 builders. Se anexan al estilo que el builder ya produjo.
  appendBackFields(passJson, themeBackFields(resolveWalletTheme(safeWallet).back))

  // Sello de plataforma (gateado por plan) en el reverso del pase.
  if (branding) {
    appendBackFields(passJson, [{ key: 'tribowallet', label: branding.label, value: branding.url }])
  }

  const signerCert = process.env.APPLE_SIGNER_CERT!.replace(/\\n/g, '\n')
  const signerKey = process.env.APPLE_SIGNER_KEY!.replace(/\\n/g, '\n')
  const wwdr = process.env.APPLE_WWDR_CERT!.replace(/\\n/g, '\n')

  const logo = safeWallet.logoUrl ? await fetchImageBuffer(safeWallet.logoUrl) : null
  const iconBuf = logo ?? PLACEHOLDER_ICON

  const pkpass = new PKPass(
    {
      'pass.json': Buffer.from(JSON.stringify(passJson)),
      'icon.png': iconBuf,
      'icon@2x.png': iconBuf,
      'icon@3x.png': iconBuf,
      'logo.png': iconBuf,
      'logo@2x.png': iconBuf,
      'logo@3x.png': iconBuf,
      ...extraAssets,
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
