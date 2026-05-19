import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { PointsData } from '../../../domain/pass/entities/PassData.js'
import type { PointsRules } from '../../../domain/wallet/entities/WalletRules.js'
import { buildBasePassJson, type PassBuilder } from './PassBuilder.js'
import { buildGradientStripSet } from '../assets/GradientStripGenerator.js'
import { txBackFields, fullName, type RecentTransaction } from '../utils/passFieldUtils.js'

export class PointsPassBuilder implements PassBuilder {
  buildJson(wallet: Wallet, pass: Pass, txs: RecentTransaction[]): object {
    const base = buildBasePassJson(wallet, pass)
    const rules = wallet.rules as PointsRules
    const data = pass.data as PointsData
    const remaining = Math.max(0, rules.rewardThreshold - data.currentPoints)

    return {
      ...base,
      storeCard: {
        headerFields: [
          { key: 'points', label: rules.pointsLabel.toUpperCase(), value: String(data.currentPoints) },
        ],
        primaryFields: [
          { key: 'reward', label: 'Recompensa', value: rules.reward },
        ],
        secondaryFields: [
          { key: 'name', label: 'Titular', value: fullName(pass.firstName, pass.lastName) },
        ],
        auxiliaryFields: [
          {
            key: 'progress',
            label: 'Para tu próxima recompensa',
            value: remaining > 0
              ? `Faltan ${remaining} ${rules.pointsLabel}`
              : `¡Listo para canjear!`,
          },
        ],
        backFields: [
          { key: 'threshold', label: `${rules.pointsLabel} necesarios`, value: String(rules.rewardThreshold) },
          { key: 'current', label: `${rules.pointsLabel} acumulados`, value: String(data.currentPoints) },
          { key: 'remaining', label: `${rules.pointsLabel} restantes`, value: String(remaining) },
          ...txBackFields(txs),
        ],
      },
    }
  }

  async buildAssets(wallet: Wallet): Promise<Record<string, Buffer>> {
    return buildGradientStripSet(wallet.primaryColor, wallet.accentColor)
  }
}
