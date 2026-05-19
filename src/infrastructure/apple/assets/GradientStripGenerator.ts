import { svgToPng } from '../utils/imageUtils.js'

const STRIP_W = 750
const STRIP_H = 246

/**
 * Generates a gradient strip image (primary → accent, 45°) with subtle decorative circles.
 * Used as fallback visual for wallets without a specific image strip.
 */
export function buildGradientStrip(primaryColor: string, accentColor: string): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${STRIP_W}" height="${STRIP_H}">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${primaryColor}"/>
        <stop offset="100%" stop-color="${accentColor}"/>
      </linearGradient>
    </defs>
    <rect width="${STRIP_W}" height="${STRIP_H}" fill="url(#grad)"/>
    <circle cx="80"           cy="80"         r="150" fill="rgba(255,255,255,0.05)"/>
    <circle cx="${STRIP_W - 60}" cy="${STRIP_H}"   r="120" fill="rgba(255,255,255,0.05)"/>
    <circle cx="${STRIP_W / 2}"  cy="${STRIP_H / 2}" r="80"  fill="rgba(255,255,255,0.03)"/>
  </svg>`
  return svgToPng(svg)
}

export function buildGradientStripSet(primaryColor: string, accentColor: string): Record<string, Buffer> {
  const strip = buildGradientStrip(primaryColor, accentColor)
  return {
    'strip.png': strip,
    'strip@2x.png': strip,
    'strip@3x.png': strip,
  }
}
