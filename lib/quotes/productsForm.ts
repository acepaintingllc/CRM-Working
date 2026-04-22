export type ProductStatus = 'Active' | 'Inactive' | 'Archived'
export type ProductFamily = 'Paint' | 'Primer'

export type QuoteProductRow = {
  id: string
  name: string
  family?: string | null
  base?: string | null
  subtype?: string | null
  cost_per_unit?: number | null
  coverage_sqft_per_gal_per_coat?: number | null
  efficiency_pct?: number | null
  default_coats?: number | null
  default_sheen?: string | null
  default_scopes?: string[] | null
  notes?: string | null
  status: ProductStatus
  created_at: string
  updated_at: string
}

export type QuoteProductFormValues = Partial<QuoteProductRow>

export function quoteProductToFormValues(product: QuoteProductRow): QuoteProductFormValues {
  return {
    name: product.name,
    family: product.family,
    base: product.base,
    subtype: product.subtype,
    cost_per_unit: product.cost_per_unit,
    coverage_sqft_per_gal_per_coat: product.coverage_sqft_per_gal_per_coat,
    efficiency_pct: product.efficiency_pct,
    default_coats: product.default_coats,
    default_sheen: product.default_sheen,
    default_scopes: product.default_scopes || [],
    notes: product.notes,
    status: product.status,
  }
}

export function validateQuoteProductFormValues(values: QuoteProductFormValues) {
  if (!String(values.name ?? '').trim()) {
    return {
      ok: false as const,
      error: 'Product name is required.',
    }
  }

  return {
    ok: true as const,
    value: {
      ...values,
      name: String(values.name).trim(),
      default_scopes: values.default_scopes ?? [],
    },
  }
}
