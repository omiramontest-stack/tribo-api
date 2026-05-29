import { svgToPng } from '../utils/imageUtils.js'
import { iconColorOnWhite, stripPalette } from '../utils/colorUtils.js'
import { PassDesignConfig } from '../PassDesignConfig.js'
import type { StripGenerator, StripSet } from './StripGenerator.js'
import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { StampIcon } from '../../../domain/wallet/entities/WalletRules.js'
import type { StampsData } from '../../../domain/pass/entities/PassData.js'
import type { StampsRules } from '../../../domain/wallet/entities/WalletRules.js'

const STRIP_W   = PassDesignConfig.strip.width
const CIRCLE_R  = PassDesignConfig.stamps.circleRadius
const CIRCLE_GAP = PassDesignConfig.stamps.circleGap
const PAD_TOP   = PassDesignConfig.stamps.paddingTop
const MAX_H     = PassDesignConfig.stamps.maxStripHeight
const TEXT_PAD  = 14
const TEXT_SIZE = 28
const PAD_BOTTOM = 24

// Google Wallet heroImage dimensions (1032×~336 for 2-row grids)
const HERO_W       = 1032
const HERO_BASE_R  = 72
const HERO_GAP     = 16
const HERO_PAD     = 40

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
      rules.stampCustomSvg,
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
 * Computes circle radius and step for the Apple Wallet strip, scaling down
 * automatically when many stamp rows would otherwise exceed MAX_H.
 */
function computeLayout(total: number): { cols: number; rows: number; radius: number; step: number } {
  const { cols, rows } = computeGrid(total)
  const gap = CIRCLE_GAP
  // Height budget reserved for text and padding
  const available = MAX_H - PAD_TOP - TEXT_PAD - TEXT_SIZE - PAD_BOTTOM
  // Largest radius that keeps rows * (2R + gap) - gap ≤ available
  const maxRadius = Math.floor((available - gap * (rows - 1)) / (2 * rows))
  const radius = Math.min(CIRCLE_R, maxRadius)
  const step = radius * 2 + gap
  return { cols, rows, radius, step }
}

// ── Icon renderers ──────────────────────────────────────────────────────────
// All icons are drawn relative to (cx, cy) with the given radius r.
// Every icon uses SVG path/shape primitives — no Unicode glyphs — so they
// render correctly with resvg regardless of available system fonts.

/** ✓ Checkmark (stroke-based) */
function renderCheck(cx: number, cy: number, r: number, color: string): string {
  const sw = Math.round(r * 0.13)
  const d =
    `M${(cx - r * 0.33).toFixed(1)},${(cy + r * 0.02).toFixed(1)}` +
    ` L${(cx - r * 0.02).toFixed(1)},${(cy + r * 0.30).toFixed(1)}` +
    ` L${(cx + r * 0.38).toFixed(1)},${(cy - r * 0.27).toFixed(1)}`
  return (
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}"` +
    ` stroke-linecap="round" stroke-linejoin="round"/>`
  )
}

/** ★ 5-pointed star (polygon) */
function renderStar(cx: number, cy: number, r: number, color: string): string {
  const Ro = r * 0.44
  const Ri = r * 0.18
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const angle = (i * 36 - 90) * (Math.PI / 180)
    const rad = i % 2 === 0 ? Ro : Ri
    pts.push(
      `${(cx + Math.cos(angle) * rad).toFixed(1)},${(cy + Math.sin(angle) * rad).toFixed(1)}`,
    )
  }
  return `<polygon points="${pts.join(' ')}" fill="${color}"/>`
}

/** ♥ Heart (cubic bezier) */
function renderHeart(cx: number, cy: number, r: number, color: string): string {
  const s = r * 0.44
  const yo = s * 0.2 // shift down slightly to visually center
  const p = (x: number, y: number) =>
    `${(cx + x * s).toFixed(1)},${(cy + y * s + yo).toFixed(1)}`
  const d =
    `M${p(0, 0.5)}` +
    ` C${p(-0.5, 0.1)} ${p(-1, -0.1)} ${p(-1, -0.5)}` +
    ` C${p(-1, -1)} ${p(-0.5, -1)} ${p(0, -0.5)}` +
    ` C${p(0.5, -1)} ${p(1, -1)} ${p(1, -0.5)}` +
    ` C${p(1, -0.1)} ${p(0.5, 0.1)} ${p(0, 0.5)} Z`
  return `<path d="${d}" fill="${color}"/>`
}

/** ⚡ Lightning bolt (polygon) */
function renderBolt(cx: number, cy: number, r: number, color: string): string {
  const s = r * 0.44
  const f = (x: number, y: number) =>
    `${(cx + x * s).toFixed(1)},${(cy + y * s).toFixed(1)}`
  const d =
    `M${f(0.15, -1)}` +
    ` L${f(-0.38, 0.05)}` +
    ` L${f(0.02, 0.05)}` +
    ` L${f(-0.15, 1)}` +
    ` L${f(0.38, -0.05)}` +
    ` L${f(-0.02, -0.05)} Z`
  return `<path d="${d}" fill="${color}"/>`
}

/** 🔥 Fire (organic flame) */
function renderFire(cx: number, cy: number, r: number, color: string): string {
  const f = r * 0.48
  const path =
    `M${cx},${cy - f} ` +
    `C${cx + f * 0.43},${cy - f * 0.29} ${cx + f * 0.79},${cy + f * 0.14} ${cx + f * 0.5},${cy + f} ` +
    `C${cx + f * 0.21},${cy + f * 0.71} ${cx},${cy + f * 0.43} ${cx - f * 0.21},${cy + f * 0.71} ` +
    `C${cx - f * 0.5},${cy + f} ${cx - f * 0.79},${cy + f * 0.14} ${cx},${cy - f} Z`
  return `<path d="${path}" fill="${color}"/>`
}

/** 👑 Crown */
function renderCrown(cx: number, cy: number, r: number, color: string): string {
  const top = cy - r * 0.40
  const bot = cy + r * 0.44
  const mid = cy - r * 0.04
  const left = cx - r * 0.48
  const right = cx + r * 0.48
  const path =
    `M${left},${bot} L${left},${mid} ` +
    `L${cx - r * 0.18},${top + r * 0.22} L${cx},${top} L${cx + r * 0.18},${top + r * 0.22} ` +
    `L${right},${mid} L${right},${bot} Z`
  return `<path d="${path}" fill="${color}"/>`
}

/**
 * ☕ Coffee cup — cup body centered at (cx, cy); steam above is thin and
 * carries less visual weight, keeping the icon balanced inside the circle.
 */
function renderCoffee(cx: number, cy: number, r: number, color: string): string {
  const s = r / 44
  const bh = 22 * s          // cup body height
  const by = cy - bh / 2     // top of cup body, centers body at cy
  const bx = cx - 13 * s
  const bw = 26 * s
  const hx = bx + bw
  const hy = by + 5 * s
  const steam1 = `M${cx - 6 * s},${by - 4 * s} Q${cx - 3 * s},${by - 9 * s} ${cx - 6 * s},${by - 14 * s}`
  const steam2 = `M${cx + 2 * s},${by - 4 * s} Q${cx + 5 * s},${by - 9 * s} ${cx + 2 * s},${by - 14 * s}`
  return [
    `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${4 * s}" fill="${color}"/>`,
    `<path d="M${hx},${hy} Q${hx + 9 * s},${hy} ${hx + 9 * s},${hy + 6 * s} Q${hx + 9 * s},${hy + 12 * s} ${hx},${hy + 12 * s}" fill="none" stroke="${color}" stroke-width="${3 * s}"/>`,
    `<path d="${steam1}" fill="none" stroke="${color}" stroke-width="${2.5 * s}" stroke-linecap="round"/>`,
    `<path d="${steam2}" fill="none" stroke="${color}" stroke-width="${2.5 * s}" stroke-linecap="round"/>`,
  ].join('')
}

/** 🍕 Pizza slice */
function renderPizza(cx: number, cy: number, r: number, color: string): string {
  const s = r / 44
  const top = cy - 23 * s
  const bot = cy + 23 * s
  const path = `M${cx},${top} L${cx - 24 * s},${bot} L${cx + 24 * s},${bot} Z`
  return [
    `<path d="${path}" fill="${color}"/>`,
    `<circle cx="${cx}" cy="${cy + 9 * s}" r="${4 * s}" fill="rgba(0,0,0,0.2)"/>`,
    `<circle cx="${cx - 10 * s}" cy="${cy}" r="${3.5 * s}" fill="rgba(0,0,0,0.2)"/>`,
    `<circle cx="${cx + 9 * s}" cy="${cy + 1 * s}" r="${3 * s}" fill="rgba(0,0,0,0.2)"/>`,
  ].join('')
}

/** 🍺 Beer mug */
function renderBeer(cx: number, cy: number, r: number, color: string): string {
  const s = r / 44
  const by = cy - 18 * s
  const bx = cx - 12 * s
  const bw = 24 * s
  const bh = 40 * s
  const foam = `M${bx - 2 * s},${by + 4 * s} Q${cx - 8 * s},${by - 6 * s} ${cx},${by - 4 * s} Q${cx + 8 * s},${by - 6 * s} ${bx + bw + 2 * s},${by + 4 * s} Z`
  return [
    `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${5 * s}" fill="${color}"/>`,
    `<path d="M${bx + bw},${by + 6 * s} Q${bx + bw + 10 * s},${by + 6 * s} ${bx + bw + 10 * s},${by + 16 * s} Q${bx + bw + 10 * s},${by + 26 * s} ${bx + bw},${by + 26 * s}" fill="none" stroke="${color}" stroke-width="${3 * s}"/>`,
    `<path d="${foam}" fill="rgba(255,255,255,0.6)"/>`,
  ].join('')
}

/** 🐾 Paw print */
function renderPaw(cx: number, cy: number, r: number, color: string): string {
  const s = r / 44
  return [
    `<ellipse cx="${cx}" cy="${cy + 6 * s}" rx="${13 * s}" ry="${11 * s}" fill="${color}"/>`,
    `<ellipse cx="${cx - 16 * s}" cy="${cy - 4 * s}" rx="${6 * s}" ry="${8 * s}" fill="${color}"/>`,
    `<ellipse cx="${cx + 16 * s}" cy="${cy - 4 * s}" rx="${6 * s}" ry="${8 * s}" fill="${color}"/>`,
    `<ellipse cx="${cx - 7 * s}" cy="${cy - 14 * s}" rx="${5 * s}" ry="${7 * s}" fill="${color}"/>`,
    `<ellipse cx="${cx + 7 * s}" cy="${cy - 14 * s}" rx="${5 * s}" ry="${7 * s}" fill="${color}"/>`,
  ].join('')
}

/** 🍔 Hamburger (3 layered buns + patty) */
function renderBurger(cx: number, cy: number, r: number, color: string): string {
  const s = r / 44
  return [
    `<rect x="${cx - 13 * s}" y="${cy - 15 * s}" width="${26 * s}" height="${9 * s}" rx="${5 * s}" fill="${color}"/>`,
    `<rect x="${cx - 15 * s}" y="${cy - 3 * s}" width="${30 * s}" height="${6 * s}" rx="${2 * s}" fill="${color}"/>`,
    `<rect x="${cx - 12 * s}" y="${cy + 6 * s}" width="${24 * s}" height="${9 * s}" rx="${4 * s}" fill="${color}"/>`,
  ].join('')
}

/** 💎 Gem / Diamond */
function renderGem(cx: number, cy: number, r: number, color: string): string {
  const s = r * 0.44
  const f = (x: number, y: number) =>
    `${(cx + x * s).toFixed(1)},${(cy + y * s).toFixed(1)}`
  const d =
    `M${f(-0.30, -1)}` +
    ` L${f(0.30, -1)}` +
    ` L${f(1, -0.28)}` +
    ` L${f(0.62, 0.12)}` +
    ` L${f(0, 1)}` +
    ` L${f(-0.62, 0.12)}` +
    ` L${f(-1, -0.28)} Z`
  return `<path d="${d}" fill="${color}"/>`
}

/** 🎁 Gift box with bow */
function renderGift(cx: number, cy: number, r: number, color: string): string {
  const s = r / 44
  const lidTop = cy - 11 * s
  const lidBot = cy - 1 * s
  const bh = 18 * s
  const sw = 3.5 * s
  return [
    `<rect x="${cx - 12 * s}" y="${lidBot}" width="${24 * s}" height="${bh}" rx="${2 * s}" fill="${color}"/>`,
    `<rect x="${cx - 14 * s}" y="${lidTop}" width="${28 * s}" height="${10 * s}" rx="${2 * s}" fill="${color}"/>`,
    `<path d="M${cx},${lidTop} Q${cx - 12 * s},${lidTop - 7 * s} ${cx - 5 * s},${lidTop - 1 * s}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`,
    `<path d="M${cx},${lidTop} Q${cx + 12 * s},${lidTop - 7 * s} ${cx + 5 * s},${lidTop - 1 * s}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`,
  ].join('')
}

/** 🎵 Music note (filled head + stem + flag) */
function renderMusic(cx: number, cy: number, r: number, color: string): string {
  const s = r / 44
  const nhCx = cx - 4 * s
  const nhCy = cy + 13 * s
  const stemTop = cy - 17 * s
  const stemRight = nhCx + 8 * s
  const sw = 3 * s
  return [
    `<ellipse cx="${nhCx}" cy="${nhCy}" rx="${9 * s}" ry="${6.5 * s}" transform="rotate(-15 ${nhCx} ${nhCy})" fill="${color}"/>`,
    `<rect x="${stemRight}" y="${stemTop}" width="${sw}" height="${nhCy - stemTop}" fill="${color}"/>`,
    `<path d="M${stemRight + sw},${stemTop} Q${stemRight + sw + 14 * s},${stemTop + 8 * s} ${stemRight + sw + 8 * s},${stemTop + 18 * s}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`,
  ].join('')
}

/** 🍃 Leaf */
function renderLeaf(cx: number, cy: number, r: number, color: string): string {
  const s = r * 0.46
  const topY = cy - s * 0.95
  const botY = cy + s * 0.95
  const path =
    `M${cx.toFixed(1)},${topY.toFixed(1)}` +
    ` C${(cx + s).toFixed(1)},${(cy - s * 0.2).toFixed(1)} ${(cx + s).toFixed(1)},${(cy + s * 0.2).toFixed(1)} ${cx.toFixed(1)},${botY.toFixed(1)}` +
    ` C${(cx - s).toFixed(1)},${(cy + s * 0.2).toFixed(1)} ${(cx - s).toFixed(1)},${(cy - s * 0.2).toFixed(1)} ${cx.toFixed(1)},${topY.toFixed(1)} Z`
  const vein =
    `M${cx.toFixed(1)},${(topY + s * 0.1).toFixed(1)} L${cx.toFixed(1)},${(botY - s * 0.1).toFixed(1)}`
  return [
    `<path d="${path}" fill="${color}"/>`,
    `<path d="${vein}" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="${(r * 0.06).toFixed(1)}" stroke-linecap="round"/>`,
  ].join('')
}

/** 🍦 Ice cream cone */
function renderIcecream(cx: number, cy: number, r: number, color: string): string {
  const s = r / 44
  const scoopCy = cy - 10 * s
  const scoopR = 13 * s
  const coneTopY = cy + 2 * s
  const coneTipY = cy + 22 * s
  const coneHW = 14 * s
  return [
    `<path d="M${cx - coneHW},${coneTopY} L${cx + coneHW},${coneTopY} L${cx},${coneTipY} Z" fill="${color}"/>`,
    `<path d="M${cx - coneHW * 0.7},${coneTopY + 5 * s} L${cx + coneHW * 0.7},${coneTopY + 5 * s}" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="${1.5 * s}"/>`,
    `<path d="M${cx - coneHW * 0.4},${coneTopY + 12 * s} L${cx + coneHW * 0.4},${coneTopY + 12 * s}" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="${1.5 * s}"/>`,
    `<circle cx="${cx}" cy="${scoopCy}" r="${scoopR}" fill="${color}"/>`,
  ].join('')
}

/**
 * Custom SVG icon.
 *
 * Acepta un SVG completo (etiqueta `<svg viewBox="...">…</svg>`) y lo incrusta
 * escalado y centrado dentro del círculo de sello.
 */
function renderCustom(svgContent: string, cx: number, cy: number, r: number): string {
  const vbMatch = svgContent.match(/viewBox=["']([^"']+)["']/i)
  const viewBox = vbMatch ? vbMatch[1] : '0 0 24 24'

  const inner = svgContent
    .replace(/<svg[^>]*>/gi, '')
    .replace(/<\/svg>/gi, '')
    .trim()

  if (!inner) return ''

  const pad = r * 0.12
  const size = (r - pad) * 2
  const x = cx - r + pad
  const y = cy - r + pad

  return `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" viewBox="${viewBox}">${inner}</svg>`
}

/** 🌸 Flower (5 petal circles + center) */
function renderFlower(cx: number, cy: number, r: number, color: string): string {
  const s = r * 0.44
  const dist = s * 0.50
  const petalR = s * 0.43
  let petals = ''
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
    const px = cx + Math.cos(angle) * dist
    const py = cy + Math.sin(angle) * dist
    petals += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${petalR.toFixed(1)}" fill="${color}"/>`
  }
  petals += `<circle cx="${cx}" cy="${cy}" r="${(s * 0.30).toFixed(1)}" fill="${color}"/>`
  return petals
}

// ── Active icon dispatcher ──────────────────────────────────────────────────

function renderActiveIcon(
  icon: StampIcon,
  cx: number,
  cy: number,
  r: number,
  color: string,
  customSvg?: string,
): string {
  switch (icon) {
    case 'star':     return renderStar(cx, cy, r, color)
    case 'heart':    return renderHeart(cx, cy, r, color)
    case 'bolt':     return renderBolt(cx, cy, r, color)
    case 'fire':     return renderFire(cx, cy, r, color)
    case 'crown':    return renderCrown(cx, cy, r, color)
    case 'coffee':   return renderCoffee(cx, cy, r, color)
    case 'pizza':    return renderPizza(cx, cy, r, color)
    case 'beer':     return renderBeer(cx, cy, r, color)
    case 'paw':      return renderPaw(cx, cy, r, color)
    case 'burger':   return renderBurger(cx, cy, r, color)
    case 'gem':      return renderGem(cx, cy, r, color)
    case 'gift':     return renderGift(cx, cy, r, color)
    case 'music':    return renderMusic(cx, cy, r, color)
    case 'leaf':     return renderLeaf(cx, cy, r, color)
    case 'icecream': return renderIcecream(cx, cy, r, color)
    case 'flower':   return renderFlower(cx, cy, r, color)
    case 'custom':   return renderCustom(customSvg ?? '', cx, cy, r)
    case 'check':
    default:         return renderCheck(cx, cy, r, color)
  }
}

// ── Circle grid builder ─────────────────────────────────────────────────────

function buildCircles(
  current: number,
  total: number,
  canvasW: number,
  padTop: number,
  primaryColor: string,
  cols: number,
  radius: number,
  step: number,
  gap: number,
  icon: StampIcon,
  customSvg?: string,
): string {
  const palette = stripPalette(primaryColor)
  const activeIconColor = iconColorOnWhite(primaryColor)
  let circles = ''

  for (let i = 0; i < total; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const rowCols = Math.min(cols, total - row * cols)

    const rowW = rowCols * step - gap
    const offsetX = (canvasW - rowW) / 2 + radius

    const cx = offsetX + col * step
    const cy = padTop + radius + row * step

    if (i < current) {
      circles += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="rgba(255,255,255,0.97)"/>`
      circles += renderActiveIcon(icon, cx, cy, radius, activeIconColor, customSvg)
    } else {
      circles += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${palette.container}" stroke="${palette.stampBorder}" stroke-width="2.5"/>`
      circles += renderActiveIcon(icon, cx, cy, radius, palette.stampGhost, customSvg)
    }
  }

  return circles
}

// ── Public builders ─────────────────────────────────────────────────────────

export function buildStampsStrip(
  current: number,
  total: number,
  primaryColor: string,
  accentColor: string,
  icon: StampIcon = 'check',
  reward = '',
  customSvg?: string,
): Buffer {
  const { cols, rows, radius, step } = computeLayout(total)
  const totalGridH = rows * step - CIRCLE_GAP
  const H = PAD_TOP + totalGridH + TEXT_PAD + TEXT_SIZE + PAD_BOTTOM

  const circles = buildCircles(current, total, STRIP_W, PAD_TOP, primaryColor, cols, radius, step, CIRCLE_GAP, icon, customSvg)
  const palette = stripPalette(primaryColor)

  const caption = reward ? `${current} / ${total} — ${reward}` : `${current} / ${total}`
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

/**
 * Renders a landscape banner image (1032px wide) optimised for Google Wallet
 * heroImage. The stamp grid is horizontally centered with radius 72, which
 * produces a 1032×336 image for the common 2-row cases (6-10 stamps).
 */
export function buildStampsHeroImage(
  current: number,
  total: number,
  primaryColor: string,
  accentColor: string,
  icon: StampIcon = 'check',
  customSvg?: string,
): Buffer {
  const { cols, rows } = computeGrid(total)
  const step = HERO_BASE_R * 2 + HERO_GAP
  const totalGridH = rows * step - HERO_GAP
  const H = HERO_PAD + totalGridH + HERO_PAD

  const circles = buildCircles(
    current, total, HERO_W, HERO_PAD, primaryColor,
    cols, HERO_BASE_R, step, HERO_GAP, icon, customSvg,
  )

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${HERO_W}" height="${H}">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${primaryColor}"/>
        <stop offset="100%" stop-color="${accentColor}"/>
      </linearGradient>
      <radialGradient id="bloom" cx="85%" cy="15%" r="70%" gradientUnits="objectBoundingBox">
        <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="${accentColor}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${HERO_W}" height="${H}" fill="url(#grad)"/>
    <rect width="${HERO_W}" height="${H}" fill="url(#bloom)"/>
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
  reward = '',
  customSvg?: string,
): Record<string, Buffer> {
  const strip = buildStampsStrip(current, total, primaryColor, accentColor, icon, reward, customSvg)
  return {
    'strip.png': strip,
    'strip@2x.png': strip,
    'strip@3x.png': strip,
  }
}
