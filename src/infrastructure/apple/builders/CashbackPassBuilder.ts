import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { CashbackData } from '../../../domain/pass/entities/PassData.js'
import type { CashbackRules } from '../../../domain/wallet/entities/WalletRules.js'
import { buildBasePassJson, type PassBuilder } from './PassBuilder.js'
import { txBackFields, businessRulesBackField, fullName, formatDate, type RecentTransaction } from '../utils/passFieldUtils.js'

export class CashbackPassBuilder implements PassBuilder {
  buildJson(wallet: Wallet, pass: Pass, txs: RecentTransaction[]): object {
    const base  = buildBasePassJson(wallet, pass)
    const rules = wallet.rules as CashbackRules
    const data  = pass.data   as CashbackData

    const balanceFormatted = `${rules.currency} ${data.balance.toFixed(2)}`

    return {
      ...base,
      storeCard: {
        // header: porcentaje en la esquina superior derecha junto al logo
        headerFields: [
          { key: 'rate', label: 'CASHBACK', value: `${rules.cashbackPercent}%` },
        ],

        // primaryFields: Apple los renderiza con tipografía grande (~38pt).
        // Sin strip.png no hay imagen que los tape, por lo que se ven completos.
        primaryFields: [
          { key: 'balance', label: 'SALDO CASHBACK', value: balanceFormatted, changeMessage: 'Tu saldo cashback es de %@' },
        ],

        secondaryFields: [
          { key: 'holder',  label: 'TITULAR',         value: fullName(pass.firstName, pass.lastName) },
          { key: 'rule',    label: 'POR CADA COMPRA',  value: `${rules.cashbackPercent}% de regreso` },
          { key: 'expires', label: 'VENCIMIENTO',      value: data.expiresAt ? formatDate(data.expiresAt) : 'Sin vencimiento' },
        ],

        backFields: [
          { key: 'info',           label: 'Cómo funciona', value: `Acumulas ${rules.cashbackPercent}% de cashback en cada compra.` },
          { key: 'balance_detail', label: 'Saldo actual',  value: balanceFormatted },
          { key: 'expires_detail', label: 'Vencimiento',   value: data.expiresAt ? formatDate(data.expiresAt) : 'Sin vencimiento' },
          ...txBackFields(txs),
          ...businessRulesBackField(wallet.businessRules),
        ],
      },
    }
  }

  // Sin strip — el backgroundColor del wallet llena el fondo limpiamente.
  // Los primaryFields se renderizan sobre el color sólido, sin conflicto con imágenes.
  async buildAssets(_wallet: Wallet, _pass: Pass): Promise<Record<string, Buffer>> {
    return {}
  }
}
