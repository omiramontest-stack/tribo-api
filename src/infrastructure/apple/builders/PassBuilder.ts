import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { RecentTransaction } from '../utils/passFieldUtils.js'
import { hexToRgb } from '../utils/colorUtils.js'

export type BasePassJson = ReturnType<typeof buildBasePassJson>

const API_URL = process.env.API_URL!
const PASS_TYPE_ID = process.env.APPLE_PASS_TYPE_ID!
const TEAM_ID = process.env.APPLE_TEAM_ID!

export function buildBasePassJson(wallet: Wallet, pass: Pass) {
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

export interface PassBuilder {
  buildJson(wallet: Wallet, pass: Pass, txs: RecentTransaction[]): object
  buildAssets(wallet: Wallet, pass: Pass): Promise<Record<string, Buffer>>
}
