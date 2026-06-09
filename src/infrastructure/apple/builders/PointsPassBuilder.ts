import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { PointsData } from '../../../domain/pass/entities/PassData.js'
import type { PointsRules } from '../../../domain/wallet/entities/WalletRules.js'
import { buildBasePassJson, type PassBuilder } from './PassBuilder.js'
import type { StripGenerator } from '../assets/StripGenerator.js'
import { txBackFields, businessRulesBackField, campaignMessageBackField, fullName, formatDate, type RecentTransaction } from '../utils/passFieldUtils.js'

export class PointsPassBuilder implements PassBuilder {
  constructor(private readonly stripGenerator: StripGenerator) {}

  buildJson(wallet: Wallet, pass: Pass, txs: RecentTransaction[]): object {
    const base      = buildBasePassJson(wallet, pass)
    const rules     = wallet.rules as PointsRules
    const data      = pass.data   as PointsData
    const remaining = Math.max(0, rules.rewardThreshold - data.currentPoints)

    return {
      ...base,
      storeCard: {
        // headerFields: esquina superior derecha junto al logo.
        headerFields: [
          { key: 'meta', label: 'META', value: `${rules.rewardThreshold} pts` },
        ],

        // primaryFields: Apple los renderiza con tipografía grande sobre el strip.
        // PKTextAlignmentCenter centra el valor horizontalmente en la tarjeta.
        primaryFields: [
          {
            key:           'pts',
            label:         'PUNTOS',
            value:         String(data.currentPoints),
            textAlignment: 'PKTextAlignmentCenter',
            changeMessage: 'Has acumulado %@ puntos',
          },
        ],

        secondaryFields: [
          { key: 'holder', label: 'NOMBRE',           value: fullName(pass.firstName, pass.lastName) },
          {
            key:   'next',
            label: 'PUNTOS FALTANTES',
            value: remaining > 0 ? `${remaining} puntos` : '¡Listo para canjear!',
          },
        ],

        backFields: [
          { key: 'threshold', label: `${rules.pointsLabel} necesarios`,  value: String(rules.rewardThreshold) },
          { key: 'current',   label: `${rules.pointsLabel} acumulados`,  value: String(data.currentPoints) },
          { key: 'remaining', label: `${rules.pointsLabel} restantes`,   value: String(remaining) },
          { key: 'reward',    label: 'Recompensa',                        value: rules.reward },
          { key: 'expires',   label: 'Vencimiento',                       value: data.expiresAt ? formatDate(data.expiresAt) : 'Sin vencimiento' },
          ...txBackFields(txs),
          ...businessRulesBackField(wallet.businessRules),
          ...campaignMessageBackField(data as unknown as Record<string, unknown>),
        ],
      },
    }
  }

  async buildAssets(wallet: Wallet, pass: Pass): Promise<Record<string, Buffer>> {
    return this.stripGenerator.generate(wallet, pass)
  }
}
