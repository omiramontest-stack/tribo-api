import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'

export type StripSet = {
  'strip.png': Buffer
  'strip@2x.png': Buffer
  'strip@3x.png': Buffer
  // background.png covers the full card back — iOS blurs and darkens it.
  // Optional: only storeCard passes include it.
  'background.png'?: Buffer
  'background@2x.png'?: Buffer
  'background@3x.png'?: Buffer
}

export interface StripGenerator {
  generate(wallet: Wallet, pass: Pass): Promise<StripSet>
}
