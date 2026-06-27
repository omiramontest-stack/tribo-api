/**
 * Value Object de personalización visual de una wallet.
 *
 * Es la única fuente de verdad del aspecto del pase. Se diseña una sola vez y se
 * reutiliza: el `theme` base de la wallet y, más adelante, el `config` de cada
 * nivel (tier) son ambos un {@link WalletThemeOverrides}.
 *
 * Restricción del formato: ni Apple Wallet ni Google Wallet permiten fuentes
 * personalizadas en el pase nativo. `typography` solo aplica a los assets que
 * renderizamos (strips SVG→PNG) y a la vista web — no a los labels nativos.
 */

export type BarcodeFormat = 'qr' | 'pdf417' | 'code128'

/** Set curado de tipografías embebibles (controlamos licencia y peso). */
export type FontKey = 'system' | 'rounded' | 'serif' | 'mono'

export interface WalletThemeColors {
  /** Fondo del pase. Default: `primaryColor` de la wallet. */
  background: string
  /** Color de los valores/textos principales. Default: blanco. */
  foreground: string
  /** Color de las etiquetas. Default: blanco. */
  label: string
  /** Color de acento (degradados, detalles). Default: `accentColor` de la wallet. */
  accent: string
  /** Segundo stop del degradado de fondo. Default: `null` (fondo plano). */
  gradientTo: string | null
}

export interface WalletThemeAssets {
  /** Logo/icono. Default: `logoUrl` de la wallet. */
  logoUrl: string | null
  /** Imagen de strip/hero personalizada. Default: `null` (se usa el generado). */
  stripImageUrl: string | null
}

export interface WalletThemeBarcode {
  /** Formato del código. Default: `qr`. */
  format: BarcodeFormat
  /** Texto alternativo mostrado bajo el código. Default: `null`. */
  altText: string | null
}

/** Datos de contacto enriquecidos para el reverso del pase. */
export interface WalletThemeBack {
  website: string | null
  phone: string | null
  address: string | null
  instagram: string | null
}

/** Theme totalmente resuelto — sin opcionales. Lo que consume el render. */
export interface WalletTheme {
  colors: WalletThemeColors
  typography: { fontKey: FontKey }
  assets: WalletThemeAssets
  barcode: WalletThemeBarcode
  back: WalletThemeBack
}

/**
 * Lo que el negocio guarda: todo opcional. Se fusiona sobre los defaults, de modo
 * que una wallet sin `theme` (todas las de producción hoy) se renderiza idéntica.
 */
export interface WalletThemeOverrides {
  colors?: Partial<WalletThemeColors>
  typography?: Partial<WalletTheme['typography']>
  assets?: Partial<WalletThemeAssets>
  barcode?: Partial<WalletThemeBarcode>
  back?: Partial<WalletThemeBack>
}

/**
 * Fusiona dos conjuntos de overrides sección por sección, con `override` ganando
 * sobre `base`. Lo usa cada nivel para heredar el branding de la wallet y
 * sobreescribir solo lo que cambia. El resultado se pasa a {@link resolveWalletTheme}.
 */
export function mergeThemeOverrides(
  base: WalletThemeOverrides | null,
  override: WalletThemeOverrides | null,
): WalletThemeOverrides {
  const b = base ?? {}
  const o = override ?? {}
  return {
    colors: { ...b.colors, ...o.colors },
    typography: { ...b.typography, ...o.typography },
    assets: { ...b.assets, ...o.assets },
    barcode: { ...b.barcode, ...o.barcode },
    back: { ...b.back, ...o.back },
  }
}

import { contrastRatio } from './colorContrast.js'

const DEFAULT_TEXT_COLOR = '#FFFFFF'

/** Contraste mínimo WCAG AA para texto. */
export const MIN_TEXT_CONTRAST = 4.5

export interface ContrastViolation {
  field: 'foreground' | 'label'
  ratio: number
}

/**
 * Detecta colores de texto **elegidos explícitamente** por el negocio que no
 * alcanzan el contraste mínimo sobre el fondo. El blanco por defecto se omite a
 * propósito: el guard `ensureWcagContrast` del render ya oscurece el fondo para
 * garantizar su legibilidad, así que validarlo aquí daría falsos positivos.
 */
export function customTextContrastViolations(
  overrides: WalletThemeOverrides | null,
  fallbackBackground: string,
): ContrastViolation[] {
  const colors = overrides?.colors
  if (!colors) return []

  const background = colors.background ?? fallbackBackground
  const violations: ContrastViolation[] = []

  for (const field of ['foreground', 'label'] as const) {
    const color = colors[field]
    if (!color) continue
    const ratio = contrastRatio(color, background)
    if (ratio < MIN_TEXT_CONTRAST) violations.push({ field, ratio: Math.round(ratio * 100) / 100 })
  }

  return violations
}

/** Campos base de la wallet de los que se derivan los defaults del theme. */
export interface ThemeableWallet {
  primaryColor: string
  accentColor: string
  logoUrl: string | null
  theme?: WalletThemeOverrides | null
}

/**
 * Resuelve el theme efectivo fusionando los overrides del negocio sobre los
 * defaults derivados de la wallet. Sin overrides el resultado equivale 1:1 al
 * comportamiento previo (fondo = primaryColor, texto/label blanco, QR, fondo plano).
 */
export function resolveWalletTheme(wallet: ThemeableWallet): WalletTheme {
  const o = wallet.theme ?? {}
  return {
    colors: {
      background: o.colors?.background ?? wallet.primaryColor,
      foreground: o.colors?.foreground ?? DEFAULT_TEXT_COLOR,
      label: o.colors?.label ?? DEFAULT_TEXT_COLOR,
      accent: o.colors?.accent ?? wallet.accentColor,
      gradientTo: o.colors?.gradientTo ?? null,
    },
    typography: { fontKey: o.typography?.fontKey ?? 'system' },
    assets: {
      logoUrl: o.assets?.logoUrl ?? wallet.logoUrl,
      stripImageUrl: o.assets?.stripImageUrl ?? null,
    },
    barcode: {
      format: o.barcode?.format ?? 'qr',
      altText: o.barcode?.altText ?? null,
    },
    back: {
      website: o.back?.website ?? null,
      phone: o.back?.phone ?? null,
      address: o.back?.address ?? null,
      instagram: o.back?.instagram ?? null,
    },
  }
}
