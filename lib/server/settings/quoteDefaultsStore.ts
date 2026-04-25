import {
  normalizeQuoteDefaults,
  validateQuoteDefaults,
  type QuoteDefaultsProductReference,
} from '../../quotes/defaultsForm.ts'
import type { QuoteDefaults } from '../../settings/types.ts'
import { supabaseAdmin } from '../org.ts'

type Unsafe = Record<string, unknown>

type QueryError = {
  message: string
}

type MaybeSingleResult = {
  data: Unsafe | null
  error: QueryError | null
}

type SingleResult = {
  data: Unsafe | null
  error: QueryError | null
}

type ProductReferencesResult = {
  data: QuoteDefaultsProductReference[] | null
  error: QueryError | null
}

type SettingsQuery = {
  select(columns: string): SettingsQuery
  eq(column: string, value: string): SettingsQuery
  maybeSingle(): Promise<MaybeSingleResult>
  single(): Promise<SingleResult>
  upsert(payload: Record<string, unknown>, options: { onConflict: string }): SettingsQuery
  in(column: string, values: string[]): Promise<ProductReferencesResult>
}

export type QuoteDefaultsStoreDeps = {
  client: {
    from(relation: string): unknown
  }
}

export class QuoteDefaultsValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuoteDefaultsValidationError'
  }
}

const defaultDeps: QuoteDefaultsStoreDeps = {
  client: supabaseAdmin,
}

function withDeps(overrides: Partial<QuoteDefaultsStoreDeps> = {}): QuoteDefaultsStoreDeps {
  return {
    ...defaultDeps,
    ...overrides,
  }
}

export async function loadQuoteDefaults(
  orgId: string,
  deps: Partial<QuoteDefaultsStoreDeps> = {}
) {
  const { client } = withDeps(deps)
  const res = await (client.from('estimate_template_settings') as SettingsQuery)
    .select(
      'walls_paint_id, walls_primer_id, ceiling_paint_id, ceiling_primer_id, trim_paint_id, trim_primer_id, override_labor_rate'
    )
    .eq('org_id', orgId)
    .maybeSingle()

  if (res.error) throw new Error(res.error.message)
  return normalizeQuoteDefaults((res.data ?? null) as Unsafe | null)
}

export async function saveQuoteDefaults(
  orgId: string,
  data: QuoteDefaults,
  deps: Partial<QuoteDefaultsStoreDeps> = {}
) {
  const { client } = withDeps(deps)
  const productReferences = await loadQuoteDefaultsProductReferences(orgId, data, deps)
  const validation = validateQuoteDefaults(data, { products: productReferences })
  if (!validation.ok) {
    throw new QuoteDefaultsValidationError(validation.error)
  }

  const res = await (client.from('estimate_template_settings') as SettingsQuery)
    .upsert(
      {
        org_id: orgId,
        ...data,
      },
      { onConflict: 'org_id' }
    )
    .select(
      'walls_paint_id, walls_primer_id, ceiling_paint_id, ceiling_primer_id, trim_paint_id, trim_primer_id, override_labor_rate'
    )
    .single()

  if (res.error) throw new Error(res.error.message)
  return normalizeQuoteDefaults(res.data as Unsafe | null)
}

async function loadQuoteDefaultsProductReferences(
  orgId: string,
  data: QuoteDefaults,
  deps: Partial<QuoteDefaultsStoreDeps>
) {
  const productIds = [
    data.walls_paint_id,
    data.walls_primer_id,
    data.ceiling_paint_id,
    data.ceiling_primer_id,
    data.trim_paint_id,
    data.trim_primer_id,
  ].filter((value): value is string => Boolean(value))

  const uniqueProductIds = [...new Set(productIds)]
  if (uniqueProductIds.length === 0) return []

  const { client } = withDeps(deps)
  const res = await (client.from('v2_products') as SettingsQuery)
    .select('id, name, family, status')
    .eq('org_id', orgId)
    .in('id', uniqueProductIds)

  if (res.error) throw new Error(res.error.message)
  return res.data ?? []
}
