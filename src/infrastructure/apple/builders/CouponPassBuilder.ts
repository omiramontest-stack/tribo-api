import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { CouponData } from '../../../domain/pass/entities/PassData.js'
import type { CouponRules } from '../../../domain/wallet/entities/WalletRules.js'
import { buildBasePassJson, type PassBuilder } from './PassBuilder.js'
import { buildGradientStripSet } from '../assets/GradientStripGenerator.js'
import { fullName, formatDate } from '../utils/passFieldUtils.js'

export class CouponPassBuilder implements PassBuilder {
  buildJson(wallet: Wallet, pass: Pass): object {
    const base = buildBasePassJson(wallet, pass)
    const rules = wallet.rules as CouponRules
    const data = pass.data as CouponData

    const discountValue = rules.discountType === 'percent'
      ? `${rules.discount}% OFF`
      : `${rules.currency ?? ''} ${rules.discount} de descuento`.trim()

    const statusValue = data.used ? 'Utilizado' : 'Disponible'

    return {
      ...base,
      coupon: {
        primaryFields: [
          { key: 'discount', label: 'Descuento', value: discountValue },
        ],
        secondaryFields: [
          { key: 'name', label: 'Titular', value: fullName(pass.firstName, pass.lastName) },
          { key: 'status', label: 'Estado', value: statusValue },
        ],
        auxiliaryFields: [
          {
            key: 'expires',
            label: 'Vigencia',
            value: data.expiresAt ? `Hasta el ${formatDate(data.expiresAt)}` : 'Sin vencimiento',
          },
        ],
        backFields: [
          {
            key: 'expires_detail',
            label: 'Fecha de vencimiento',
            value: data.expiresAt ? formatDate(data.expiresAt) : 'Sin vencimiento',
          },
          { key: 'info', label: 'Cómo usar', value: 'Presenta este código QR al momento del pago.' },
        ],
      },
    }
  }

  async buildAssets(wallet: Wallet): Promise<Record<string, Buffer>> {
    return buildGradientStripSet(wallet.primaryColor, wallet.accentColor)
  }
}
