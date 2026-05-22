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

// El header de Apple Wallet (logo + headerFields) cubre los primeros ~120px del strip.
// SAFE_TOP marca el límite inferior de esa zona opaca: nada visible arriba de aquí.
const SAFE_TOP = 120

// Contenedor interior semi-transparente (caja redondeada visual)
const CTR_X = 30
const CTR_Y = SAFE_TOP - 2               // 118 — empieza justo al borde del header
const CTR_W = W - CTR_X * 2             // 690
const CTR_H = H - CTR_Y - 8             // 162 — deja 8px de respiro abajo
const CTR_R = 16

// Barra de progreso (dentro del contenedor con padding lateral)
const BAR_PAD = 50
const BAR_X   = CTR_X + BAR_PAD         // 80
const BAR_W   = CTR_W - BAR_PAD * 2     // 590
const BAR_H   = 14
const BAR_R   = 7

/**
 * Layout vertical en zona segura (y=120 → y=288, 168px disponibles).
 * Diseño idéntico al screenshot de referencia, bajado ~78px para evitar
 * el overlay del header de Apple.
 *
 *  LABEL_CY    136  → "TUS PUNTOS"  (22px)   visual: 125–147
 *  NUMBER_CY   178  → número grande (60px)    visual: 153–203
 *  BAR_TOP     216  → barra         (14px)    visual: 216–230
 *  BAR_LABEL_Y 248  → "0" / max    (18px)    visual: 239–257
 *  CAPTION_CY  272  → caption       (20px)    visual: 262–282
 */
const LABEL_CY    = SAFE_TOP + 16        // 136
const NUMBER_CY   = SAFE_TOP + 58        // 178
const BAR_TOP     = SAFE_TOP + 96        // 216
const BAR_LABEL_Y = SAFE_TOP + 128       // 248
const CAPTION_CY  = SAFE_TOP + 152       // 272

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
  const palette       = stripPalette(primaryColor)
  const progressRatio = threshold > 0 ? Math.min(1, current / threshold) : 0
  const fillW         = Math.round(BAR_W * progressRatio)
  const remaining     = Math.max(0, threshold - current)

  const captionText = remaining > 0
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

    <!-- Fondo con gradiente de la marca -->
    <rect width="${W}" height="${H}" fill="url(#grad)"/>

    <!-- Contenedor interior (caja semi-transparente redondeada) -->
    <rect x="${CTR_X}" y="${CTR_Y}" width="${CTR_W}" height="${CTR_H}"
          rx="${CTR_R}" fill="${palette.container}"/>

    <!-- Etiqueta "TUS PUNTOS" centrada -->
    <text x="${W / 2}" y="${LABEL_CY}"
          text-anchor="middle" dominant-baseline="central"
          font-size="22" font-weight="600" letter-spacing="2"
          ${font} fill="${palette.textMuted}">TUS PUNTOS</text>

    <!-- Número grande de puntos (la estrella del strip) -->
    <text x="${W / 2}" y="${NUMBER_CY}"
          text-anchor="middle" dominant-baseline="central"
          font-size="68" font-weight="700"
          ${font} fill="${palette.text}">${current}</text>

    <!-- Barra de progreso: track -->
    <rect x="${BAR_X}" y="${BAR_TOP}" width="${BAR_W}" height="${BAR_H}"
          rx="${BAR_R}" fill="${palette.barTrack}"/>

    <!-- Barra de progreso: relleno -->
    ${fillRect}

    <!-- Etiquetas de mínimo y máximo bajo la barra -->
    <text x="${BAR_X}" y="${BAR_LABEL_Y}"
          dominant-baseline="central"
          font-size="18" font-weight="400"
          ${font} fill="${palette.textFaint}">0</text>
    <text x="${BAR_X + BAR_W}" y="${BAR_LABEL_Y}"
          text-anchor="end" dominant-baseline="central"
          font-size="18" font-weight="400"
          ${font} fill="${palette.textFaint}">${threshold}</text>

    <!-- Caption: "X puntos para: Recompensa" -->
    <text x="${W / 2}" y="${CAPTION_CY}"
          text-anchor="middle" dominant-baseline="central"
          font-size="20" font-weight="400"
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
