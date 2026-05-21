import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { PointsData } from '../../../domain/pass/entities/PassData.js'
import type { PointsRules } from '../../../domain/wallet/entities/WalletRules.js'
import { buildBasePassJson, type PassBuilder } from './PassBuilder.js'
import type { StripGenerator } from '../assets/StripGenerator.js'
import { txBackFields, fullName, type RecentTransaction } from '../utils/passFieldUtils.js'

export class PointsPassBuilder implements PassBuilder {
  constructor(private readonly stripGenerator: StripGenerator) {}

  buildJson(wallet: Wallet, pass: Pass, txs: RecentTransaction[]): object {
    const base = buildBasePassJson(wallet, pass)
    const rules = wallet.rules as PointsRules
    const data = pass.data as PointsData
    const remaining = Math.max(0, rules.rewardThreshold - data.currentPoints)

    return {
      ...base,
      storeCard: {
        headerFields: [
          { key: 'points', label: 'PUNTOS', value: String(data.currentPoints) },
        ],
        primaryFields: [
          { key: 'reward', label: 'RECOMPENSA', value: rules.reward },
        ],
        secondaryFields: [
          { key: 'holder', label: 'TITULAR', value: fullName(pass.firstName, pass.lastName) },
          {
            key: 'next',
            label: 'PARA TU PRÓXIMA RECOMPENSA',
            value: remaining > 0
              ? `Faltan ${remaining} ${rules.pointsLabel}`
              : '¡Listo para canjear!',
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

  async buildAssets(wallet: Wallet, pass: Pass): Promise<Record<string, Buffer>> {
    return this.stripGenerator.generate(wallet, pass)
  }
}
