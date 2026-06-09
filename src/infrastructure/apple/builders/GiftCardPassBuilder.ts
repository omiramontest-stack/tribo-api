import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { GiftCardData } from '../../../domain/pass/entities/PassData.js'
import type { GiftCardRules } from '../../../domain/wallet/entities/WalletRules.js'
import { buildBasePassJson, type PassBuilder } from './PassBuilder.js'
import { buildGradientStripSet } from '../assets/GradientStripGenerator.js'
import { txBackFields, businessRulesBackField, campaignMessageBackField, fullName, formatCurrency, formatDate, type RecentTransaction } from '../utils/passFieldUtils.js'

export class GiftCardPassBuilder implements PassBuilder {
  buildJson(wallet: Wallet, pass: Pass, txs: RecentTransaction[]): object {
    const base = buildBasePassJson(wallet, pass)
    const rules = wallet.rules as GiftCardRules
    const data = pass.data as GiftCardData

    return {
      ...base,
      storeCard: {
        headerFields: [
          { key: 'balance_label', label: 'SALDO', value: formatCurrency(data.currentBalance, rules.currency) },
        ],
        primaryFields: [
          { key: 'balance', label: 'Saldo disponible', value: formatCurrency(data.currentBalance, rules.currency), changeMessage: 'Tu saldo disponible es de %@' },
        ],
        secondaryFields: [
          { key: 'name',    label: 'Titular',      value: fullName(pass.firstName, pass.lastName) },
          { key: 'initial', label: 'Saldo inicial', value: formatCurrency(data.initialBalance, rules.currency) },
          { key: 'expires', label: 'VENCIMIENTO',   value: data.expiresAt ? formatDate(data.expiresAt) : 'Sin vencimiento' },
        ],
        backFields: [
          { key: 'info',           label: 'Cómo usar',  value: 'Presenta este código QR para redimir tu saldo.' },
          { key: 'expires_detail', label: 'Vencimiento', value: data.expiresAt ? formatDate(data.expiresAt) : 'Sin vencimiento' },
          ...txBackFields(txs),
          ...businessRulesBackField(wallet.businessRules),
          ...campaignMessageBackField(data as unknown as Record<string, unknown>),
        ],
      },
    }
  }

  async buildAssets(wallet: Wallet): Promise<Record<string, Buffer>> {
    return buildGradientStripSet(wallet.primaryColor, wallet.accentColor)
  }
}
