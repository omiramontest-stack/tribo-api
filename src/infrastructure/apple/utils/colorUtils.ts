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
