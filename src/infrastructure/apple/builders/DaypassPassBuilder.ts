import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { DaypassRules } from '../../../domain/wallet/entities/WalletRules.js'
import { buildBasePassJson, type PassBuilder } from './PassBuilder.js'
import { buildDaypassStripSet } from '../assets/DaypassStripGenerator.js'
import { fullName, formatLongDate } from '../utils/passFieldUtils.js'

export class DaypassPassBuilder implements PassBuilder {
  buildJson(wallet: Wallet, pass: Pass): object {
    const base = buildBasePassJson(wallet, pass)
    const rules = wallet.rules as DaypassRules

    return {
      ...base,
      eventTicket: {
        primaryFields: [
          { key: 'event', label: 'Evento', value: rules.eventName },
        ],
        secondaryFields: [
          { key: 'name', label: 'Asistente', value: fullName(pass.firstName, pass.lastName) },
          { key: 'venue', label: 'Lugar', value: rules.venue },
        ],
        auxiliaryFields: [
          { key: 'date', label: 'Fecha', value: formatLongDate(rules.eventDate) },
        ],
        backFields: [
          { key: 'info', label: 'Acceso', value: 'Pase de un solo uso. Presenta este código QR en la entrada.' },
          { key: 'venue_detail', label: 'Sede', value: rules.venue },
        ],
      },
    }
  }

  async buildAssets(wallet: Wallet): Promise<Record<string, Buffer>> {
    const rules = wallet.rules as DaypassRules
    return buildDaypassStripSet(rules.imageUrl, wallet.primaryColor, wallet.accentColor)
  }
}
