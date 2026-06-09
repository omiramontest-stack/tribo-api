import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { StampsData } from '../../../domain/pass/entities/PassData.js'
import type { StampsRules } from '../../../domain/wallet/entities/WalletRules.js'
import { buildBasePassJson, type PassBuilder } from './PassBuilder.js'
import type { StripGenerator } from '../assets/StripGenerator.js'
import { txBackFields, businessRulesBackField, campaignMessageBackField, fullName, formatDate, type RecentTransaction } from '../utils/passFieldUtils.js'

export class StampsPassBuilder implements PassBuilder {
  constructor(private readonly stripGenerator: StripGenerator) {}

  buildJson(wallet: Wallet, pass: Pass, txs: RecentTransaction[]): object {
    const base = buildBasePassJson(wallet, pass)
    const rules = wallet.rules as StampsRules
    const data = pass.data as StampsData
    const remaining = rules.totalStamps - data.currentStamps

    return {
      ...base,
      storeCard: {
        // headerFields: VENCIMIENTO a la derecha del logo en el header
        // Layout: [logo] → [VENCIMIENTO]
        headerFields: [
          { key: 'expires', label: 'VENCIMIENTO', value: data.expiresAt ? formatDate(data.expiresAt) : 'Sin vencimiento' },
        ],
        // Sin primaryFields: en storeCard se renderizan ENCIMA del strip.png,
        // lo que tapaba los círculos de sellos. Toda la info visual va en el strip.
        //
        // secondaryFields: fila inferior → [NOMBRE] [RECOMPENSA]
        secondaryFields: [
          { key: 'holder', label: 'NOMBRE', value: fullName(pass.firstName, pass.lastName) },
          { key: 'reward', label: 'RECOMPENSA', value: rules.reward },
        ],
        auxiliaryFields: [],
        backFields: [
          { key: 'info', label: '¿Cómo ganar sellos?', value: 'Gana un sello por cada visita o compra.' },
          { key: 'progress', label: 'Progreso', value: `${data.currentStamps} de ${rules.totalStamps}`, changeMessage: 'Nuevo sello registrado. Llevas %@' },
          { key: 'remaining', label: 'Sellos faltantes', value: String(remaining) },
          { key: 'reward_detail', label: 'Recompensa', value: rules.reward },
          { key: 'expires_detail', label: 'Vencimiento', value: data.expiresAt ? formatDate(data.expiresAt) : 'Sin vencimiento' },
          ...txBackFields(txs.slice(0, 1).map(tx => ({ label: 'Última actividad', value: tx.value }))),
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
