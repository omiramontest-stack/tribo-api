import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { CashbackData } from '../../../domain/pass/entities/PassData.js'
import type { CashbackRules } from '../../../domain/wallet/entities/WalletRules.js'
import { buildBasePassJson, type PassBuilder } from './PassBuilder.js'
import { txBackFields, fullName, type RecentTransaction } from '../utils/passFieldUtils.js'

export class CashbackPassBuilder implements PassBuilder {
  buildJson(wallet: Wallet, pass: Pass, txs: RecentTransaction[]): object {
    const base  = buildBasePassJson(wallet, pass)
    const rules = wallet.rules as CashbackRules
    const data  = pass.data   as CashbackData

    // Formatea el saldo con la moneda explícita (e.g. "MXN 42.50")
    const balanceFormatted = `${rules.currency} ${data.balance.toFixed(2)}`
    const rateLabel        = `${rules.cashbackPercent}% por cada compra`

    return {
      ...base,
      storeCard: {
        // headerFields: porcentaje de cashback en la esquina superior derecha (junto al logo)
        headerFields: [
          { key: 'rate', label: 'CASHBACK', value: `${rules.cashbackPercent}%` },
        ],

        // Sin primaryFields → sin imagen de strip grande ni texto overlay gigante.
        // El balance pasa a secondaryFields para una tipografía más contenida.
        secondaryFields: [
          {
            key:   'balance',
            label: 'SALDO CASHBACK',
            value: balanceFormatted,
          },
          {
            key:   'holder',
            label: 'TITULAR',
            value: fullName(pass.firstName, pass.lastName),
          },
        ],

        auxiliaryFields: [
          { key: 'rule', label: 'BENEFICIO', value: rateLabel },
        ],

        backFields: [
          {
            key:   'info',
            label: 'Cómo funciona',
            value: `Acumulas ${rules.cashbackPercent}% de cashback en cada compra.`,
          },
          {
            key:   'balance_detail',
            label: 'Saldo actual',
            value: balanceFormatted,
          },
          ...txBackFields(txs),
        ],
      },
    }
  }

  // Sin strip/banner — el pass usa el backgroundColor del wallet directamente.
  // Apple Wallet aplica el color sólido como fondo; el diseño queda limpio y legible.
  async buildAssets(_wallet: Wallet, _pass: Pass): Promise<Record<string, Buffer>> {
    return {}
  }
}
