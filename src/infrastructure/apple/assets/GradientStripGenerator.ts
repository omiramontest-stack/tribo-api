import { svgToPng } from '../utils/imageUtils.js'
import { PassDesignConfig } from '../PassDesignConfig.js'
import type { StripGenerator, StripSet } from './StripGenerator.js'
import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'

const { width: W, height: H } = PassDesignConfig.strip

// 3x of Apple's recommended 180×220 pt background image
const BG_W = 540
const BG_H = 660

export class GradientStripGenerator implements StripGenerator {
  async generate(wallet: Wallet, _pass: Pass): Promise<StripSet> {
    const strip = renderStrip(wallet.primaryColor, wallet.accentColor)
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

function renderStrip(primaryColor: string, accentColor: string): Buffer {
  // Diagonal gradient + radial overlay matching the design reference
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${primaryColor}"/>
        <stop offset="100%" stop-color="${accentColor}"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#grad)"/>
    <circle cx="${W}" cy="0" r="${Math.round(H * 0.95)}" fill="${accentColor}" fill-opacity="0.5"/>
    <circle cx="0" cy="${H}" r="${Math.round(H * 0.65)}" fill="${accentColor}" fill-opacity="0.13"/>
  </svg>`
  return svgToPng(svg)
}

function renderBackground(primaryColor: string, accentColor: string): Buffer {
  // iOS blurs + darkens this image, so we use large radial blooms:
  // — main bloom (top-right, accent at 90%): becomes a warm glow after blur
  // — secondary bloom (bottom-left, accent at 40%): creates depth and warmth
  // The blur erases hard edges; the bigger the shapes, the richer the result.
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

// Convenience wrapper kept for builders not yet on the StripGenerator interface.
export function buildGradientStripSet(primaryColor: string, accentColor: string): Record<string, Buffer> {
  const strip = renderStrip(primaryColor, accentColor)
  return { 'strip.png': strip, 'strip@2x.png': strip, 'strip@3x.png': strip }
}
