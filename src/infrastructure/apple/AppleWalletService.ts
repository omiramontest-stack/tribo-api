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

/** Anexa los backFields de contacto del theme al estilo de pase que el builder produjo. */
function appendThemeBackFields(passJson: object, back: Parameters<typeof themeBackFields>[0]): void {
  const extra = themeBackFields(back)
  if (extra.length === 0) return

  const json = passJson as Record<string, { backFields?: unknown[] } | undefined>
  const styleKey = APPLE_PASS_STYLES.find(k => json[k])
  if (!styleKey) return

  const style = json[styleKey]!
  style.backFields = [...(style.backFields ?? []), ...extra]
}

export async function generatePkPass(
  wallet: Wallet,
  pass: Pass,
  recentTransactions: RecentTransaction[] = [],
  geofences: Geofence[] = [],
): Promise<Buffer> {
  const builder = builders[wallet.rules.type]
  if (!builder) throw new Error(`No builder registered for wallet type: ${wallet.rules.type}`)

  // Ensure white text (foreground) has WCAG AA contrast against the brand primary color.
  // If the brand color is too light, darken it automatically before generating the pass.
  const safeWallet: Wallet = {
    ...wallet,
    primaryColor: ensureWcagContrast(wallet.primaryColor),
  }

  const [passJson, extraAssets] = await Promise.all([
    builder.buildJson(safeWallet, pass, recentTransactions, geofences),
    builder.buildAssets(safeWallet, pass),
  ])

  // Datos de contacto del theme → backFields, inyectados una sola vez aquí en lugar
  // de en cada uno de los 8 builders. Se anexan al estilo que el builder ya produjo.
  appendThemeBackFields(passJson, resolveWalletTheme(safeWallet).back)

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
