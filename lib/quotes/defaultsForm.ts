import { DEFAULT_LABOR_RATE } from '../estimator/defaults.ts'
import type { ProductFamily } from './productsForm.ts'
import type { QuoteDefaults } from '../settings/types.ts'

type Unsafe = Record<string, unknown>

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields?: QuoteDefaultsValidationFields; issues?: QuoteDefaultsValidationIssue[] }

export type QuoteDefaultsProductFieldKey = keyof Pick<
  QuoteDefaults,
  | 'walls_paint_id'
  | 'walls_primer_id'
  | 'ceiling_paint_id'
  | 'ceiling_primer_id'
  | 'trim_paint_id'
  | 'trim_primer_id'
>

export type QuoteDefaultsProductReference = {
  id: string
  name?: string | null
  family?: string | null
  status?: string | null
}

export type QuoteDefaultsValidationIssueCode =
  | 'invalid_labor_rate'
  | 'missing_product'
  | 'wrong_product_family'
  | 'inactive_product'

export type QuoteDefaultsValidationIssue = {
  code: QuoteDefaultsValidationIssueCode
  field: keyof QuoteDefaults
  message: string
  productId?: string
  productName?: string
  expectedFamily?: ProductFamily
  actualFamily?: string | null
  status?: string | null
}

export type QuoteDefaultsValidationFields = Partial<Record<keyof QuoteDefaults, string>>

export type QuoteDefaultsValidationContext = {
  products?: readonly QuoteDefaultsProductReference[]
}

type QuoteDefaultsValidationResult =
  | {
      ok: true
      value: QuoteDefaults
      fields: QuoteDefaultsValidationFields
      issues: QuoteDefaultsValidationIssue[]
    }
  | {
      ok: false
      error: string
      fields: QuoteDefaultsValidationFields
      issues: QuoteDefaultsValidationIssue[]
    }

export const QUOTE_DEFAULTS_LABOR_RATE_MIN = 0
export const QUOTE_DEFAULTS_LABOR_RATE_MAX = 10000

export const quoteDefaultsProductFields = [
  { label: 'Walls default paint', key: 'walls_paint_id', expectedFamily: 'Paint' },
  { label: 'Walls default primer', key: 'walls_primer_id', expectedFamily: 'Primer' },
  { label: 'Ceilings default paint', key: 'ceiling_paint_id', expectedFamily: 'Paint' },
  { label: 'Ceilings default primer', key: 'ceiling_primer_id', expectedFamily: 'Primer' },
  { label: 'Trim default paint', key: 'trim_paint_id', expectedFamily: 'Paint' },
  { label: 'Trim default primer', key: 'trim_primer_id', expectedFamily: 'Primer' },
] as const satisfies readonly {
  label: string
  key: QuoteDefaultsProductFieldKey
  expectedFamily: ProductFamily
}[]

export const emptyQuoteDefaults: QuoteDefaults = {
  walls_paint_id: null,
  walls_primer_id: null,
  ceiling_paint_id: null,
  ceiling_primer_id: null,
  trim_paint_id: null,
  trim_primer_id: null,
  override_labor_rate: DEFAULT_LABOR_RATE,
}

function asNullableText(value: unknown) {
  const text = value == null ? '' : String(value).trim()
  return text || null
}

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeQuoteDefaults(
  value: Partial<QuoteDefaults> | Unsafe | null | undefined = {}
): QuoteDefaults {
  return {
    walls_paint_id: asNullableText(value?.walls_paint_id),
    walls_primer_id: asNullableText(value?.walls_primer_id),
    ceiling_paint_id: asNullableText(value?.ceiling_paint_id),
    ceiling_primer_id: asNullableText(value?.ceiling_primer_id),
    trim_paint_id: asNullableText(value?.trim_paint_id),
    trim_primer_id: asNullableText(value?.trim_primer_id),
    override_labor_rate: asNumber(value?.override_labor_rate) ?? emptyQuoteDefaults.override_labor_rate,
  }
}

export function areQuoteDefaultsEqual(
  current: Partial<QuoteDefaults> | null | undefined,
  saved: Partial<QuoteDefaults> | null | undefined
) {
  const normalizedCurrent = normalizeQuoteDefaults(current)
  const normalizedSaved = normalizeQuoteDefaults(saved)

  return (
    normalizedCurrent.walls_paint_id === normalizedSaved.walls_paint_id &&
    normalizedCurrent.walls_primer_id === normalizedSaved.walls_primer_id &&
    normalizedCurrent.ceiling_paint_id === normalizedSaved.ceiling_paint_id &&
    normalizedCurrent.ceiling_primer_id === normalizedSaved.ceiling_primer_id &&
    normalizedCurrent.trim_paint_id === normalizedSaved.trim_paint_id &&
    normalizedCurrent.trim_primer_id === normalizedSaved.trim_primer_id &&
    normalizedCurrent.override_labor_rate === normalizedSaved.override_labor_rate
  )
}

export function parseQuoteDefaults(
  input: unknown,
  context: QuoteDefaultsValidationContext = {}
): ParseResult<QuoteDefaults> {
  const row = (input ?? null) as Unsafe | null
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return { ok: false, error: 'Missing quote defaults payload.' }
  }

  const data = normalizeQuoteDefaults(row)
  const validation = validateQuoteDefaults(data, context)
  if (!validation.ok) {
    return {
      ok: false,
      error: validation.error,
      fields: validation.fields,
      issues: validation.issues,
    }
  }

  return {
    ok: true as const,
    data,
  }
}

export function getQuoteDefaultsValidationError(
  data: QuoteDefaults,
  context: QuoteDefaultsValidationContext = {}
) {
  const validation = validateQuoteDefaults(data, context)
  return validation.ok ? null : validation.error
}

export function validateQuoteDefaults(
  value: Partial<QuoteDefaults> | null | undefined,
  context: QuoteDefaultsValidationContext = {}
): QuoteDefaultsValidationResult {
  const data = normalizeQuoteDefaults(value)
  const fields: QuoteDefaultsValidationFields = {}
  const issues: QuoteDefaultsValidationIssue[] = []

  if (
    !Number.isFinite(data.override_labor_rate) ||
    data.override_labor_rate < QUOTE_DEFAULTS_LABOR_RATE_MIN ||
    data.override_labor_rate > QUOTE_DEFAULTS_LABOR_RATE_MAX
  ) {
    const message = `Labor rate must be between ${QUOTE_DEFAULTS_LABOR_RATE_MIN} and ${QUOTE_DEFAULTS_LABOR_RATE_MAX}.`
    fields.override_labor_rate = message
    issues.push({
      code: 'invalid_labor_rate',
      field: 'override_labor_rate',
      message,
    })
  }

  if (context.products) {
    validateQuoteDefaultProductReferences(data, context.products, fields, issues)
  }

  const firstIssue = issues[0]
  if (firstIssue) {
    return {
      ok: false,
      error: firstIssue.message,
      fields,
      issues,
    }
  }

  return {
    ok: true,
    value: data,
    fields,
    issues,
  }
}

function validateQuoteDefaultProductReferences(
  data: QuoteDefaults,
  products: readonly QuoteDefaultsProductReference[],
  fields: QuoteDefaultsValidationFields,
  issues: QuoteDefaultsValidationIssue[]
) {
  const productsById = new Map(products.map((product) => [product.id, product]))

  for (const field of quoteDefaultsProductFields) {
    const productId = data[field.key]
    if (!productId) continue

    const product = productsById.get(productId)
    if (!product) {
      const message = `${field.label} references a product that no longer exists (${productId}). Choose an active ${field.expectedFamily.toLowerCase()} product or clear the selection.`
      fields[field.key] = message
      issues.push({
        code: 'missing_product',
        field: field.key,
        message,
        productId,
        expectedFamily: field.expectedFamily,
      })
      continue
    }

    if (!matchesExpectedFamily(product.family, field.expectedFamily)) {
      const familyLabel = product.family ? `${product.family}` : 'unknown family'
      const message = `${field.label} must use a ${field.expectedFamily.toLowerCase()} product, but ${product.name ?? product.id} is ${familyLabel}.`
      fields[field.key] = message
      issues.push({
        code: 'wrong_product_family',
        field: field.key,
        message,
        productId,
        productName: product.name ?? product.id,
        expectedFamily: field.expectedFamily,
        actualFamily: product.family ?? null,
        status: product.status ?? null,
      })
      continue
    }

    if (!isActiveProductStatus(product.status)) {
      const statusLabel = product.status ? product.status.toLowerCase() : 'not active'
      const message = `${field.label} uses ${product.name ?? product.id}, which is ${statusLabel}. Choose an active ${field.expectedFamily.toLowerCase()} product or clear the selection.`
      fields[field.key] = message
      issues.push({
        code: 'inactive_product',
        field: field.key,
        message,
        productId,
        productName: product.name ?? product.id,
        expectedFamily: field.expectedFamily,
        actualFamily: product.family ?? null,
        status: product.status ?? null,
      })
    }
  }
}

function matchesExpectedFamily(value: string | null | undefined, expectedFamily: ProductFamily) {
  return String(value ?? '').trim().toLowerCase() === expectedFamily.toLowerCase()
}

function isActiveProductStatus(value: string | null | undefined) {
  if (value == null) return true
  return String(value).trim().toLowerCase() === 'active'
}
