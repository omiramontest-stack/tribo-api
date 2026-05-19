import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { MembershipData } from '../../../domain/pass/entities/PassData.js'
import type { MembershipRules } from '../../../domain/wallet/entities/WalletRules.js'
import { buildBasePassJson, type PassBuilder } from './PassBuilder.js'
import { buildGradientStripSet } from '../assets/GradientStripGenerator.js'
import { txBackFields, fullName, formatDate, type RecentTransaction } from '../utils/passFieldUtils.js'
import { fetchImageBuffer } from '../utils/imageUtils.js'

export class MembershipPassBuilder implements PassBuilder {
  buildJson(wallet: Wallet, pass: Pass, txs: RecentTransaction[]): object {
    const base = buildBasePassJson(wallet, pass)
    const rules = wallet.rules as MembershipRules
    const data = pass.data as MembershipData

    const expiresValue = data.expiresAt
      ? formatDate(data.expiresAt)
      : 'Sin vencimiento'

    return {
      ...base,
      generic: {
        primaryFields: [
          { key: 'level', label: 'Nivel', value: rules.level },
        ],
        secondaryFields: [
          { key: 'name', label: 'Titular', value: fullName(pass.firstName, pass.lastName) },
          { key: 'since', label: 'Miembro desde', value: formatDate(data.memberSince) },
        ],
        auxiliaryFields: [
          { key: 'expires', label: 'Vigencia', value: expiresValue },
        ],
        backFields: [
          { key: 'expires_detail', label: 'Vencimiento', value: expiresValue },
          { key: 'level', label: 'Nivel de membresía', value: rules.level },
          ...txBackFields(txs.slice(0, 1).map(tx => ({ label: 'Última renovación', value: tx.value }))),
        ],
      },
    }
  }

  async buildAssets(wallet: Wallet, pass: Pass): Promise<Record<string, Buffer>> {
    const assets: Record<string, Buffer> = buildGradientStripSet(wallet.primaryColor, wallet.accentColor)

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
