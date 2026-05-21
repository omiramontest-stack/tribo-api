import { svgToPng } from '../utils/imageUtils.js'
import { iconColorOnWhite, stripPalette } from '../utils/colorUtils.js'
import { PassDesignConfig } from '../PassDesignConfig.js'
import type { StripGenerator, StripSet } from './StripGenerator.js'
import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { StampIcon } from '../../../domain/wallet/entities/WalletRules.js'
import type { StampsData } from '../../../domain/pass/entities/PassData.js'
import type { StampsRules } from '../../../domain/wallet/entities/WalletRules.js'

const STRIP_W = PassDesignConfig.strip.width
const CIRCLE_R = PassDesignConfig.stamps.circleRadius
const CIRCLE_GAP = PassDesignConfig.stamps.circleGap
const CIRCLE_STEP = CIRCLE_R * 2 + CIRCLE_GAP
const PAD_TOP = PassDesignConfig.stamps.paddingTop
const TEXT_PAD = 20   // gap between last circle row and progress text
const TEXT_SIZE = 28  // font-size px for the progress caption
const PAD_BOTTOM = 36 // padding below the text

const BG_W = 540
const BG_H = 660

export class StampsStripGenerator implements StripGenerator {
  async generate(wallet: Wallet, pass: Pass): Promise<StripSet> {
    const data = pass.data as StampsData
    const rules = wallet.rules as StampsRules
    const strip = buildStampsStrip(
      data.currentStamps,
      rules.totalStamps,
      wallet.primaryColor,
      wallet.accentColor,
      rules.stampIcon,
      rules.reward,
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

/**
 * Computes a balanced grid layout for N stamps.
 *
 * Strategy:
 * - Up to 5 stamps → single row, centered
 * - 6-10 stamps → two rows, balancing top/bottom (top gets the extra if odd)
 * - 11+ stamps → ceil(total/5) rows of max 5 columns
 */
function computeGrid(total: number): { cols: number; rows: number } {
  if (total <= 5) return { cols: total, rows: 1 }
  if (total <= 10) return { cols: Math.ceil(total / 2), rows: 2 }
  return { cols: 5, rows: Math.ceil(total / 5) }
}

/**
 * Returns the SVG content to render inside an active stamp circle.
 * All icons are drawn relative to (cx, cy) with the given radius.
 *
 * Sizing rules:
 * - Text glyphs: font-size = r * 0.78 (~40% of circle diameter) — legible without overflowing.
 * - Path icons: scale s = r / 44 (~14% smaller than the old r/38 base) with vertical re-centering.
 * - `dominant-baseline="central"` gives the best vertical centering in resvg across all glyphs.
 */
function renderActiveIcon(icon: StampIcon, cx: number, cy: number, r: number, color: string): string {
  const fs = Math.round(r * 0.78)
  // Use dominant-baseline="central" — better than "middle" for resvg's text layout engine.
  const glyph = (char: string) =>
    `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" ` +
    `font-size="${fs}" font-family="system-ui,-apple-system,sans-serif" ` +
    `fill="${color}" font-weight="700">${char}</text>`

  switch (icon) {
    case 'star':   return glyph('★')
    case 'heart':  return glyph('♥')
    case 'bolt':   return glyph('⚡')
    case 'fire':   return renderFire(cx, cy, r, color)
    case 'crown':  return renderCrown(cx, cy, r, color)
    case 'coffee': return renderCoffee(cx, cy, r, color)
    case 'pizza':  return renderPizza(cx, cy, r, color)
    case 'beer':   return renderBeer(cx, cy, r, color)
    case 'paw':    return renderPaw(cx, cy, r, color)
    case 'check':
    default:       return glyph('✓')
  }
}

function renderFire(cx: number, cy: number, r: number, color: string): string {
  // Reduced from r*0.7 to r*0.48 — fits cleanly inside the circle without overflowing.
  const f = r * 0.48
  const path =
    `M${cx},${cy - f} ` +
    `C${cx + f * 0.43},${cy - f * 0.29} ${cx + f * 0.79},${cy + f * 0.14} ${cx + f * 0.5},${cy + f} ` +
    `C${cx + f * 0.21},${cy + f * 0.71} ${cx},${cy + f * 0.43} ${cx - f * 0.21},${cy + f * 0.71} ` +
    `C${cx - f * 0.5},${cy + f} ${cx - f * 0.79},${cy + f * 0.14} ${cx},${cy - f} Z`
  return `<path d="${path}" fill="${color}"/>`
}

function renderCrown(cx: number, cy: number, r: number, color: string): string {
  // Scaled down ~25% (was ±0.65r wide, now ±0.48r) and re-centered vertically.
  const top = cy - r * 0.40
  const bot = cy + r * 0.44
  const mid = cy - r * 0.04
  const left  = cx - r * 0.48
  const right = cx + r * 0.48
  const path =
    `M${left},${bot} L${left},${mid} ` +
    `L${cx - r * 0.18},${top + r * 0.22} L${cx},${top} L${cx + r * 0.18},${top + r * 0.22} ` +
    `L${right},${mid} L${right},${bot} Z`
  return `<path d="${path}" fill="${color}"/>`
}

function renderCoffee(cx: number, cy: number, r: number, color: string): string {
  // Scale reduced: r/44 (~14% smaller than old r/38).
  // Centering fix: body top moved from cy-8s to cy-4s so steam+cup spans ≈ cy±18s.
  const s = r / 44
  const by = cy - 4 * s           // cup top (re-centered)
  const bx = cx - 13 * s
  const bw = 26 * s
  const bh = 22 * s
  const hx = bx + bw              // handle start x
  const hy = by + 5 * s           // handle start y
  const steam1 = `M${cx - 6 * s},${by - 4 * s} Q${cx - 3 * s},${by - 9 * s} ${cx - 6 * s},${by - 14 * s}`
  const steam2 = `M${cx + 2 * s},${by - 4 * s} Q${cx + 5 * s},${by - 9 * s} ${cx + 2 * s},${by - 14 * s}`
  return [
    `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${4 * s}" fill="${color}"/>`,
    `<path d="M${hx},${hy} Q${hx + 9 * s},${hy} ${hx + 9 * s},${hy + 6 * s} Q${hx + 9 * s},${hy + 12 * s} ${hx},${hy + 12 * s}" fill="none" stroke="${color}" stroke-width="${3 * s}"/>`,
    `<path d="${steam1}" fill="none" stroke="${color}" stroke-width="${2.5 * s}" stroke-linecap="round"/>`,
    `<path d="${steam2}" fill="none" stroke="${color}" stroke-width="${2.5 * s}" stroke-linecap="round"/>`,
  ].join('')
}

function renderPizza(cx: number, cy: number, r: number, color: string): string {
  // Scale reduced: r/44 (~14% smaller).
  // Centering fix: triangle was cy-28s to cy+18s (center at cy-5s).
  // Shifted down 5s → cy-23s to cy+23s (centered at cy).
  const s = r / 44
  const top = cy - 23 * s
  const bot = cy + 23 * s
  const path = `M${cx},${top} L${cx - 24 * s},${bot} L${cx + 24 * s},${bot} Z`
  return [
    `<path d="${path}" fill="${color}"/>`,
    `<circle cx="${cx}"           cy="${cy + 9 * s}" r="${4   * s}" fill="rgba(0,0,0,0.2)"/>`,
    `<circle cx="${cx - 10 * s}" cy="${cy          }" r="${3.5 * s}" fill="rgba(0,0,0,0.2)"/>`,
    `<circle cx="${cx +  9 * s}" cy="${cy +  1 * s}" r="${3   * s}" fill="rgba(0,0,0,0.2)"/>`,
  ].join('')
}

function renderBeer(cx: number, cy: number, r: number, color: string): string {
  // Scale reduced: r/44 (~14% smaller).
  // Centering fix: body was cy-22s to cy+18s (center ≈ cy-4s including foam).
  // Shifted down 4s → by=cy-18s, body cy-18s to cy+22s (center ≈ cy).
  const s = r / 44
  const by = cy - 18 * s
  const bx = cx - 12 * s
  const bw = 24 * s
  const bh = 40 * s
  const foam = `M${bx - 2 * s},${by + 4 * s} Q${cx - 8 * s},${by - 6 * s} ${cx},${by - 4 * s} Q${cx + 8 * s},${by - 6 * s} ${bx + bw + 2 * s},${by + 4 * s} Z`
  return [
    `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${5 * s}" fill="${color}"/>`,
    `<path d="M${bx+bw},${by+6*s} Q${bx+bw+10*s},${by+6*s} ${bx+bw+10*s},${by+16*s} Q${bx+bw+10*s},${by+26*s} ${bx+bw},${by+26*s}" fill="none" stroke="${color}" stroke-width="${3 * s}"/>`,
    `<path d="${foam}" fill="rgba(255,255,255,0.6)"/>`,
  ].join('')
}

function renderPaw(cx: number, cy: number, r: number, color: string): string {
  // Scale reduced: r/44 (~14% smaller). Already nearly centered (was cy±~20s range).
  const s = r / 44
  return [
    `<ellipse cx="${cx}"           cy="${cy + 6 * s}"  rx="${13 * s}" ry="${11 * s}" fill="${color}"/>`,
    `<ellipse cx="${cx - 16 * s}" cy="${cy - 4 * s}"  rx="${6 * s}"  ry="${8  * s}" fill="${color}"/>`,
    `<ellipse cx="${cx + 16 * s}" cy="${cy - 4 * s}"  rx="${6 * s}"  ry="${8  * s}" fill="${color}"/>`,
    `<ellipse cx="${cx -  7 * s}" cy="${cy - 14 * s}" rx="${5 * s}"  ry="${7  * s}" fill="${color}"/>`,
    `<ellipse cx="${cx +  7 * s}" cy="${cy - 14 * s}" rx="${5 * s}"  ry="${7  * s}" fill="${color}"/>`,
  ].join('')
}

function buildCircles(
  current: number,
  total: number,
  primaryColor: string,
  cols: number,
  icon: StampIcon,
): string {
  const palette = stripPalette(primaryColor)

  // Ícono activo: siempre sobre fondo blanco → usa el color de la marca si contrasta,
  // si no, negro. Nunca blanco sobre blanco.
  const activeIconColor = iconColorOnWhite(primaryColor)

  let circles = ''

  for (let i = 0; i < total; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const rowCols = Math.min(cols, total - row * cols)

    const rowW = rowCols * CIRCLE_STEP - CIRCLE_GAP
    const offsetX = (STRIP_W - rowW) / 2 + CIRCLE_R

    const cx = offsetX + col * CIRCLE_STEP
    const cy = PAD_TOP + CIRCLE_R + row * CIRCLE_STEP

    if (i < current) {
      // Sello canjeado: círculo blanco sólido + ícono que contrasta contra blanco
      circles += `<circle cx="${cx}" cy="${cy}" r="${CIRCLE_R}" fill="rgba(255,255,255,0.95)"/>`
      circles += renderActiveIcon(icon, cx, cy, CIRCLE_R, activeIconColor)
    } else {
      // Sello pendiente: círculo fantasma + ícono fantasma, ambos usando la paleta del strip
      circles += `<circle cx="${cx}" cy="${cy}" r="${CIRCLE_R}" fill="${palette.container}" stroke="${palette.stampBorder}" stroke-width="2.5"/>`
      circles += renderActiveIcon(icon, cx, cy, CIRCLE_R, palette.stampGhost)
    }
  }

  return circles
}

export function buildStampsStrip(
  current: number,
  total: number,
  primaryColor: string,
  accentColor: string,
  icon: StampIcon = 'check',
  reward = '',
): Buffer {
  const { cols, rows } = computeGrid(total)
  const totalGridH = rows * CIRCLE_STEP - CIRCLE_GAP
  const H = PAD_TOP + totalGridH + TEXT_PAD + TEXT_SIZE + PAD_BOTTOM

  const circles = buildCircles(current, total, primaryColor, cols, icon)
  const palette = stripPalette(primaryColor)

  // Caption: "2 / 5 — Un producto gratis"
  const caption = reward
    ? `${current} / ${total} — ${reward}`
    : `${current} / ${total}`
  const captionY = PAD_TOP + totalGridH + TEXT_PAD + TEXT_SIZE

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${STRIP_W}" height="${H}">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${primaryColor}"/>
        <stop offset="100%" stop-color="${accentColor}"/>
      </linearGradient>
    </defs>
    <rect width="${STRIP_W}" height="${H}" fill="url(#grad)"/>
    ${circles}
    <text
      x="${STRIP_W / 2}"
      y="${captionY}"
      text-anchor="middle"
      dominant-baseline="auto"
      font-size="${TEXT_SIZE}"
      font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif"
      font-weight="500"
      fill="${palette.textMuted}"
      letter-spacing="0.3"
    >${caption}</text>
  </svg>`

  return svgToPng(svg)
}

export function buildStampsStripSet(
  current: number,
  total: number,
  primaryColor: string,
  accentColor: string,
  icon: StampIcon = 'check',
  reward = '',
): Record<string, Buffer> {
  const strip = buildStampsStrip(current, total, primaryColor, accentColor, icon, reward)
  return {
    'strip.png': strip,
    'strip@2x.png': strip,
    'strip@3x.png': strip,
  }
}
