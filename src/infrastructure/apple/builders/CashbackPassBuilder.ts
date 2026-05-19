import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { CashbackData } from '../../../domain/pass/entities/PassData.js'
import type { CashbackRules } from '../../../domain/wallet/entities/WalletRules.js'
import { buildBasePassJson, type PassBuilder } from './PassBuilder.js'
import { buildGradientStripSet } from '../assets/GradientStripGenerator.js'
import { txBackFields, fullName, formatCurrency, type RecentTransaction } from '../utils/passFieldUtils.js'

export class CashbackPassBuilder implements PassBuilder {
  buildJson(wallet: Wallet, pass: Pass, txs: RecentTransaction[]): object {
    const base = buildBasePassJson(wallet, pass)
    const rules = wallet.rules as CashbackRules
    const data = pass.data as CashbackData

    return {
      ...base,
      storeCard: {
        headerFields: [
          { key: 'percent', label: 'Cashback', value: `${rules.cashbackPercent}%` },
        ],
        primaryFields: [
          { key: 'balance', label: 'SALDO CASHBACK', value: formatCurrency(data.balance, rules.currency) },
        ],
        secondaryFields: [
          { key: 'name', label: 'Titular', value: fullName(pass.firstName, pass.lastName) },
          { key: 'rate', label: 'Por cada compra', value: `${rules.cashbackPercent}% de regreso` },
        ],
        backFields: [
          { key: 'info', label: 'Cómo funciona', value: `Acumulas ${rules.cashbackPercent}% de cashback en cada compra.` },
          ...txBackFields(txs),
        ],
      },
    }
  }

  async buildAssets(wallet: Wallet): Promise<Record<string, Buffer>> {
    return buildGradientStripSet(wallet.primaryColor, wallet.accentColor)
  }
}
