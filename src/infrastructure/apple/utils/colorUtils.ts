export function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgb(${r},${g},${b})`
}

export function hexLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16) / 255
  const g = parseInt(clean.substring(2, 4), 16) / 255
  const b = parseInt(clean.substring(4, 6), 16) / 255
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

export function contrastingColor(hex: string): string {
  return hexLuminance(hex) > 0.179 ? '#1A1A1A' : '#FFFFFF'
}

// Darkens a hex color by reducing each channel by `amount` (0–1).
function darkenHex(hex: string, amount: number): string {
  const clean = hex.replace('#', '')
  const r = Math.max(0, Math.round(parseInt(clean.substring(0, 2), 16) * (1 - amount)))
  const g = Math.max(0, Math.round(parseInt(clean.substring(2, 4), 16) * (1 - amount)))
  const b = Math.max(0, Math.round(parseInt(clean.substring(4, 6), 16) * (1 - amount)))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function whiteContrastRatio(hex: string): number {
  return 1.05 / (hexLuminance(hex) + 0.05)
}

/**
 * Returns `hex` darkened until white text on it meets WCAG AA (4.5:1 by default).
 * Pass types always use white foreground, so this guards against light brand colors.
 */
export function ensureWcagContrast(hex: string, minRatio = 4.5): string {
  let color = hex
  for (let i = 0; i < 20; i++) {
    if (whiteContrastRatio(color) >= minRatio) return color
    color = darkenHex(color, 0.07)
  }
  return color
}

/**
 * Returns the best icon color for elements drawn INSIDE a white-filled circle
 * (e.g. active stamp icons).
 *
 * Prefers the brand primary color when it has enough contrast on white (≥ 3:1);
 * falls back to near-black for very light or white brand colors so the icon
 * never becomes invisible.
 */
export function iconColorOnWhite(primaryColor: string): string {
  // contrast ratio of primaryColor placed ON white background
  const ratio = 1.05 / (hexLuminance(primaryColor) + 0.05)
  return ratio >= 3.0 ? primaryColor : '#1A1A1A'
}

/**
 * Generates a semantic color palette for SVG strip images whose background
 * is a gradient from `primaryColor`.
 *
 * Handles both light wallets (uses dark ink) and dark wallets (uses white ink),
 * so text and UI elements are always legible regardless of the brand color chosen.
 */
export function stripPalette(primaryColor: string) {
  const isLight = hexLuminance(primaryColor) > 0.179
  const rgb = isLight ? '26,26,26' : '255,255,255'
  return {
    /** Solid text color (titles, numbers). */
    text:        isLight ? '#1A1A1A' : '#FFFFFF',
    /** Labels y captions (80 % opacidad). */
    textMuted:   `rgba(${rgb},0.80)`,
    /** Etiquetas secundarias / dígitos auxiliares (50 % opacidad). */
    textFaint:   `rgba(${rgb},0.50)`,
    /** Track (fondo) de la barra de progreso. */
    barTrack:    `rgba(${rgb},0.25)`,
    /** Relleno de la barra de progreso. */
    barFill:     `rgba(${rgb},0.95)`,
    /** Overlay del contenedor interior (caja semi-transparente). */
    container:   `rgba(${rgb},0.12)`,
    /** Íconos de sellos inactivos (fantasma). */
    stampGhost:  `rgba(${rgb},0.30)`,
    /** Borde de sellos inactivos. */
    stampBorder: `rgba(${rgb},0.45)`,
  }
}
