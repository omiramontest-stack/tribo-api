/**
 * Constantes de diseño para imágenes de Apple Wallet.
 *
 * Todas las medidas están en píxeles @2x.
 * Apple renderiza el strip en la zona de contenido de la tarjeta y
 * superpone los primaryFields ENCIMA de él; por eso los builders que
 * tienen contenido visual en el strip deben omitir los primaryFields.
 *
 * Tamaños de referencia de Apple (@2x):
 *   strip.png  →  750 × hasta 576 px  (storeCard)
 *   icon.png   →  58 × 58 px
 *   logo.png   →  320 × 100 px
 */
export const PassDesignConfig = {
  strip: {
    /** Ancho estándar del strip @2x (= 375 pt). */
    width: 750,
    /** Alto estándar del strip @2x para passes con contenido visual (≈ 144 pt). */
    height: 288,
  },
  stamps: {
    /** Radio de cada círculo de sello en px @2x. */
    circleRadius: 38,
    /** Espacio entre círculos en px @2x. */
    circleGap: 18,
    /** Padding superior dentro del strip en px @2x. */
    paddingTop: 48,
  },
} as const
