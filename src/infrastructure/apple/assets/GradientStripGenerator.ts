import { svgToPng } from '../utils/imageUtils.js'
import { PassDesignConfig } from '../PassDesignConfig.js'
import type { StripGenerator, StripSet } from './StripGenerator.js'
import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'

const { width: W, height: H } = PassDesignConfig.strip

export class GradientStripGenerator implements StripGenerator {
  async generate(wallet: Wallet, _pass: Pass): Promise<StripSet> {
    const buf = renderGradientStrip(wallet.primaryColor, wallet.accentColor)
    return { 'strip.png': buf, 'strip@2x.png': buf, 'strip@3x.png': buf }
  }
}

function renderGradientStrip(primaryColor: string, accentColor: string): Buffer {
  // Diagonal gradient (primary top-left → accent bottom-right)
  // + radial overlay at top-right corner matching the HTML design reference
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${primaryColor}"/>
        <stop offset="100%" stop-color="${accentColor}"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#grad)"/>
    <circle cx="${W}" cy="0" r="${Math.round(H * 0.95)}" fill="${accentColor}" fill-opacity="0.5"/>
    <circle cx="0" cy="${H}" r="${Math.round(H * 0.65)}" fill="${accentColor}" fill-opacity="0.13"/>
  </svg>`
  return svgToPng(svg)
}

// Convenience wrapper kept for builders not yet using the StripGenerator interface.
export function buildGradientStripSet(primaryColor: string, accentColor: string): Record<string, Buffer> {
  const strip = renderGradientStrip(primaryColor, accentColor)
  return { 'strip.png': strip, 'strip@2x.png': strip, 'strip@3x.png': strip }
}
