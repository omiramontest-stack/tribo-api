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
// Apple Wallet renderiza así en storeCard con strip:
//   y =   0 – ~88px  → header overlay (logo + headerFields)    — nuestro SVG queda oculto
//   y =  88 – ~220px → primaryFields text (Apple lo renderiza) — nuestro SVG es solo fondo
//   y = 220 – 288px  → zona libre: aquí vive nuestra barra     — VISIBLE y no conflicta
//
// El número de puntos viaja en primaryFields → Apple lo dibuja grande sobre el strip.
// Nosotros solo ponemos el gradiente de fondo + la barra en la zona libre de abajo.
// ─────────────────────────────────────────────────────────────────────────────

// Recuadro semi-transparente — empieza justo después del header (logo) de Apple,
// envuelve visualmente tanto el "1" que Apple renderiza como la barra.
// El header/logo ocupa ~88px; el recuadro arranca ahí para que "1" quede DENTRO.
const CTR_X = 30
const CTR_Y = 88
const CTR_W = W - CTR_X * 2           // 690
const CTR_H = 186                      // 88+186 = 274 (deja 14px de respiro al pie)
const CTR_R = 16

// Barra dentro del recuadro — posicionada por DEBAJO de donde Apple pinta el "1"
// (Apple renderiza primaryFields en aprox. y=100–190; barra va desde y=206)
const BAR_PAD = 28
const BAR_X   = CTR_X + BAR_PAD       // 58
const BAR_W   = CTR_W - BAR_PAD * 2   // 634
const BAR_H   = 16
const BAR_R   = 8
const BAR_TOP = CTR_Y + 118           // 206 — debajo del "1" renderizado por Apple
const LBL_Y   = CTR_Y + 152           // 240 — etiquetas "0" y threshold

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

  // Siempre blanco: ensureWcagContrast garantiza que primaryColor es suficientemente
  // oscuro (ratio ≥ 4.5:1) para que el texto blanco sea legible.
  const white      = '#FFFFFF'
  const barTrack   = 'rgba(255,255,255,0.25)'
  const barFill    = 'rgba(255,255,255,0.92)'
  const labelColor = 'rgba(255,255,255,0.60)'

  const fillRect = fillW > 0
    ? `<rect x="${BAR_X}" y="${BAR_TOP}" width="${fillW}" height="${BAR_H}"
             rx="${BAR_R}" fill="${barFill}"/>`
    : ''

  const font = `font-family="system-ui,-apple-system,sans-serif"`

  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stop-color="${primaryColor}"/>
        <stop offset="100%" stop-color="${accentColor}"/>
      </linearGradient>
    </defs>

    <!-- Fondo gradiente de la marca -->
    <rect width="${W}" height="${H}" fill="url(#grad)"/>

    <!-- Recuadro semi-transparente — por debajo del "1" que Apple renderiza arriba -->
    <rect x="${CTR_X}" y="${CTR_Y}" width="${CTR_W}" height="${CTR_H}"
          rx="${CTR_R}" fill="rgba(255,255,255,0.15)"/>

    <!-- Barra de progreso: track -->
    <rect x="${BAR_X}" y="${BAR_TOP}" width="${BAR_W}" height="${BAR_H}"
          rx="${BAR_R}" fill="${barTrack}"/>

    <!-- Barra de progreso: relleno -->
    ${fillRect}

    <!-- Etiquetas 0 / max bajo la barra -->
    <text x="${BAR_X}" y="${LBL_Y}"
          dominant-baseline="central" font-size="20" font-weight="500"
          ${font} fill="${labelColor}">0</text>
    <text x="${BAR_X + BAR_W}" y="${LBL_Y}"
          text-anchor="end" dominant-baseline="central"
          font-size="20" font-weight="500"
          ${font} fill="${labelColor}">${threshold}</text>
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
