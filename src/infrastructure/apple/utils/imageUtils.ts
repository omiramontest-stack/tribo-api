import { Resvg } from '@resvg/resvg-js'

export function svgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, { fitTo: { mode: 'original' } })
  return Buffer.from(resvg.render().asPng())
}

export async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

export function inferMimeType(url: string): string {
  return url.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
}

export const PLACEHOLDER_ICON = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
)
