import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'

export type StripSet = {
  'strip.png': Buffer
  'strip@2x.png': Buffer
  'strip@3x.png': Buffer
}

export interface StripGenerator {
  generate(wallet: Wallet, pass: Pass): Promise<StripSet>
}
