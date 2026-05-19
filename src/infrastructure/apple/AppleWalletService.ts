/// <reference types="node" />
import { PKPass } from 'passkit-generator'
import type { Wallet } from '../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../domain/pass/entities/Pass.js'
import type { WalletType } from '../../domain/wallet/entities/Wallet.js'
import type { PassBuilder } from './builders/PassBuilder.js'
import { StampsPassBuilder } from './builders/StampsPassBuilder.js'
import { MembershipPassBuilder } from './builders/MembershipPassBuilder.js'
import { PointsPassBuilder } from './builders/PointsPassBuilder.js'
import { CashbackPassBuilder } from './builders/CashbackPassBuilder.js'
import { DaypassPassBuilder } from './builders/DaypassPassBuilder.js'
import { BundlePassBuilder } from './builders/BundlePassBuilder.js'
import { GiftCardPassBuilder } from './builders/GiftCardPassBuilder.js'
import { CouponPassBuilder } from './builders/CouponPassBuilder.js'
import { fetchImageBuffer, PLACEHOLDER_ICON } from './utils/imageUtils.js'
import type { RecentTransaction } from './utils/passFieldUtils.js'

export type { RecentTransaction }

const builders: Record<WalletType, PassBuilder> = {
  stamps: new StampsPassBuilder(),
  membership: new MembershipPassBuilder(),
  points: new PointsPassBuilder(),
  cashback: new CashbackPassBuilder(),
  daypass: new DaypassPassBuilder(),
  bundle: new BundlePassBuilder(),
  giftcard: new GiftCardPassBuilder(),
  coupon: new CouponPassBuilder(),
}

export async function generatePkPass(
  wallet: Wallet,
  pass: Pass,
  recentTransactions: RecentTransaction[] = [],
): Promise<Buffer> {
  const builder = builders[wallet.rules.type]
  if (!builder) throw new Error(`No builder registered for wallet type: ${wallet.rules.type}`)

  const [passJson, extraAssets] = await Promise.all([
    builder.buildJson(wallet, pass, recentTransactions),
    builder.buildAssets(wallet, pass),
  ])

  const signerCert = process.env.APPLE_SIGNER_CERT!.replace(/\\n/g, '\n')
  const signerKey = process.env.APPLE_SIGNER_KEY!.replace(/\\n/g, '\n')
  const wwdr = process.env.APPLE_WWDR_CERT!.replace(/\\n/g, '\n')

  const logo = wallet.logoUrl ? await fetchImageBuffer(wallet.logoUrl) : null
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
