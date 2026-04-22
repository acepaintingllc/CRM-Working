import type { QuoteProductRow } from '@/lib/quotes/productsForm'

export const QUOTE_PRODUCT_SCOPE_OPTIONS = [
  'Walls',
  'Ceilings',
  'Trim',
  'Doors',
  'Cabinetry',
  'Other',
] as const

export function formatQuoteProductMeta(product: QuoteProductRow) {
  return `${product.base ?? 'N/A'} / ${product.subtype ?? 'N/A'}`
}

export function formatQuoteProductStats(product: QuoteProductRow) {
  return `Cost: $${Number(product.cost_per_unit ?? 0).toFixed(2)} | Coverage: ${
    product.coverage_sqft_per_gal_per_coat ?? 'N/A'
  }`
}
