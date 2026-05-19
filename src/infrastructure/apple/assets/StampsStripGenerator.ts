import { svgToPng } from '../utils/imageUtils.js'
import { contrastingColor } from '../utils/colorUtils.js'

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
  if (total <= 10) {
    const rows = 2
    const cols = Math.ceil(total / rows)
    return { cols, rows }
  }
  const cols = 5
  const rows = Math.ceil(total / cols)
  return { cols, rows }
}

function buildCircles(current: number, total: number, primaryColor: string, cols: number): string {
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
      circles += `<text x="${cx}" y="${cy + 1}" text-anchor="middle" dominant-baseline="middle" font-size="30" font-family="system-ui, -apple-system, sans-serif" fill="${checkColor}" font-weight="700">✓</text>`
    } else {
      circles += `<circle cx="${cx}" cy="${cy}" r="${CIRCLE_R}" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.5)" stroke-width="2.5"/>`
    }
  }

  return circles
}

export function buildStampsStrip(current: number, total: number, primaryColor: string, accentColor: string): Buffer {
  const { cols, rows } = computeGrid(total)
  const totalGridH = rows * CIRCLE_STEP - CIRCLE_GAP
  const H = PAD_TOP + totalGridH + PAD_TOP

  const circles = buildCircles(current, total, primaryColor, cols)

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

export function buildStampsStripSet(current: number, total: number, primaryColor: string, accentColor: string): Record<string, Buffer> {
  const strip = buildStampsStrip(current, total, primaryColor, accentColor)
  return {
    'strip.png': strip,
    'strip@2x.png': strip,
    'strip@3x.png': strip,
  }
}
