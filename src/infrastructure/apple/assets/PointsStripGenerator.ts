import { svgToPng } from '../utils/imageUtils.js'
import { PassDesignConfig } from '../PassDesignConfig.js'
import type { StripGenerator, StripSet } from './StripGenerator.js'
import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { PointsData } from '../../../domain/pass/entities/PassData.js'
import type { PointsRules } from '../../../domain/wallet/entities/WalletRules.js'

// Strip canvas @2x  (= 375 × 144 pt en Apple Wallet)
const W = PassDesignConfig.strip.width    // 750
const H = PassDesignConfig.strip.height   // 288

// El número de puntos y la etiqueta "PUNTOS" los renderiza Apple
// a través de primaryFields (tipografía grande, posición fija).
// Este SVG solo aporta:
//   1. Gradiente de fondo de la marca
//   2. Barra de progreso en la zona baja (no interfiere con Apple)

// Barra de progreso — ubicada en la zona baja del strip
// Apple renderiza primaryFields en ~y=88–200px; la barra va desde y=215.
const BAR_H   = 16
const BAR_R   = 8
const BAR_PAD = 30
const BAR_X   = BAR_PAD                 // 30
const BAR_W   = W - BAR_PAD * 2         // 690
const BAR_TOP = 215
const LBL_Y   = 255

// Background blurred @3x  (Apple la oscurece/difumina)
const BG_W = 540
const BG_H = 660

export class PointsStripGenerator implements StripGenerator {
  async generate(wallet: Wallet, pass: Pass): Promise<StripSet> {
    const data  = pass.data   as PointsData
    const rules = wallet.rules as PointsRules

    const strip = buildPointsStrip(
      data.currentPoints,
      rules.rewardThreshold,
      wallet.primaryColor,
      wallet.accentColor,
    )
    const bg = renderBackground(wallet.primaryColor, wallet.accentColor)

    return {
      'strip.png':         strip,
      'strip@2x.png':      strip,
      'strip@3x.png':      strip,
      'background.png':    bg,
      'background@2x.png': bg,
      'background@3x.png': bg,
    }
  }
}

// ─── SVG builders ─────────────────────────────────────────────────────────

function buildPointsStrip(
  current: number,
  threshold: number,
  primaryColor: string,
  accentColor: string,
): Buffer {
  const progressRatio = threshold > 0 ? Math.min(1, current / threshold) : 0
  const fillW         = Math.round(BAR_W * progressRatio)

  const barTrack      = 'rgba(255,255,255,0.25)'
  const barFill       = 'rgba(255,255,255,0.92)'
  const labelColor    = 'rgba(255,255,255,0.60)'

  const fillRect = fillW > 0
    ? `<rect x="${BAR_X}" y="${BAR_TOP}" width="${fillW}" height="${BAR_H}"
             rx="${BAR_R}" fill="${barFill}"/>`
    : ''

  const ff = `font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif"`

  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stop-color="${primaryColor}"/>
        <stop offset="100%" stop-color="${accentColor}"/>
      </linearGradient>
    </defs>

    <!-- Fondo gradiente de la marca -->
    <rect width="${W}" height="${H}" fill="url(#grad)"/>

    <!-- Barra de progreso: track -->
    <rect x="${BAR_X}" y="${BAR_TOP}" width="${BAR_W}" height="${BAR_H}"
          rx="${BAR_R}" fill="${barTrack}"/>

    <!-- Barra de progreso: relleno -->
    ${fillRect}

    <!-- Etiquetas 0 / max bajo la barra -->
    <text
      x="${BAR_X}" y="${LBL_Y}"
      dominant-baseline="central"
      font-size="20" font-weight="500"
      ${ff}
      fill="${labelColor}">0</text>
    <text
      x="${BAR_X + BAR_W}" y="${LBL_Y}"
      text-anchor="end"
      dominant-baseline="central"
      font-size="20" font-weight="500"
      ${ff}
      fill="${labelColor}">${threshold}</text>
  </svg>`)
}

function renderBackground(primaryColor: string, accentColor: string): Buffer {
  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${BG_W}" height="${BG_H}">
    <defs>
      <radialGradient id="main-bloom" cx="100%" cy="0%" r="100%" gradientUnits="objectBoundingBox">
        <stop offset="0%"   stop-color="${accentColor}" stop-opacity="0.9"/>
        <stop offset="55%"  stop-color="${accentColor}" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="${accentColor}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="warm-bloom" cx="0%" cy="100%" r="65%" gradientUnits="objectBoundingBox">
        <stop offset="0%"   stop-color="${accentColor}" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="${accentColor}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${BG_W}" height="${BG_H}" fill="${primaryColor}"/>
    <rect width="${BG_W}" height="${BG_H}" fill="url(#main-bloom)"/>
    <rect width="${BG_W}" height="${BG_H}" fill="url(#warm-bloom)"/>
  </svg>`)
}
