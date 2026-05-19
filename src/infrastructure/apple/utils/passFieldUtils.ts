export type RecentTransaction = { label: string; value: string }

export type PassField = {
  key: string
  label: string
  value: string
  textAlignment?: 'PKTextAlignmentLeft' | 'PKTextAlignmentCenter' | 'PKTextAlignmentRight' | 'PKTextAlignmentNatural'
}

export function txBackFields(txs: RecentTransaction[]): PassField[] {
  return txs.map((tx, i) => ({ key: `tx_${i}`, label: tx.label, value: tx.value }))
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
