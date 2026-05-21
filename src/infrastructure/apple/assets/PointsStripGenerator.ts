import { svgToPng } from '../utils/imageUtils.js'
import { PassDesignConfig } from '../PassDesignConfig.js'
import type { StripGenerator, StripSet } from './StripGenerator.js'
import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { PointsData } from '../../../domain/pass/entities/PassData.js'
import type { PointsRules } from '../../../domain/wallet/entities/WalletRules.js'

const W = PassDesignConfig.strip.width   // 750
const H = PassDesignConfig.strip.height  // 288

// Dimensiones internas del strip @2x
const CONTAINER_X = 40
const CONTAINER_Y = 24
const CONTAINER_W = W - CONTAINER_X * 2  // 670
const CONTAINER_H = H - CONTAINER_Y * 2  // 240
const CONTAINER_R = 20

const BAR_X = CONTAINER_X + 40          // 80
const BAR_W = CONTAINER_W - 80          // 590
const BAR_H = 14
const BAR_R = 7
const BAR_Y = H - CONTAINER_Y - 94      // espacio para label + bar + números

// 3x of Apple's recommended 180×220 pt background image
const BG_W = 540
const BG_H = 660

export class PointsStripGenerator implements StripGenerator {
  async generate(wallet: Wallet, pass: Pass): Promise<StripSet> {
    const data = pass.data as PointsData
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
      'strip.png': strip,
      'strip@2x.png': strip,
      'strip@3x.png': strip,
      'background.png': bg,
      'background@2x.png': bg,
      'background@3x.png': bg,
    }
  }
}

function buildPointsStrip(
  current: number,
  threshold: number,
  reward: string,
  pointsLabel: string,
  primaryColor: string,
  accentColor: string,
): Buffer {
  const progressRatio = threshold > 0 ? Math.min(1, current / threshold) : 0
  const fillW = Math.round(BAR_W * progressRatio)
  const remaining = Math.max(0, threshold - current)

  const captionLabel = pointsLabel.toUpperCase()
  const remainingText = remaining > 0
    ? `${remaining} ${pointsLabel} para: ${reward}`
    : '¡Listo para canjear!'

  // Posiciones verticales dentro del strip
  const labelY   = CONTAINER_Y + 52          // "TUS PUNTOS"
  const numberY  = CONTAINER_Y + 142         // número grande de puntos
  const barY     = BAR_Y                     // barra de progreso
  const numsY    = barY + BAR_H + 26         // "0" y max
  const captionY = numsY                     // texto restante (centered)

  const fillRect = fillW > 0
    ? `<rect x="${BAR_X}" y="${barY}" width="${fillW}" height="${BAR_H}" rx="${BAR_R}" fill="rgba(255,255,255,0.95)"/>`
    : ''

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${primaryColor}"/>
        <stop offset="100%" stop-color="${accentColor}"/>
      </linearGradient>
    </defs>

    <!-- Fondo con gradiente -->
    <rect width="${W}" height="${H}" fill="url(#grad)"/>

    <!-- Contenedor interior semi-transparente -->
    <rect
      x="${CONTAINER_X}" y="${CONTAINER_Y}"
      width="${CONTAINER_W}" height="${CONTAINER_H}"
      rx="${CONTAINER_R}"
      fill="rgba(255,255,255,0.15)"
    />

    <!-- Label de puntos (e.g. "TUS PUNTOS") -->
    <text
      x="${W / 2}" y="${labelY}"
      text-anchor="middle" dominant-baseline="middle"
      font-size="24"
      font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif"
      font-weight="600"
      letter-spacing="1.5"
      fill="rgba(255,255,255,0.75)"
    >${captionLabel}</text>

    <!-- Número grande de puntos -->
    <text
      x="${W / 2}" y="${numberY}"
      text-anchor="middle" dominant-baseline="middle"
      font-size="88"
      font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif"
      font-weight="700"
      fill="rgba(255,255,255,1)"
    >${current}</text>

    <!-- Barra de progreso: track -->
    <rect
      x="${BAR_X}" y="${barY}"
      width="${BAR_W}" height="${BAR_H}"
      rx="${BAR_R}"
      fill="rgba(255,255,255,0.3)"
    />

    <!-- Barra de progreso: relleno -->
    ${fillRect}

    <!-- Etiqueta izquierda "0" -->
    <text
      x="${BAR_X}" y="${numsY}"
      text-anchor="start" dominant-baseline="middle"
      font-size="20"
      font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif"
      fill="rgba(255,255,255,0.55)"
    >0</text>

    <!-- Etiqueta derecha (threshold) -->
    <text
      x="${BAR_X + BAR_W}" y="${numsY}"
      text-anchor="end" dominant-baseline="middle"
      font-size="20"
      font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif"
      fill="rgba(255,255,255,0.55)"
    >${threshold}</text>

    <!-- Texto de puntos restantes, centrado -->
    <text
      x="${W / 2}" y="${captionY}"
      text-anchor="middle" dominant-baseline="middle"
      font-size="22"
      font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif"
      font-weight="400"
      fill="rgba(255,255,255,0.85)"
    >${remainingText}</text>
  </svg>`

  return svgToPng(svg)
}

function renderBackground(primaryColor: string, accentColor: string): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${BG_W}" height="${BG_H}">
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
  </svg>`
  return svgToPng(svg)
}
