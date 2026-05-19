import { svgToPng, fetchImageBuffer, inferMimeType } from '../utils/imageUtils.js'

const STRIP_W = 750
const STRIP_H = 246

export async function buildDaypassStrip(
  imageUrl: string | null,
  primaryColor: string,
  accentColor: string,
): Promise<Buffer> {
  if (imageUrl) {
    const imgBuf = await fetchImageBuffer(imageUrl)
    if (imgBuf) {
      const b64 = imgBuf.toString('base64')
      const mime = inferMimeType(imageUrl)
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${STRIP_W}" height="${STRIP_H}">
        <image href="data:${mime};base64,${b64}" x="0" y="0" width="${STRIP_W}" height="${STRIP_H}" preserveAspectRatio="xMidYMid slice"/>
        <rect width="${STRIP_W}" height="${STRIP_H}" fill="rgba(0,0,0,0.38)"/>
      </svg>`
      return svgToPng(svg)
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${STRIP_W}" height="${STRIP_H}">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${primaryColor}"/>
        <stop offset="100%" stop-color="${accentColor}"/>
      </linearGradient>
    </defs>
    <rect width="${STRIP_W}" height="${STRIP_H}" fill="url(#grad)"/>
    <circle cx="80"              cy="80"           r="150" fill="rgba(255,255,255,0.06)"/>
    <circle cx="${STRIP_W - 60}" cy="${STRIP_H}"    r="120" fill="rgba(255,255,255,0.06)"/>
  </svg>`

  return svgToPng(svg)
}

export async function buildDaypassStripSet(
  imageUrl: string | null,
  primaryColor: string,
  accentColor: string,
): Promise<Record<string, Buffer>> {
  const strip = await buildDaypassStrip(imageUrl, primaryColor, accentColor)
  return {
    'strip.png': strip,
    'strip@2x.png': strip,
    'strip@3x.png': strip,
  }
}
