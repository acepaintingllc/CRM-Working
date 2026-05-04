import {
  normalizeQuoteDefaults,
  validateQuoteDefaults,
  type QuoteDefaultsProductReference,
} from '../../quotes/defaultsForm.ts'
import type { QuoteDefaults } from '../../settings/types.ts'
import {
  activateDraftSettingSet,
  cloneActiveSettingSetAsDraft,
  loadActiveSettingSet,
  settingValuesToEstimateTemplateSettings,
  updateDraftSettingValues,
  type EstimatorSettingSetSnapshot,
} from '../estimate-feedback/settingSets.ts'
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
  loadActiveSettingSet: typeof loadActiveSettingSet
  cloneActiveSettingSetAsDraft: typeof cloneActiveSettingSetAsDraft
  updateDraftSettingValues: typeof updateDraftSettingValues
  activateDraftSettingSet: typeof activateDraftSettingSet
}

export class QuoteDefaultsValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuoteDefaultsValidationError'
  }
}

const defaultDeps: QuoteDefaultsStoreDeps = {
  client: supabaseAdmin,
  loadActiveSettingSet,
  cloneActiveSettingSetAsDraft,
  updateDraftSettingValues,
  activateDraftSettingSet,
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
  const allDeps = withDeps(deps)
  const { client } = allDeps
  const active = await allDeps.loadActiveSettingSet({ orgId })
  if (active) {
    return normalizeQuoteDefaults(settingValuesToEstimateTemplateSettings(active) as Unsafe)
  }

  // Compatibility fallback only for orgs not yet backfilled to setting sets.
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
  userIdOrDeps: string | Partial<QuoteDefaultsStoreDeps> = 'system',
  maybeDeps: Partial<QuoteDefaultsStoreDeps> = {}
) {
  const userId = typeof userIdOrDeps === 'string' ? userIdOrDeps : 'system'
  const deps = typeof userIdOrDeps === 'string' ? maybeDeps : userIdOrDeps
  const allDeps = withDeps(deps)
  const { client } = allDeps
  const productReferences = await loadQuoteDefaultsProductReferences(orgId, data, deps)
  const validation = validateQuoteDefaults(data, { products: productReferences })
  if (!validation.ok) {
    throw new QuoteDefaultsValidationError(validation.error)
  }

  const draft = await allDeps.cloneActiveSettingSetAsDraft({
    orgId,
    userId,
    notes: 'Quote defaults draft',
  })
  if (!draft) throw new Error('Failed to create quote defaults setting draft.')

  const updated = await allDeps.updateDraftSettingValues({
    orgId,
    settingSetId: draft.set.id,
    values: quoteDefaultsToScalarValues(data, draft),
  })
  if (!updated) throw new Error('Failed to update quote defaults setting draft.')

  const activated = await allDeps.activateDraftSettingSet({
    orgId,
    settingSetId: updated.set.id,
    userId,
    reason: 'Quote defaults saved',
    source: 'quote_defaults_admin',
  })
  if (!activated) throw new Error('Failed to activate quote defaults setting set.')

  await mirrorQuoteDefaultsCompatibility(client, orgId, data)

  const normalized = normalizeQuoteDefaults(
    settingValuesToEstimateTemplateSettings(activated) as Unsafe
  )
  return normalized
}

function quoteDefaultsToScalarValues(
  data: QuoteDefaults,
  draft: EstimatorSettingSetSnapshot
) {
  const keys: Array<keyof QuoteDefaults> = [
    'walls_paint_id',
    'walls_primer_id',
    'ceiling_paint_id',
    'ceiling_primer_id',
    'trim_paint_id',
    'trim_primer_id',
    'override_labor_rate',
  ]

  return keys.map((key, index) => {
    const existing = draft.values.find(
      (value) => value.category_key === 'scalar_defaults' && value.scalar_key === key
    )
    return {
      category_key: 'scalar_defaults',
      scalar_key: key,
      row_id: null,
      display_name: existing?.display_name ?? key,
      active: true,
      sort_order: existing?.sort_order ?? index,
      value_json: { value: data[key] },
    }
  })
}

async function mirrorQuoteDefaultsCompatibility(
  client: QuoteDefaultsStoreDeps['client'],
  orgId: string,
  data: QuoteDefaults
) {
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

  if (res.error) {
    console.error('[quote-defaults] compatibility mirror failed', res.error.message)
  }
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
