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

/** ☕ Coffee cup */
function renderCoffee(cx: number, cy: number, r: number, color: string): string {
  const s = r / 44
  const by = cy - 4 * s
  const bx = cx - 13 * s
  const bw = 26 * s
  const bh = 22 * s
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
    // Top bun (rounded, tallish)
    `<rect x="${cx - 13 * s}" y="${cy - 15 * s}" width="${26 * s}" height="${9 * s}" rx="${5 * s}" fill="${color}"/>`,
    // Patty / filling (slightly wider, flat)
    `<rect x="${cx - 15 * s}" y="${cy - 3 * s}" width="${30 * s}" height="${6 * s}" rx="${2 * s}" fill="${color}"/>`,
    // Bottom bun
    `<rect x="${cx - 12 * s}" y="${cy + 6 * s}" width="${24 * s}" height="${9 * s}" rx="${4 * s}" fill="${color}"/>`,
  ].join('')
}

/** 💎 Gem / Diamond */
function renderGem(cx: number, cy: number, r: number, color: string): string {
  const s = r * 0.44
  const f = (x: number, y: number) =>
    `${(cx + x * s).toFixed(1)},${(cy + y * s).toFixed(1)}`
  // 7-point classic cut gem: flat table top → wide girdle → culet point
  const d =
    `M${f(-0.30, -1)}` +    // table left
    ` L${f(0.30, -1)}` +    // table right
    ` L${f(1, -0.28)}` +    // upper-right shoulder
    ` L${f(0.62, 0.12)}` +  // right girdle
    ` L${f(0, 1)}` +         // culet (bottom point)
    ` L${f(-0.62, 0.12)}` + // left girdle
    ` L${f(-1, -0.28)} Z`   // upper-left shoulder
  return `<path d="${d}" fill="${color}"/>`
}

/** 🎁 Gift box with bow */
function renderGift(cx: number, cy: number, r: number, color: string): string {
  const s = r / 44
  const lidTop = cy - 11 * s
  const lidBot = cy - 1 * s
  const bh = 18 * s
  const sw = 3.5 * s // stroke width for bow arcs
  return [
    // Box body
    `<rect x="${cx - 12 * s}" y="${lidBot}" width="${24 * s}" height="${bh}" rx="${2 * s}" fill="${color}"/>`,
    // Lid (slightly wider)
    `<rect x="${cx - 14 * s}" y="${lidTop}" width="${28 * s}" height="${10 * s}" rx="${2 * s}" fill="${color}"/>`,
    // Bow — left loop
    `<path d="M${cx},${lidTop} Q${cx - 12 * s},${lidTop - 7 * s} ${cx - 5 * s},${lidTop - 1 * s}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`,
    // Bow — right loop
    `<path d="M${cx},${lidTop} Q${cx + 12 * s},${lidTop - 7 * s} ${cx + 5 * s},${lidTop - 1 * s}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`,
  ].join('')
}

/** 🎵 Music note (filled head + stem + flag) */
function renderMusic(cx: number, cy: number, r: number, color: string): string {
  const s = r / 44
  const nhCx = cx - 4 * s        // note-head center x
  const nhCy = cy + 13 * s        // note-head center y
  const stemTop = cy - 17 * s     // top of stem
  const stemRight = nhCx + 8 * s  // right edge of stem
  const sw = 3 * s
  return [
    // Note head (slightly tilted ellipse)
    `<ellipse cx="${nhCx}" cy="${nhCy}" rx="${9 * s}" ry="${6.5 * s}" transform="rotate(-15 ${nhCx} ${nhCy})" fill="${color}"/>`,
    // Stem (vertical bar from head right edge up)
    `<rect x="${stemRight}" y="${stemTop}" width="${sw}" height="${nhCy - stemTop}" fill="${color}"/>`,
    // Flag (curved line from stem top)
    `<path d="M${stemRight + sw},${stemTop} Q${stemRight + sw + 14 * s},${stemTop + 8 * s} ${stemRight + sw + 8 * s},${stemTop + 18 * s}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`,
  ].join('')
}

/** 🍃 Leaf */
function renderLeaf(cx: number, cy: number, r: number, color: string): string {
  const s = r * 0.46
  const topY = cy - s * 0.95
  const botY = cy + s * 0.95
  // Pointed-oval leaf shape using symmetric cubic beziers
  const path =
    `M${cx.toFixed(1)},${topY.toFixed(1)}` +
    ` C${(cx + s).toFixed(1)},${(cy - s * 0.2).toFixed(1)} ${(cx + s).toFixed(1)},${(cy + s * 0.2).toFixed(1)} ${cx.toFixed(1)},${botY.toFixed(1)}` +
    ` C${(cx - s).toFixed(1)},${(cy + s * 0.2).toFixed(1)} ${(cx - s).toFixed(1)},${(cy - s * 0.2).toFixed(1)} ${cx.toFixed(1)},${topY.toFixed(1)} Z`
  // Center vein
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
  const scoopCy = cy - 10 * s   // center of scoop circle
  const scoopR = 13 * s          // scoop radius
  const coneTopY = cy + 2 * s    // where scoop meets cone
  const coneTipY = cy + 22 * s   // tip of cone
  const coneHW = 14 * s          // half-width of cone at top
  return [
    // Cone triangle (pointing down)
    `<path d="M${cx - coneHW},${coneTopY} L${cx + coneHW},${coneTopY} L${cx},${coneTipY} Z" fill="${color}"/>`,
    // Waffle grid hint on cone
    `<path d="M${cx - coneHW * 0.7},${coneTopY + 5 * s} L${cx + coneHW * 0.7},${coneTopY + 5 * s}" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="${1.5 * s}"/>`,
    `<path d="M${cx - coneHW * 0.4},${coneTopY + 12 * s} L${cx + coneHW * 0.4},${coneTopY + 12 * s}" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="${1.5 * s}"/>`,
    // Scoop (circle)
    `<circle cx="${cx}" cy="${scoopCy}" r="${scoopR}" fill="${color}"/>`,
  ].join('')
}

/**
 * Custom SVG icon.
 *
 * Acepta un SVG completo (etiqueta `<svg viewBox="...">…</svg>`) y lo incrusta
 * escalado y centrado dentro del círculo de sello.
 *
 * - Si el SVG tiene `viewBox`, se usa para escalar correctamente.
 * - Si no tiene `viewBox`, se asume `0 0 24 24` (estándar de íconos).
 * - Los colores del SVG original se preservan tal cual.
 */
function renderCustom(svgContent: string, cx: number, cy: number, r: number): string {
  // Extraer viewBox del SVG (si existe)
  const vbMatch = svgContent.match(/viewBox=["']([^"']+)["']/i)
  const viewBox = vbMatch ? vbMatch[1] : '0 0 24 24'

  // Extraer el contenido interno (sin el tag <svg ...> externo)
  const inner = svgContent
    .replace(/<svg[^>]*>/gi, '')
    .replace(/<\/svg>/gi, '')
    .trim()

  if (!inner) return ''

  // Padding del 12 % del radio para que el ícono no roce el borde del círculo
  const pad = r * 0.12
  const size = (r - pad) * 2
  const x = cx - r + pad
  const y = cy - r + pad

  return `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" viewBox="${viewBox}">${inner}</svg>`
}

/** 🌸 Flower (5 petal circles + center) */
function renderFlower(cx: number, cy: number, r: number, color: string): string {
  const s = r * 0.44
  const dist = s * 0.50     // petal center distance from origin
  const petalR = s * 0.43   // petal circle radius
  let petals = ''
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
    const px = cx + Math.cos(angle) * dist
    const py = cy + Math.sin(angle) * dist
    petals += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${petalR.toFixed(1)}" fill="${color}"/>`
  }
  // Center circle (slightly smaller than petals to show petal overlap)
  petals += `<circle cx="${cx}" cy="${cy}" r="${(s * 0.30).toFixed(1)}" fill="${color}"/>`
  return petals
}

// ── Active icon dispatcher ──────────────────────────────────────────────────

/**
 * Returns the SVG elements to render inside a stamp circle.
 * All built-in icons are pure SVG paths — no Unicode text — for reliable resvg rendering.
 * When `icon === 'custom'`, embeds the caller-provided `customSvg` string scaled to the circle.
 */
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
  primaryColor: string,
  cols: number,
  icon: StampIcon,
  customSvg?: string,
): string {
  const palette = stripPalette(primaryColor)

  // Active icon color: brand color when it contrasts well on white; otherwise near-black.
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
      // ── Stamped: bright white circle + colored icon ──────────────────────
      circles += `<circle cx="${cx}" cy="${cy}" r="${CIRCLE_R}" fill="rgba(255,255,255,0.97)"/>`
      circles += renderActiveIcon(icon, cx, cy, CIRCLE_R, activeIconColor, customSvg)
    } else {
      // ── Pending: ghost circle with clearly visible border + faint icon ───
      circles += `<circle cx="${cx}" cy="${cy}" r="${CIRCLE_R}" fill="${palette.container}" stroke="${palette.stampBorder}" stroke-width="2.5"/>`
      circles += renderActiveIcon(icon, cx, cy, CIRCLE_R, palette.stampGhost, customSvg)
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
  const { cols, rows } = computeGrid(total)
  const totalGridH = rows * CIRCLE_STEP - CIRCLE_GAP
  const H = PAD_TOP + totalGridH + TEXT_PAD + TEXT_SIZE + PAD_BOTTOM

  const circles = buildCircles(current, total, primaryColor, cols, icon, customSvg)
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
