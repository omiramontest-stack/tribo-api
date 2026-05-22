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

// ─── Zonas del storeCard ───────────────────────────────────────────────────
// Apple Wallet renderiza en storeCard con strip.png:
//   y =   0 –  88px → logo (top-left) + headerFields (top-right) — solapan nuestro SVG
//   y =  88 – 288px → zona libre — nuestro contenido aquí
//
// Dibujamos TODA la UI en el SVG: recuadro, etiqueta "PUNTOS", número grande,
// barra de progreso y etiquetas 0/threshold.
//
// NO usamos primaryFields en el JSON del pass:
//   - Apple no respeta textAlignment en primaryFields de storeCard.
//   - El control total de posición y centrado solo es posible en el SVG.
//
// IMPORTANTE: resvg requiere dominant-baseline="central", NO "middle".
// (ver StampsStripGenerator: "better than middle for resvg's text layout engine")
// ─────────────────────────────────────────────────────────────────────────────

// Recuadro contenedor (empieza justo debajo del header/logo de Apple)
const CTR_X = 30
const CTR_Y = 92              // ~4px de margen tras el área del logo (~88px)
const CTR_W = W - CTR_X * 2  // 690
const CTR_H = 182             // 92 + 182 = 274 (14px al pie del strip)
const CTR_R = 14

// Elementos centrados en x = W/2 = 375
const LABEL_Y  = 122   // centro de la etiqueta "PUNTOS"  (font-size 22)
const NUMBER_Y = 180   // centro del número grande         (font-size 72)

// Barra de progreso
const BAR_PAD = 28
const BAR_X   = CTR_X + BAR_PAD        // 58
const BAR_W   = CTR_W - BAR_PAD * 2    // 634
const BAR_H   = 14
const BAR_R   = 7
const BAR_TOP = 226   // 10px debajo del borde inferior del número
const LBL_Y   = 250   // centro de las etiquetas "0" y threshold

// Background blurred @3x  (Apple la difumina sobre el resto del card)
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

  // Siempre blanco: ensureWcagContrast garantiza que primaryColor es oscuro
  // (ratio ≥ 4.5:1), por lo que el blanco siempre es legible.
  const white           = '#FFFFFF'
  const containerFill   = 'rgba(255,255,255,0.15)'
  const containerStroke = 'rgba(255,255,255,0.35)'
  const labelColor      = 'rgba(255,255,255,0.70)'
  const barTrack        = 'rgba(255,255,255,0.25)'
  const barFill         = 'rgba(255,255,255,0.92)'
  const barLabelColor   = 'rgba(255,255,255,0.55)'

  const fillRect = fillW > 0
    ? `<rect x="${BAR_X}" y="${BAR_TOP}" width="${fillW}" height="${BAR_H}"
             rx="${BAR_R}" fill="${barFill}"/>`
    : ''

  // BlinkMacSystemFont incluido para garantizar carga en macOS/iOS
  const ff = `font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif"`
  const cx = W / 2   // 375 — centro horizontal del strip

  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stop-color="${primaryColor}"/>
        <stop offset="100%" stop-color="${accentColor}"/>
      </linearGradient>
    </defs>

    <!-- Fondo gradiente de la marca -->
    <rect width="${W}" height="${H}" fill="url(#grad)"/>

    <!-- Recuadro con borde sutil que delimita el área de puntos -->
    <rect x="${CTR_X}" y="${CTR_Y}" width="${CTR_W}" height="${CTR_H}"
          rx="${CTR_R}" fill="${containerFill}"
          stroke="${containerStroke}" stroke-width="1.5"/>

    <!-- Etiqueta "PUNTOS" centrada dentro del recuadro -->
    <text
      x="${cx}" y="${LABEL_Y}"
      text-anchor="middle"
      dominant-baseline="central"
      font-size="22"
      font-weight="600"
      ${ff}
      fill="${labelColor}">PUNTOS</text>

    <!-- Número grande centrado — protagonista visual del pass -->
    <text
      x="${cx}" y="${NUMBER_Y}"
      text-anchor="middle"
      dominant-baseline="central"
      font-size="72"
      font-weight="700"
      ${ff}
      fill="${white}">${current}</text>

    <!-- Barra de progreso: track -->
    <rect x="${BAR_X}" y="${BAR_TOP}" width="${BAR_W}" height="${BAR_H}"
          rx="${BAR_R}" fill="${barTrack}"/>

    <!-- Barra de progreso: relleno dinámico -->
    ${fillRect}

    <!-- Etiquetas 0 / threshold bajo la barra -->
    <text
      x="${BAR_X}" y="${LBL_Y}"
      dominant-baseline="central"
      font-size="18"
      font-weight="500"
      ${ff}
      fill="${barLabelColor}">0</text>
    <text
      x="${BAR_X + BAR_W}" y="${LBL_Y}"
      text-anchor="end"
      dominant-baseline="central"
      font-size="18"
      font-weight="500"
      ${ff}
      fill="${barLabelColor}">${threshold}</text>
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
