export const QUOTE_PRODUCT_STATUSES = ['Active', 'Inactive', 'Archived'] as const
export const QUOTE_PRODUCT_STATUS_FILTERS = ['active', 'inactive', 'archived', 'all'] as const
export const QUOTE_PRODUCT_FAMILIES = ['Paint', 'Primer'] as const
export const QUOTE_PRODUCT_SHEEN_OPTIONS = [
  'Eggshell',
  'Satin',
  'Flat',
  'Semi-Gloss',
  'N/A',
] as const
export const QUOTE_PRODUCT_SCOPE_OPTIONS = [
  'Walls',
  'Ceilings',
  'Trim',
  'Doors',
  'Cabinetry',
  'Other',
] as const
export const QUOTE_PRODUCT_SCOPE_FILTERS = ['all', ...QUOTE_PRODUCT_SCOPE_OPTIONS] as const

export type ProductStatus = (typeof QUOTE_PRODUCT_STATUSES)[number]
export type QuoteProductStatusFilter = (typeof QUOTE_PRODUCT_STATUS_FILTERS)[number]
export type ProductFamily = (typeof QUOTE_PRODUCT_FAMILIES)[number]
export type QuoteProductSheen = (typeof QUOTE_PRODUCT_SHEEN_OPTIONS)[number]
export type QuoteProductScope = (typeof QUOTE_PRODUCT_SCOPE_OPTIONS)[number]
export type QuoteProductScopeFilter = (typeof QUOTE_PRODUCT_SCOPE_FILTERS)[number]

export type QuoteProductQuery = {
  status: QuoteProductStatusFilter
  family?: ProductFamily | null
  scope?: QuoteProductScope | null
  search?: string | null
}

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

export type QuoteProductDraft = {
  name: string
  family: string
  base: string
  subtype: string
  cost_per_unit: string
  coverage_sqft_per_gal_per_coat: string
  efficiency_pct: string
  default_coats: string
  default_sheen: string
  default_scopes: string[]
  notes: string
  status: string
}

export type QuoteProductPayload = {
  name: string
  family: ProductFamily
  base: string | null
  subtype: string | null
  cost_per_unit: number | null
  coverage_sqft_per_gal_per_coat: number | null
  efficiency_pct: number | null
  default_coats: number | null
  default_sheen: QuoteProductSheen | null
  default_scopes: QuoteProductScope[]
  notes: string | null
  status: ProductStatus
}

export type QuoteProductValidationErrors = Partial<Record<keyof QuoteProductDraft, string>>

export type QuoteProductValidationState = {
  ok: boolean
  summary: string | null
  fields: QuoteProductValidationErrors
}

export type QuoteProductDraftSnapshot = {
  key: string
}

type ParsedNumber = {
  valid: boolean
  value: number | null
}

type DraftToPayloadResult =
  | {
      ok: true
      value: QuoteProductPayload
    }
  | {
      ok: false
      fields: QuoteProductValidationErrors
    }

type QuoteProductValidationResult =
  | {
      ok: true
      draft: QuoteProductDraft
      payload: QuoteProductPayload
      validation: QuoteProductValidationState
    }
  | {
      ok: false
      draft: QuoteProductDraft
      validation: QuoteProductValidationState
    }

const QUOTE_PRODUCT_SCOPE_SET = new Set<string>(QUOTE_PRODUCT_SCOPE_OPTIONS)
const QUOTE_PRODUCT_SCOPE_FILTER_SET = new Set<string>(QUOTE_PRODUCT_SCOPE_FILTERS)
const QUOTE_PRODUCT_FAMILY_SET = new Set<string>(QUOTE_PRODUCT_FAMILIES)
const QUOTE_PRODUCT_SHEEN_SET = new Set<string>(QUOTE_PRODUCT_SHEEN_OPTIONS)
const QUOTE_PRODUCT_STATUS_SET = new Set<string>(QUOTE_PRODUCT_STATUSES)
const QUOTE_PRODUCT_STATUS_FILTER_SET = new Set<string>(QUOTE_PRODUCT_STATUS_FILTERS)

const EMPTY_QUOTE_PRODUCT_DRAFT: QuoteProductDraft = {
  name: '',
  family: 'Paint',
  base: '',
  subtype: '',
  cost_per_unit: '',
  coverage_sqft_per_gal_per_coat: '',
  efficiency_pct: '',
  default_coats: '',
  default_sheen: 'N/A',
  default_scopes: [],
  notes: '',
  status: 'Active',
}

export function createEmptyQuoteProductDraft(): QuoteProductDraft {
  return { ...EMPTY_QUOTE_PRODUCT_DRAFT }
}

export function createQuoteProductDraftSnapshot(
  draft: Partial<QuoteProductDraft> | null | undefined
): QuoteProductDraftSnapshot {
  const normalized = normalizeQuoteProductDraft(draft)
  return {
    key: JSON.stringify({
      ...normalized,
      default_scopes: [...normalized.default_scopes].sort(),
    }),
  }
}

export function areQuoteProductDraftSnapshotsEqual(
  left: QuoteProductDraftSnapshot | null | undefined,
  right: QuoteProductDraftSnapshot | null | undefined
): boolean {
  return (left?.key ?? '') === (right?.key ?? '')
}

export function isQuoteProductStatus(value: string | null | undefined): value is ProductStatus {
  return QUOTE_PRODUCT_STATUS_SET.has(String(value ?? '').trim())
}

export function normalizeQuoteProductStatus(
  value: string | null | undefined,
  fallback: ProductStatus = 'Active'
): ProductStatus {
  const normalized = String(value ?? '').trim()
  return isQuoteProductStatus(normalized) ? normalized : fallback
}

export function normalizeQuoteProductStatusFilter(
  value: string | null | undefined,
  fallback: QuoteProductStatusFilter = 'active'
): QuoteProductStatusFilter {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
  return QUOTE_PRODUCT_STATUS_FILTER_SET.has(normalized) ? (normalized as QuoteProductStatusFilter) : fallback
}

export function isQuoteProductScope(value: string | null | undefined): value is QuoteProductScope {
  return QUOTE_PRODUCT_SCOPE_SET.has(String(value ?? '').trim())
}

export function normalizeQuoteProductScopeFilter(
  value: string | null | undefined,
  fallback: QuoteProductScopeFilter = 'all'
): QuoteProductScopeFilter {
  const normalized = String(value ?? '').trim()
  return QUOTE_PRODUCT_SCOPE_FILTER_SET.has(normalized)
    ? (normalized as QuoteProductScopeFilter)
    : fallback
}

export function isQuoteProductFamily(value: string | null | undefined): value is ProductFamily {
  return QUOTE_PRODUCT_FAMILY_SET.has(String(value ?? '').trim())
}

export function normalizeQuoteProductFamily(
  value: string | null | undefined,
  fallback: ProductFamily = 'Paint'
): ProductFamily {
  const normalized = String(value ?? '').trim()
  return isQuoteProductFamily(normalized) ? normalized : fallback
}

export function normalizeQuoteProductSearch(value: string | null | undefined) {
  return String(value ?? '').trim()
}

export function quoteProductMatchesQuery(product: QuoteProductRow, query: QuoteProductQuery) {
  if (query.family && product.family !== query.family) return false
  if (query.scope && !(product.default_scopes ?? []).includes(query.scope)) return false

  if (query.status !== 'all') {
    const normalizedStatus = product.status.toLowerCase()
    if (normalizedStatus !== query.status) return false
  }

  const search = normalizeQuoteProductSearch(query.search)
  if (!search) return true

  const haystack =
    `${product.name} ${product.base ?? ''} ${product.subtype ?? ''} ${(product.default_scopes ?? []).join(' ')} ${product.notes ?? ''} ${product.status}`.toLowerCase()
  return haystack.includes(search.toLowerCase())
}

export function quoteProductRowToDraft(product: QuoteProductRow): QuoteProductDraft {
  return normalizeQuoteProductDraft({
    name: product.name,
    family: product.family ?? EMPTY_QUOTE_PRODUCT_DRAFT.family,
    base: product.base ?? '',
    subtype: product.subtype ?? '',
    cost_per_unit: formatDraftNumber(product.cost_per_unit),
    coverage_sqft_per_gal_per_coat: formatDraftNumber(product.coverage_sqft_per_gal_per_coat),
    efficiency_pct: formatDraftNumber(product.efficiency_pct),
    default_coats: formatDraftNumber(product.default_coats),
    default_sheen: product.default_sheen ?? EMPTY_QUOTE_PRODUCT_DRAFT.default_sheen,
    default_scopes: product.default_scopes ?? [],
    notes: product.notes ?? '',
    status: product.status,
  })
}

export function quoteProductPatchToDraft(
  patch: Record<string, unknown> | null | undefined
): Partial<QuoteProductDraft> {
  if (!patch) return {}

  const draftPatch: Partial<QuoteProductDraft> = {}

  if ('name' in patch) draftPatch.name = normalizeTextValue(patch.name)
  if ('family' in patch) draftPatch.family = patch.family == null ? '' : normalizeTextValue(patch.family)
  if ('base' in patch) draftPatch.base = normalizeTextValue(patch.base)
  if ('subtype' in patch) draftPatch.subtype = normalizeTextValue(patch.subtype)
  if ('cost_per_unit' in patch) {
    draftPatch.cost_per_unit = normalizeNumericInput(patch.cost_per_unit)
  }
  if ('coverage_sqft_per_gal_per_coat' in patch) {
    draftPatch.coverage_sqft_per_gal_per_coat = normalizeNumericInput(
      patch.coverage_sqft_per_gal_per_coat
    )
  }
  if ('efficiency_pct' in patch) {
    draftPatch.efficiency_pct = normalizeNumericInput(patch.efficiency_pct)
  }
  if ('default_coats' in patch) {
    draftPatch.default_coats = normalizeNumericInput(patch.default_coats)
  }
  if ('default_sheen' in patch) {
    draftPatch.default_sheen =
      patch.default_sheen == null ? '' : normalizeTextValue(patch.default_sheen)
  }
  if ('default_scopes' in patch) {
    draftPatch.default_scopes = normalizeScopeInputs(patch.default_scopes)
  }
  if ('notes' in patch) draftPatch.notes = normalizeTextValue(patch.notes)
  if ('status' in patch) draftPatch.status = patch.status == null ? '' : normalizeTextValue(patch.status)

  return draftPatch
}

export function normalizeQuoteProductDraft(
  draft: Partial<QuoteProductDraft> | null | undefined
): QuoteProductDraft {
  return {
    name: normalizeTextValue(draft?.name),
    family:
      draft?.family == null ? EMPTY_QUOTE_PRODUCT_DRAFT.family : normalizeTextValue(draft.family),
    base: normalizeTextValue(draft?.base),
    subtype: normalizeTextValue(draft?.subtype),
    cost_per_unit: normalizeNumericInput(draft?.cost_per_unit),
    coverage_sqft_per_gal_per_coat: normalizeNumericInput(
      draft?.coverage_sqft_per_gal_per_coat
    ),
    efficiency_pct: normalizeNumericInput(draft?.efficiency_pct),
    default_coats: normalizeNumericInput(draft?.default_coats),
    default_sheen:
      draft?.default_sheen == null
        ? EMPTY_QUOTE_PRODUCT_DRAFT.default_sheen
        : normalizeTextValue(draft.default_sheen),
    default_scopes: normalizeScopeInputs(draft?.default_scopes),
    notes: normalizeTextValue(draft?.notes),
    status:
      draft?.status == null ? EMPTY_QUOTE_PRODUCT_DRAFT.status : normalizeTextValue(draft.status),
  }
}

export function draftToQuoteProductPayload(
  draft: Partial<QuoteProductDraft> | null | undefined
): DraftToPayloadResult {
  const normalizedDraft = normalizeQuoteProductDraft(draft)
  const fields: QuoteProductValidationErrors = {}

  const costPerUnit = parseNullableNumber(normalizedDraft.cost_per_unit)
  if (!costPerUnit.valid) {
    fields.cost_per_unit = 'Enter a valid number.'
  }

  const coverage = parseNullableNumber(normalizedDraft.coverage_sqft_per_gal_per_coat)
  if (!coverage.valid) {
    fields.coverage_sqft_per_gal_per_coat = 'Enter a valid number.'
  }

  const efficiency = parseNullableNumber(normalizedDraft.efficiency_pct)
  if (!efficiency.valid) {
    fields.efficiency_pct = 'Enter a valid number.'
  }

  const defaultCoats = parseNullableNumber(normalizedDraft.default_coats)
  if (!defaultCoats.valid) {
    fields.default_coats = 'Enter a valid number.'
  }

  if (Object.keys(fields).length > 0) {
    return {
      ok: false,
      fields,
    }
  }

  return {
    ok: true,
    value: {
      name: normalizedDraft.name,
      family: normalizedDraft.family as ProductFamily,
      base: emptyStringToNull(normalizedDraft.base),
      subtype: emptyStringToNull(normalizedDraft.subtype),
      cost_per_unit: costPerUnit.value,
      coverage_sqft_per_gal_per_coat: coverage.value,
      efficiency_pct: efficiency.value,
      default_coats: defaultCoats.value,
      default_sheen:
        normalizedDraft.default_sheen === 'N/A'
          ? 'N/A'
          : (emptyStringToNull(normalizedDraft.default_sheen) as QuoteProductSheen | null),
      default_scopes: normalizedDraft.default_scopes.filter((scope): scope is QuoteProductScope =>
        QUOTE_PRODUCT_SCOPE_SET.has(scope)
      ),
      notes: emptyStringToNull(normalizedDraft.notes),
      status: normalizedDraft.status as ProductStatus,
    },
  }
}

export function validateQuoteProductDraft(
  draft: Partial<QuoteProductDraft> | null | undefined
): QuoteProductValidationResult {
  const normalizedDraft = normalizeQuoteProductDraft(draft)
  const payloadResult = draftToQuoteProductPayload(normalizedDraft)
  const fields: QuoteProductValidationErrors =
    payloadResult.ok ? {} : { ...payloadResult.fields }

  if (!normalizedDraft.name) {
    fields.name = 'Product name is required.'
  }

  if (!normalizedDraft.family || !QUOTE_PRODUCT_FAMILY_SET.has(normalizedDraft.family)) {
    fields.family = 'Choose a valid product family.'
  }

  if (!normalizedDraft.status || !QUOTE_PRODUCT_STATUS_SET.has(normalizedDraft.status)) {
    fields.status = 'Choose a valid status.'
  }

  if (!normalizedDraft.default_sheen || !QUOTE_PRODUCT_SHEEN_SET.has(normalizedDraft.default_sheen)) {
    fields.default_sheen = 'Choose a valid sheen.'
  }

  const scopeError = getScopeValidationError(normalizedDraft.default_scopes)
  if (scopeError) {
    fields.default_scopes = scopeError
  }

  if (payloadResult.ok) {
    if (payloadResult.value.cost_per_unit != null && payloadResult.value.cost_per_unit < 0) {
      fields.cost_per_unit = 'Cost per unit cannot be negative.'
    }

    if (
      payloadResult.value.coverage_sqft_per_gal_per_coat != null &&
      payloadResult.value.coverage_sqft_per_gal_per_coat < 0
    ) {
      fields.coverage_sqft_per_gal_per_coat = 'Coverage cannot be negative.'
    }

    if (payloadResult.value.efficiency_pct != null) {
      if (payloadResult.value.efficiency_pct < 0) {
        fields.efficiency_pct = 'Efficiency cannot be negative.'
      } else if (payloadResult.value.efficiency_pct > 100) {
        fields.efficiency_pct = 'Efficiency must be 100 or less.'
      }
    }

    if (payloadResult.value.default_coats != null) {
      if (payloadResult.value.default_coats < 0) {
        fields.default_coats = 'Default coats cannot be negative.'
      } else if (payloadResult.value.default_coats > 10) {
        fields.default_coats = 'Default coats must be 10 or less.'
      }
    }
  }

  const summary = buildValidationSummary(fields)
  if (summary) {
    return {
      ok: false,
      draft: normalizedDraft,
      validation: {
        ok: false,
        summary,
        fields,
      },
    }
  }

  if (!payloadResult.ok) {
    throw new Error('Expected a valid quote product payload after validation.')
  }

  return {
    ok: true,
    draft: normalizedDraft,
    payload: payloadResult.value,
    validation: {
      ok: true,
      summary: null,
      fields: {},
    },
  }
}

function normalizeTextValue(value: unknown) {
  return String(value ?? '').trim()
}

function normalizeNumericInput(value: unknown) {
  return String(value ?? '').trim()
}

function normalizeScopeInputs(value: unknown) {
  if (!Array.isArray(value)) return []

  const uniqueScopes = new Set<string>()
  for (const scope of value) {
    const normalizedScope = normalizeTextValue(scope)
    if (!normalizedScope) continue
    uniqueScopes.add(normalizedScope)
  }
  return [...uniqueScopes]
}

function parseNullableNumber(value: string): ParsedNumber {
  if (!value) {
    return {
      valid: true,
      value: null,
    }
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return {
      valid: false,
      value: null,
    }
  }

  return {
    valid: true,
    value: parsed,
  }
}

function getScopeValidationError(scopes: string[]) {
  for (const scope of scopes) {
    if (!QUOTE_PRODUCT_SCOPE_SET.has(scope)) {
      return 'Choose only valid default scopes.'
    }
  }
  return null
}

function buildValidationSummary(fields: QuoteProductValidationErrors) {
  const firstMessage = Object.values(fields).find((value) => Boolean(value))
  return firstMessage ?? null
}

function emptyStringToNull(value: string) {
  return value ? value : null
}

function formatDraftNumber(value: number | null | undefined) {
  return value == null ? '' : String(value)
}
