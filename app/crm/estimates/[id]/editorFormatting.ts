export function toText(v: unknown) {
  return v == null ? '' : String(v)
}

export function toNumString(v: unknown) {
  if (v == null || v === '') return ''
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : ''
}

export function toYN(v: unknown, fallback: 'Y' | 'N' = 'N'): 'Y' | 'N' {
  return String(v ?? '').toUpperCase() === 'Y' ? 'Y' : fallback
}

export function normalizePrimerMode(value: unknown): '' | 'Spot' | 'Full' {
  const v = toText(value).trim().toLowerCase()
  if (v === 'spot') return 'Spot'
  if (v === 'full' || v === 'yes' || v === 'y') return 'Full'
  return ''
}

export function primerModeEnabled(value: unknown) {
  return normalizePrimerMode(value) !== ''
}

export function normalizeColorId(v: string) {
  return v.toUpperCase().replace(/[^A-Z]/g, '')
}

export function formatCurrency(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n)
}

export function calcRectPerimeterLf(lengthIn: string, widthIn: string) {
  const l = Number(lengthIn)
  const w = Number(widthIn)
  if (!Number.isFinite(l) || !Number.isFinite(w)) return ''
  return String((2 * (l + w)) / 12)
}

export function paintOptionLabel(p: {
  label: string
  price_per_gal: number | null
  coverage_sqft_per_gal_per_coat: number | null
}) {
  const bits = [p.label]
  if (p.price_per_gal != null) bits.push(`$${p.price_per_gal}/gal`)
  if (p.coverage_sqft_per_gal_per_coat != null) bits.push(`${p.coverage_sqft_per_gal_per_coat} sqft/gal`)
  return bits.join(' - ')
}

export function trimOptionLabel(item: { label: string; unit: string | null }) {
  const unit = toText(item.unit).toUpperCase()
  return unit ? `${item.label} (${unit})` : item.label
}
