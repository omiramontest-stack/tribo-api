import { svgToPng } from '../utils/imageUtils.js'
import { stripPalette } from '../utils/colorUtils.js'
import { PassDesignConfig } from '../PassDesignConfig.js'
import type { StripGenerator, StripSet } from './StripGenerator.js'
import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { PointsData } from '../../../domain/pass/entities/PassData.js'
import type { PointsRules } from '../../../domain/wallet/entities/WalletRules.js'

// Strip canvas @2x  (= 375 × 144 pt en Apple Wallet)
const W = PassDesignConfig.strip.width    // 750
const H = PassDesignConfig.strip.height   // 288

// Contenedor interior semi-transparente
const CTR_X = 40
const CTR_Y = 24
const CTR_W = W - CTR_X * 2              // 670
const CTR_H = H - CTR_Y * 2              // 240
const CTR_R = 20

// Barra de progreso (márgenes horizontales dentro del contenedor)
const BAR_PAD = 40                        // padding lateral de la barra
const BAR_X   = CTR_X + BAR_PAD          // 80
const BAR_W   = CTR_W - BAR_PAD * 2      // 590
const BAR_H   = 12
const BAR_R   = 6

/**
 * Posiciones verticales del layout (centros de cada elemento).
 *
 * Verificación anti-solapamiento:
 *   - Label  24px → rango y ≈ [56, 80]
 *   - Número 68px → rango y ≈ [108, 176]    (centro 142)
 *   - Barra  12px → rango y ≈ [192, 204]     (top 192)
 *   - Caption22px → rango y ≈ [229, 251]     (centro 240)
 *   - Contenedor bottom = CTR_Y + CTR_H = 264
 *   Todo dentro de 264 ✓, sin solapamientos ✓
 */
const LABEL_CY   = CTR_Y + 44            // 68  — etiqueta "TUS PUNTOS"
const NUMBER_CY  = CTR_Y + 118           // 142 — número grande
const BAR_TOP    = CTR_Y + 168           // 192 — inicio de la barra
const CAPTION_CY = CTR_Y + 216          // 240 — texto de puntos restantes

// Background blurred @3x  (Apple la oscurece/difumina)
const BG_W = 540
const BG_H = 660

export class PointsStripGenerator implements StripGenerator {
  async generate(wallet: Wallet, pass: Pass): Promise<StripSet> {
    const data  = pass.data  as PointsData
    const rules = wallet.rules as PointsRules

    const strip = buildPointsStrip(
      data.currentPoints,
      rules.rewardThreshold,
      rules.reward,
      rules.pointsLabel,
      wallet.primaryColor,
      wallet.accentColor,
    )
    const bg = renderBackground(wallet.primaryColor, wallet.accentColor)

    return {
      'strip.png':        strip,
      'strip@2x.png':     strip,
      'strip@3x.png':     strip,
      'background.png':   bg,
      'background@2x.png': bg,
      'background@3x.png': bg,
    }
  }
}

// ---------------------------------------------------------------------------
// SVG builders
// ---------------------------------------------------------------------------

function buildPointsStrip(
  current: number,
  threshold: number,
  reward: string,
  pointsLabel: string,
  primaryColor: string,
  accentColor: string,
): Buffer {
  const palette      = stripPalette(primaryColor)
  const progressRatio = threshold > 0 ? Math.min(1, current / threshold) : 0
  const fillW        = Math.round(BAR_W * progressRatio)
  const remaining    = Math.max(0, threshold - current)

  const captionLabel = pointsLabel.toUpperCase()
  const captionText  = remaining > 0
    ? `${remaining} ${pointsLabel} para: ${reward}`
    : '¡Listo para canjear!'

  const fillRect = fillW > 0
    ? `<rect x="${BAR_X}" y="${BAR_TOP}" width="${fillW}" height="${BAR_H}" rx="${BAR_R}" fill="${palette.barFill}"/>`
    : ''

  const font = `font-family="system-ui,-apple-system,sans-serif"`

  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stop-color="${primaryColor}"/>
        <stop offset="100%" stop-color="${accentColor}"/>
      </linearGradient>
    </defs>

    <!-- Fondo con gradiente -->
    <rect width="${W}" height="${H}" fill="url(#grad)"/>

    <!-- Contenedor interior -->
    <rect x="${CTR_X}" y="${CTR_Y}" width="${CTR_W}" height="${CTR_H}"
          rx="${CTR_R}" fill="${palette.container}"/>

    <!-- Etiqueta: "TUS PUNTOS" -->
    <text x="${W / 2}" y="${LABEL_CY}"
          text-anchor="middle" dominant-baseline="central"
          font-size="24" font-weight="600" letter-spacing="1.5"
          ${font} fill="${palette.textMuted}">${captionLabel}</text>

    <!-- Número grande de puntos -->
    <text x="${W / 2}" y="${NUMBER_CY}"
          text-anchor="middle" dominant-baseline="central"
          font-size="68" font-weight="700"
          ${font} fill="${palette.text}">${current}</text>

    <!-- Barra de progreso: track -->
    <rect x="${BAR_X}" y="${BAR_TOP}" width="${BAR_W}" height="${BAR_H}"
          rx="${BAR_R}" fill="${palette.barTrack}"/>

    <!-- Barra de progreso: relleno -->
    ${fillRect}

    <!-- Texto de puntos restantes -->
    <text x="${W / 2}" y="${CAPTION_CY}"
          text-anchor="middle" dominant-baseline="central"
          font-size="22" font-weight="400"
          ${font} fill="${palette.textMuted}">${captionText}</text>
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
