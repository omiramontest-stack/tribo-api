import type { WalletThemeOverrides } from '../../../domain/wallet/entities/WalletTheme.js'
import { customTextContrastViolations, MIN_TEXT_CONTRAST } from '../../../domain/wallet/entities/WalletTheme.js'
import { AppError } from '../../common/AppError.js'

/**
 * Rechaza un theme cuyos colores de texto personalizados no alcanzan el contraste
 * mínimo WCAG AA sobre el fondo — evita que un negocio genere pases ilegibles.
 */
export function assertThemeContrast(
  overrides: WalletThemeOverrides | null | undefined,
  fallbackBackground: string,
): void {
  const violations = customTextContrastViolations(overrides ?? null, fallbackBackground)
  if (violations.length === 0) return

  const detail = violations.map(v => `${v.field} (${v.ratio}:1)`).join(', ')
  throw new AppError(
    'LOW_CONTRAST',
    `Text color contrast below WCAG AA (min ${MIN_TEXT_CONTRAST}:1): ${detail}`,
    400,
  )
}
