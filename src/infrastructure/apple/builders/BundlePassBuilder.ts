import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { BundleData } from '../../../domain/pass/entities/PassData.js'
import type { BundleRules } from '../../../domain/wallet/entities/WalletRules.js'
import { buildBasePassJson, type PassBuilder } from './PassBuilder.js'
import { buildGradientStripSet } from '../assets/GradientStripGenerator.js'
import { fullName } from '../utils/passFieldUtils.js'

export class BundlePassBuilder implements PassBuilder {
  buildJson(wallet: Wallet, pass: Pass): object {
    const base = buildBasePassJson(wallet, pass)
    const rules = wallet.rules as BundleRules
    const data = pass.data as BundleData
    const used = rules.totalUses - data.remainingUses

    return {
      ...base,
      storeCard: {
        headerFields: [
          { key: 'remaining', label: rules.label.toUpperCase(), value: String(data.remainingUses) },
        ],
        primaryFields: [
          { key: 'of', label: 'De un total de', value: `${rules.totalUses} ${rules.label}` },
        ],
        secondaryFields: [
          { key: 'name', label: 'Titular', value: fullName(pass.firstName, pass.lastName) },
          { key: 'used', label: 'Utilizados', value: String(used) },
        ],
        backFields: [
          { key: 'info', label: 'Cómo usar', value: `Presenta este código QR para consumir uno de tus ${rules.label}.` },
          { key: 'total', label: 'Total original', value: `${rules.totalUses} ${rules.label}` },
          { key: 'used_detail', label: 'Ya utilizados', value: String(used) },
        ],
      },
    }
  }

  async buildAssets(wallet: Wallet): Promise<Record<string, Buffer>> {
    return buildGradientStripSet(wallet.primaryColor, wallet.accentColor)
  }
}
