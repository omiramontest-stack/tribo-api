import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { CashbackData } from '../../../domain/pass/entities/PassData.js'
import type { CashbackRules } from '../../../domain/wallet/entities/WalletRules.js'
import { buildBasePassJson, type PassBuilder } from './PassBuilder.js'
import type { StripGenerator } from '../assets/StripGenerator.js'
import { txBackFields, fullName, type RecentTransaction } from '../utils/passFieldUtils.js'

export class CashbackPassBuilder implements PassBuilder {
  constructor(private readonly stripGenerator: StripGenerator) {}

  buildJson(wallet: Wallet, pass: Pass, txs: RecentTransaction[]): object {
    const base = buildBasePassJson(wallet, pass)
    const rules = wallet.rules as CashbackRules
    const data = pass.data as CashbackData

    return {
      ...base,
      storeCard: {
        // headerFields: porcentaje de cashback en la esquina superior derecha
        headerFields: [
          { key: 'rate', label: 'CASHBACK', value: `${rules.cashbackPercent}%` },
        ],
        // primaryFields: se renderizan sobre el strip (gradiente limpio) — es intencional.
        // El saldo grande sobre gradiente replica el diseño del frontend.
        primaryFields: [
          // currencyCode permite a Apple Wallet formatear con el símbolo de moneda correcto
          { key: 'balance', label: 'SALDO CASHBACK', value: data.balance, currencyCode: rules.currency },
        ],
        secondaryFields: [
          { key: 'holder', label: 'TITULAR', value: fullName(pass.firstName, pass.lastName) },
          { key: 'rule', label: 'POR COMPRA', value: `${rules.cashbackPercent}% de regreso` },
        ],
        backFields: [
          { key: 'info', label: 'Cómo funciona', value: `Acumulas ${rules.cashbackPercent}% de cashback en cada compra.` },
          { key: 'balance_detail', label: 'Saldo actual', value: `${rules.currency} ${data.balance.toFixed(2)}` },
          ...txBackFields(txs),
        ],
      },
    }
  }

  async buildAssets(wallet: Wallet, pass: Pass): Promise<Record<string, Buffer>> {
    return this.stripGenerator.generate(wallet, pass)
  }
}
