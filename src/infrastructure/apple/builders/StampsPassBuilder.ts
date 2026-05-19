import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { StampsData } from '../../../domain/pass/entities/PassData.js'
import type { StampsRules } from '../../../domain/wallet/entities/WalletRules.js'
import { buildBasePassJson, type PassBuilder } from './PassBuilder.js'
import { buildStampsStripSet } from '../assets/StampsStripGenerator.js'
import { txBackFields, fullName, type RecentTransaction } from '../utils/passFieldUtils.js'

export class StampsPassBuilder implements PassBuilder {
  buildJson(wallet: Wallet, pass: Pass, txs: RecentTransaction[]): object {
    const base = buildBasePassJson(wallet, pass)
    const rules = wallet.rules as StampsRules
    const data = pass.data as StampsData
    const remaining = rules.totalStamps - data.currentStamps

    return {
      ...base,
      storeCard: {
        headerFields: [
          { key: 'count', label: 'Sellos', value: `${data.currentStamps} / ${rules.totalStamps}` },
        ],
        secondaryFields: [
          { key: 'name', label: 'Titular', value: fullName(pass.firstName, pass.lastName) },
          { key: 'reward', label: 'Recompensa', value: rules.reward },
        ],
        auxiliaryFields: [
          { key: 'remaining', label: 'Faltan', value: `${remaining} sello${remaining !== 1 ? 's' : ''}` },
        ],
        backFields: [
          { key: 'info', label: '¿Cómo ganar sellos?', value: 'Gana un sello por cada visita o compra.' },
          { key: 'remaining', label: 'Sellos faltantes', value: String(remaining) },
          { key: 'reward', label: 'Recompensa', value: rules.reward },
          ...txBackFields(txs.slice(0, 1).map(tx => ({ label: 'Última actividad', value: tx.value }))),
        ],
      },
    }
  }

  async buildAssets(wallet: Wallet, pass: Pass): Promise<Record<string, Buffer>> {
    const data = pass.data as StampsData
    const rules = wallet.rules as StampsRules
    return buildStampsStripSet(data.currentStamps, rules.totalStamps, wallet.primaryColor, wallet.accentColor, rules.stampIcon)
  }
}
