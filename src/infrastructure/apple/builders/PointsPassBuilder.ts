import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { PointsData } from '../../../domain/pass/entities/PassData.js'
import type { PointsRules } from '../../../domain/wallet/entities/WalletRules.js'
import { buildBasePassJson, type PassBuilder } from './PassBuilder.js'
import type { StripGenerator } from '../assets/StripGenerator.js'
import { txBackFields, fullName, type RecentTransaction } from '../utils/passFieldUtils.js'

export class PointsPassBuilder implements PassBuilder {
  constructor(private readonly stripGenerator: StripGenerator) {}

  buildJson(wallet: Wallet, pass: Pass, txs: RecentTransaction[]): object {
    const base      = buildBasePassJson(wallet, pass)
    const rules     = wallet.rules as PointsRules
    const data      = pass.data   as PointsData
    const remaining = Math.max(0, rules.rewardThreshold - data.currentPoints)

    return {
      ...base,
      storeCard: {
        // headerFields: esquina superior derecha junto al logo.
        // Muestra la meta de recompensa para dar contexto visual inmediato.
        headerFields: [
          { key: 'meta', label: 'META', value: `${rules.rewardThreshold} pts` },
        ],

        // primaryFields: Apple los renderiza en tipografía grande directamente
        // sobre el strip.png — siempre visibles, nunca tapados por el header.
        // Reemplaza al número grande que antes estábamos intentando dibujar en el SVG.
        primaryFields: [
          { key: 'pts', label: 'PUNTOS', value: String(data.currentPoints), textAlignment: 'PKTextAlignmentCenter' },
        ],

        // El strip.png muestra solo el gradiente + barra de progreso en la zona baja.
        // No necesita mostrar el número; Apple ya lo renderiza en primaryFields.

        secondaryFields: [
          { key: 'holder', label: 'NOMBRE',           value: fullName(pass.firstName, pass.lastName) },
          {
            key:   'next',
            label: 'PUNTOS FALTANTES',
            value: remaining > 0 ? `${remaining} puntos` : '¡Listo para canjear!',
          },
        ],

        backFields: [
          { key: 'threshold', label: `${rules.pointsLabel} necesarios`,  value: String(rules.rewardThreshold) },
          { key: 'current',   label: `${rules.pointsLabel} acumulados`,  value: String(data.currentPoints) },
          { key: 'remaining', label: `${rules.pointsLabel} restantes`,   value: String(remaining) },
          { key: 'reward',    label: 'Recompensa',                        value: rules.reward },
          ...txBackFields(txs),
        ],
      },
    }
  }

  async buildAssets(wallet: Wallet, pass: Pass): Promise<Record<string, Buffer>> {
    return this.stripGenerator.generate(wallet, pass)
  }
}
