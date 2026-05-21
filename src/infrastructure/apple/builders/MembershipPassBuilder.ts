import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { MembershipData } from '../../../domain/pass/entities/PassData.js'
import type { MembershipRules } from '../../../domain/wallet/entities/WalletRules.js'
import { buildBasePassJson, type PassBuilder } from './PassBuilder.js'
import { txBackFields, fullName, formatDate, type RecentTransaction } from '../utils/passFieldUtils.js'
import { fetchImageBuffer } from '../utils/imageUtils.js'

export class MembershipPassBuilder implements PassBuilder {
  buildJson(wallet: Wallet, pass: Pass, txs: RecentTransaction[]): object {
    const base = buildBasePassJson(wallet, pass)
    const rules = wallet.rules as MembershipRules
    const data = pass.data as MembershipData

    const expiresValue = data.expiresAt ? formatDate(data.expiresAt) : 'Sin vencimiento'
    const sinceValue = formatDate(data.memberSince)

    return {
      ...base,
      // generic pass type es correcto para membresía — soporta thumbnail a la derecha
      generic: {
        // primaryFields: valor principal grande (nivel de membresía)
        primaryFields: [
          { key: 'level', label: 'NIVEL', value: rules.level },
        ],
        // secondaryFields: fecha de ingreso prominente
        secondaryFields: [
          { key: 'since', label: 'MIEMBRO DESDE', value: sinceValue },
        ],
        // auxiliaryFields: nombre + vencimiento — coincide con el diseño del frontend
        auxiliaryFields: [
          { key: 'holder', label: 'NOMBRE', value: fullName(pass.firstName, pass.lastName) },
          { key: 'valid', label: 'VENCIMIENTO', value: expiresValue },
        ],
        backFields: [
          { key: 'level_detail', label: 'Nivel de membresía', value: rules.level },
          { key: 'since_detail', label: 'Miembro desde', value: sinceValue },
          { key: 'expires_detail', label: 'Vencimiento', value: expiresValue },
          ...txBackFields(txs.slice(0, 1).map(tx => ({ label: 'Última renovación', value: tx.value }))),
        ],
      },
    }
  }

  async buildAssets(wallet: Wallet, pass: Pass): Promise<Record<string, Buffer>> {
    const assets: Record<string, Buffer> = {}

    // generic passes display a thumbnail instead of a strip
    const data = pass.data as MembershipData
    const thumbnailUrl = data.photoUrl ?? wallet.logoUrl
    if (thumbnailUrl) {
      const thumb = await fetchImageBuffer(thumbnailUrl)
      if (thumb) {
        assets['thumbnail.png'] = thumb
        assets['thumbnail@2x.png'] = thumb
        assets['thumbnail@3x.png'] = thumb
      }
    }

    return assets
  }
}
