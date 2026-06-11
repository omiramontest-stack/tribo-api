import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { Geofence } from '../../../domain/wallet/entities/Geofence.js'
import type { RecentTransaction } from '../utils/passFieldUtils.js'
import { hexToRgb } from '../utils/colorUtils.js'

export type BasePassJson = ReturnType<typeof buildBasePassJson>

const API_URL = process.env.API_URL!
const PASS_TYPE_ID = process.env.APPLE_PASS_TYPE_ID!
const TEAM_ID = process.env.APPLE_TEAM_ID!

/** Apple Wallet soporta hasta 10 locations por pase. */
const APPLE_MAX_LOCATIONS = 10

export function buildBasePassJson(wallet: Wallet, pass: Pass, geofences: Geofence[] = []) {
  const activeGeofences = geofences.filter(g => g.isActive).slice(0, APPLE_MAX_LOCATIONS)

  const locations = activeGeofences.map(g => ({
    latitude: g.latitude,
    longitude: g.longitude,
    relevantText: g.message,
  }))

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
    authenticationToken: pass.authToken,
    barcodes: [
      {
        message: `${API_URL}/w/${pass.token}`,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
      },
    ],
    ...(locations.length > 0 && { locations }),
  }
}

export interface PassBuilder {
  buildJson(wallet: Wallet, pass: Pass, txs: RecentTransaction[], geofences?: Geofence[]): object
  buildAssets(wallet: Wallet, pass: Pass): Promise<Record<string, Buffer>>
}
