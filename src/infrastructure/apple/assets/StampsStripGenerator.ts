import { svgToPng } from '../utils/imageUtils.js'
import { contrastingColor } from '../utils/colorUtils.js'
import type { StampIcon } from '../../../domain/wallet/entities/WalletRules.js'

const STRIP_W = 750
const CIRCLE_R = 38
const CIRCLE_GAP = 18
const CIRCLE_STEP = CIRCLE_R * 2 + CIRCLE_GAP
const PAD_TOP = 48

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
 */
function renderActiveIcon(icon: StampIcon, cx: number, cy: number, r: number, color: string): string {
  const fs = Math.round(r * 1.1)
  const text = (glyph: string, dy = 1) =>
    `<text x="${cx}" y="${cy + dy}" text-anchor="middle" dominant-baseline="middle" font-size="${fs}" font-family="system-ui, -apple-system, sans-serif" fill="${color}" font-weight="700">${glyph}</text>`

  switch (icon) {
    case 'star':   return text('★', 2)
    case 'heart':  return text('♥', 2)
    case 'bolt':   return text('⚡', 1)
    case 'fire':   return renderFire(cx, cy, r, color)
    case 'crown':  return renderCrown(cx, cy, r, color)
    case 'coffee': return renderCoffee(cx, cy, r, color)
    case 'pizza':  return renderPizza(cx, cy, r, color)
    case 'beer':   return renderBeer(cx, cy, r, color)
    case 'paw':    return renderPaw(cx, cy, r, color)
    case 'check':
    default:       return text('✓', 1)
  }
}

function renderFire(cx: number, cy: number, r: number, color: string): string {
  const s = r * 0.055
  const path = `M${cx},${cy - r * 0.7} C${cx + r * 0.3},${cy - r * 0.2} ${cx + r * 0.55},${cy + r * 0.1} ${cx + r * 0.35},${cy + r * 0.7} C${cx + r * 0.15},${cy + r * 0.5} ${cx},${cy + r * 0.3} ${cx - r * 0.15},${cy + r * 0.5} C${cx - r * 0.35},${cy + r * 0.7} ${cx - r * 0.55},${cy + r * 0.1} ${cx},${cy - r * 0.7} Z`
  return `<path d="${path}" fill="${color}" stroke="none" transform="scale(${s > 0 ? 1 : 1})"/>`
}

function renderCrown(cx: number, cy: number, r: number, color: string): string {
  const top = cy - r * 0.55
  const bot = cy + r * 0.6
  const mid = cy - r * 0.05
  const left = cx - r * 0.65
  const right = cx + r * 0.65
  const path = `M${left},${bot} L${left},${mid} L${cx - r * 0.25},${top + r * 0.3} L${cx},${top} L${cx + r * 0.25},${top + r * 0.3} L${right},${mid} L${right},${bot} Z`
  return `<path d="${path}" fill="${color}"/>`
}

function renderCoffee(cx: number, cy: number, r: number, color: string): string {
  const s = r / 38
  const bx = cx - 13 * s, by = cy - 8 * s, bw = 26 * s, bh = 22 * s
  const rx = bx + bw, ry = by + 5 * s
  const steam1 = `M${cx - 6 * s},${by - 4 * s} Q${cx - 3 * s},${by - 9 * s} ${cx - 6 * s},${by - 14 * s}`
  const steam2 = `M${cx + 2 * s},${by - 4 * s} Q${cx + 5 * s},${by - 9 * s} ${cx + 2 * s},${by - 14 * s}`
  return [
    `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${4 * s}" fill="${color}"/>`,
    `<path d="M${rx},${ry} Q${rx + 9 * s},${ry} ${rx + 9 * s},${ry + 6 * s} Q${rx + 9 * s},${ry + 12 * s} ${rx},${ry + 12 * s}" fill="none" stroke="${color}" stroke-width="${3 * s}"/>`,
    `<path d="${steam1}" fill="none" stroke="${color}" stroke-width="${2.5 * s}" stroke-linecap="round"/>`,
    `<path d="${steam2}" fill="none" stroke="${color}" stroke-width="${2.5 * s}" stroke-linecap="round"/>`,
  ].join('')
}

function renderPizza(cx: number, cy: number, r: number, color: string): string {
  const s = r / 38
  const path = `M${cx},${cy - 28 * s} L${cx - 24 * s},${cy + 18 * s} L${cx + 24 * s},${cy + 18 * s} Z`
  return [
    `<path d="${path}" fill="${color}"/>`,
    `<circle cx="${cx}" cy="${cy + 4 * s}" r="${4 * s}" fill="rgba(0,0,0,0.2)"/>`,
    `<circle cx="${cx - 10 * s}" cy="${cy - 5 * s}" r="${3.5 * s}" fill="rgba(0,0,0,0.2)"/>`,
    `<circle cx="${cx + 9 * s}" cy="${cy - 4 * s}" r="${3 * s}" fill="rgba(0,0,0,0.2)"/>`,
  ].join('')
}

function renderBeer(cx: number, cy: number, r: number, color: string): string {
  const s = r / 38
  const bx = cx - 12 * s, by = cy - 22 * s, bw = 24 * s, bh = 40 * s
  const foam = `M${bx - 2 * s},${by + 4 * s} Q${cx - 8 * s},${by - 6 * s} ${cx},${by - 4 * s} Q${cx + 8 * s},${by - 6 * s} ${bx + bw + 2 * s},${by + 4 * s} Z`
  return [
    `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${5 * s}" fill="${color}"/>`,
    `<path d="M${bx + bw},${by + 6 * s} Q${bx + bw + 10 * s},${by + 6 * s} ${bx + bw + 10 * s},${by + 16 * s} Q${bx + bw + 10 * s},${by + 26 * s} ${bx + bw},${by + 26 * s}" fill="none" stroke="${color}" stroke-width="${3 * s}"/>`,
    `<path d="${foam}" fill="rgba(255,255,255,0.6)"/>`,
  ].join('')
}

function renderPaw(cx: number, cy: number, r: number, color: string): string {
  const s = r / 38
  return [
    `<ellipse cx="${cx}" cy="${cy + 6 * s}" rx="${13 * s}" ry="${11 * s}" fill="${color}"/>`,
    `<ellipse cx="${cx - 16 * s}" cy="${cy - 4 * s}" rx="${6 * s}" ry="${8 * s}" fill="${color}"/>`,
    `<ellipse cx="${cx + 16 * s}" cy="${cy - 4 * s}" rx="${6 * s}" ry="${8 * s}" fill="${color}"/>`,
    `<ellipse cx="${cx - 7 * s}" cy="${cy - 14 * s}" rx="${5 * s}" ry="${7 * s}" fill="${color}"/>`,
    `<ellipse cx="${cx + 7 * s}" cy="${cy - 14 * s}" rx="${5 * s}" ry="${7 * s}" fill="${color}"/>`,
  ].join('')
}

function buildCircles(
  current: number,
  total: number,
  primaryColor: string,
  cols: number,
  icon: StampIcon,
): string {
  const checkColor = contrastingColor(primaryColor)
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
      circles += `<circle cx="${cx}" cy="${cy}" r="${CIRCLE_R}" fill="rgba(255,255,255,0.95)"/>`
      circles += renderActiveIcon(icon, cx, cy, CIRCLE_R, checkColor)
    } else {
      circles += `<circle cx="${cx}" cy="${cy}" r="${CIRCLE_R}" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.5)" stroke-width="2.5"/>`
      circles += renderActiveIcon(icon, cx, cy, CIRCLE_R, 'rgba(255,255,255,0.25)')
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
): Buffer {
  const { cols, rows } = computeGrid(total)
  const totalGridH = rows * CIRCLE_STEP - CIRCLE_GAP
  const H = PAD_TOP + totalGridH + PAD_TOP

  const circles = buildCircles(current, total, primaryColor, cols, icon)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${STRIP_W}" height="${H}">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${primaryColor}"/>
        <stop offset="100%" stop-color="${accentColor}"/>
      </linearGradient>
    </defs>
    <rect width="${STRIP_W}" height="${H}" fill="url(#grad)"/>
    ${circles}
  </svg>`

  return svgToPng(svg)
}

export function buildStampsStripSet(
  current: number,
  total: number,
  primaryColor: string,
  accentColor: string,
  icon: StampIcon = 'check',
): Record<string, Buffer> {
  const strip = buildStampsStrip(current, total, primaryColor, accentColor, icon)
  return {
    'strip.png': strip,
    'strip@2x.png': strip,
    'strip@3x.png': strip,
  }
}
