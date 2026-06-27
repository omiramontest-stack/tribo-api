export type RecentTransaction = { label: string; value: string }

export type PassField = {
  key: string
  label: string
  value: string
  textAlignment?: 'PKTextAlignmentLeft' | 'PKTextAlignmentCenter' | 'PKTextAlignmentRight' | 'PKTextAlignmentNatural'
  changeMessage?: string
}

export function txBackFields(txs: RecentTransaction[]): PassField[] {
  return txs.map((tx, i) => ({ key: `tx_${i}`, label: tx.label, value: tx.value }))
}

/** Devuelve un backField con el último mensaje de campaña, o array vacío si no hay. */
export function campaignMessageBackField(passData: Record<string, unknown>): PassField[] {
  const msg = passData.lastMessage as string | undefined
  if (!msg) return []
  return [{ key: 'campaign_msg', label: 'Último mensaje', value: msg, changeMessage: '%@' }]
}

/** Devuelve un backField con las reglas del negocio, o array vacío si no hay. */
export function businessRulesBackField(businessRules: string | null | undefined): PassField[] {
  if (!businessRules?.trim()) return []
  return [{ key: 'business_rules', label: 'Términos y condiciones', value: businessRules }]
}

/** Datos de contacto del theme (web, teléfono, dirección, Instagram) como backFields. */
export function themeBackFields(back: {
  website: string | null
  phone: string | null
  address: string | null
  instagram: string | null
}): PassField[] {
  const entries: [string, string, string | null][] = [
    ['contact_website', 'Sitio web', back.website],
    ['contact_phone', 'Teléfono', back.phone],
    ['contact_address', 'Dirección', back.address],
    ['contact_instagram', 'Instagram', back.instagram],
  ]
  return entries
    .filter((e): e is [string, string, string] => !!e[2]?.trim())
    .map(([key, label, value]) => ({ key, label, value }))
}

export function formatCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`
}

export function formatDate(isoDate: string, locale = 'es-MX'): string {
  return new Date(isoDate).toLocaleDateString(locale)
}

export function formatLongDate(isoDate: string, locale = 'es-MX'): string {
  return new Date(isoDate).toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`
}
