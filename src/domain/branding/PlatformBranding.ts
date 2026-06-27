/**
 * Sello de plataforma "Hecho con TriboWallet" que aparece en los pases de los
 * planes sin white-label. Es el motor de adquisición: cada pase instalado se
 * vuelve una superficie con un CTA medible.
 */
export interface PlatformBranding {
  /** Texto visible del sello / CTA. */
  label: string
  /** URL de la landing, con atribución (?ref) y UTMs para medir conversiones. */
  url: string
}

/**
 * Construye el enlace de atribución: `ref` identifica al negocio que originó la
 * visita (base para un futuro programa de referidos) y los UTMs marcan el canal.
 */
export function buildBrandingUrl(baseUrl: string, organizationId: string): string {
  const ref = encodeURIComponent(organizationId)
  return `${baseUrl}?ref=${ref}&utm_source=wallet&utm_medium=pass&utm_campaign=powered_by`
}
