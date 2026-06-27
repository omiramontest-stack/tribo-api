/**
 * Utilidades de contraste WCAG en el dominio — sin dependencias de infraestructura,
 * para poder validar la legibilidad de un theme en los casos de uso.
 */

/** Luminancia relativa (WCAG) de un color hex `#RRGGBB`. */
export function hexLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  const channel = (start: number) => parseInt(clean.substring(start, start + 2), 16) / 255
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * toLinear(channel(0)) + 0.7152 * toLinear(channel(2)) + 0.0722 * toLinear(channel(4))
}

/** Ratio de contraste WCAG entre dos colores (1:1 … 21:1). */
export function contrastRatio(a: string, b: string): number {
  const la = hexLuminance(a)
  const lb = hexLuminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}
