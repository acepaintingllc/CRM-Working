import {
  ratesFlagsEditableCategoryKeys,
  type RatesFlagsActivationMutationRequest,
  type RatesFlagsCreateOrUpdateMutationRequest,
  type RatesFlagsEditableCategoryKey,
  type RatesFlagsMutationRequest,
  type RatesFlagsMutationValues,
} from '../../../types/estimator/ratesFlags.ts'
import { CATEGORY_CONFIGS_BY_KEY } from './categories.ts'
import {
  getRatesFlagsMutationFieldSpecs,
  validateRatesFlagsCategoryValues,
  type RatesFlagsMutationFieldSpec,
} from './mutationSchema.ts'
import { asText, normalizeId } from './shared.ts'

type ParseResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      error: string
    }

type RawObject = Record<string, unknown>

type MutationParserEntry<TKey extends RatesFlagsEditableCategoryKey> = {
  specs: readonly RatesFlagsMutationFieldSpec[]
  parseValues: (input: unknown) => ParseResult<RatesFlagsMutationValues<TKey>>
}

function isPlainObject(value: unknown): value is RawObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validateId(value: string) {
  return /^[A-Z0-9_]+$/.test(value)
}

function parseYNValue(raw: unknown, fallback: 'Y' | 'N' = 'Y') {
  if (raw === undefined) return fallback
  if (raw === true) return 'Y'
  if (raw === false) return 'N'
  const value = asText(raw).toUpperCase()
  if (value === 'Y' || value === 'N') return value
  return null
}

function parseNumberString(value: string) {
  const parsed = Number(value.replace(/[$,%\s,]/g, ''))
  return Number.isFinite(parsed)
}

function parseFieldValue(
  spec: RatesFlagsMutationFieldSpec,
  raw: unknown
): ParseResult<string> {
  if (spec.kind === 'literal') {
    const value = raw === undefined ? spec.value : asText(raw)
    if (value !== spec.value) {
      return { ok: false, error: `${spec.label} must be '${spec.value}'.` }
    }
    return { ok: true, value: spec.value }
  }

  if (spec.kind === 'yn') {
    const value = parseYNValue(raw, spec.defaultValue ?? 'Y')
    if (!value) {
      return { ok: false, error: `${spec.label} must be Y or N.` }
    }
    return { ok: true, value }
  }

  let value = asText(raw)
  if (!value && spec.defaultValue != null) value = spec.defaultValue

  if (!value) {
    if (spec.required) return { ok: false, error: `${spec.label} is required.` }
    return { ok: true, value: '' }
  }

  if (spec.key === 'id' || spec.key === 'original_id') {
    value = normalizeId(value)
    if (!validateId(value)) {
      return {
        ok: false,
        error: 'ID must be uppercase snake-case (A-Z, 0-9, underscore).',
      }
    }
  }

  if (spec.kind === 'number' && !parseNumberString(value)) {
    return { ok: false, error: `${spec.label} must be a valid number.` }
  }

  if (spec.kind === 'select' && !spec.options.includes(value)) {
    return {
      ok: false,
      error: `${spec.label} must be one of: ${spec.options.join(', ')}.`,
    }
  }

  return { ok: true, value }
}

function parseValueObject(
  input: unknown,
  categoryLabel: string,
  specs: readonly RatesFlagsMutationFieldSpec[]
): ParseResult<Record<string, string>> {
  // The route parser is generated from CATEGORY_CONFIGS.fields so unsupported
  // value fields cannot drift away from the UI/editor category contract.
  if (!isPlainObject(input)) {
    return { ok: false, error: 'Mutation values must be an object.' }
  }

  const allowedKeys = new Set(specs.map((spec) => spec.key))
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      return {
        ok: false,
        error: `${categoryLabel} does not support field '${key}'.`,
      }
    }
  }

  const values: Record<string, string> = {}
  for (const spec of specs) {
    const parsed = parseFieldValue(spec, input[spec.key])
    if (!parsed.ok) return parsed
    values[spec.key] = parsed.value
  }

  return { ok: true, value: values }
}

function createParser<TKey extends RatesFlagsEditableCategoryKey>(
  categoryKey: TKey
): MutationParserEntry<TKey> {
  const specs = getRatesFlagsMutationFieldSpecs(categoryKey)
  const categoryLabel = CATEGORY_CONFIGS_BY_KEY[categoryKey].label

  return {
    specs,
    parseValues(input) {
      const parsed = parseValueObject(input, categoryLabel, specs)
      if (!parsed.ok) return parsed
      const categoryIssue = validateRatesFlagsCategoryValues({
        categoryKey,
        specs,
        values: parsed.value,
      })
      if (categoryIssue) {
        return { ok: false, error: categoryIssue.error }
      }
      return {
        ok: true,
        value: parsed.value as RatesFlagsMutationValues<TKey>,
      }
    },
  }
}

const MUTATION_PARSERS = Object.fromEntries(
  ratesFlagsEditableCategoryKeys.map((key) => [key, createParser(key)] as const)
) as {
  [TCategory in RatesFlagsEditableCategoryKey]: MutationParserEntry<TCategory>
}

const mutationParserCategoryKeys = new Set<RatesFlagsEditableCategoryKey>(
  ratesFlagsEditableCategoryKeys
)

function parseCategory(input: RawObject): ParseResult<RatesFlagsEditableCategoryKey> {
  const category = asText(input.category) as RatesFlagsEditableCategoryKey
  if (!category) return { ok: false, error: 'Body must include category and action.' }
  if (!mutationParserCategoryKeys.has(category)) {
    return { ok: false, error: 'Unknown category.' }
  }
  return { ok: true, value: category }
}

function parseAction(input: RawObject): ParseResult<RatesFlagsMutationRequest['action']> {
  const action = asText(input.action) as RatesFlagsMutationRequest['action']
  if (!action) return { ok: false, error: 'Body must include category and action.' }
  if (!['create', 'update', 'archive', 'reactivate'].includes(action)) {
    return { ok: false, error: 'Unsupported mutation action.' }
  }
  return { ok: true, value: action }
}

function parseCreateOrUpdateRequest<TKey extends RatesFlagsEditableCategoryKey>(
  category: TKey,
  action: 'create' | 'update',
  input: RawObject
): ParseResult<RatesFlagsCreateOrUpdateMutationRequest> {
  const allowedTopLevelKeys =
    action === 'update'
      ? new Set(['category', 'action', 'values', 'original_id'])
      : new Set(['category', 'action', 'values'])
  for (const key of Object.keys(input)) {
    if (!allowedTopLevelKeys.has(key)) {
      return { ok: false, error: `Body does not support field '${key}'.` }
    }
  }

  if (action === 'create' && input.original_id !== undefined) {
    return { ok: false, error: "Create requests do not support 'original_id'." }
  }

  const parser = MUTATION_PARSERS[category]
  const parsedValues = parser.parseValues(input.values)
  if (!parsedValues.ok) return parsedValues

  if (action === 'create') {
    return {
      ok: true,
      value: {
        category,
        action,
        values: parsedValues.value,
      } as RatesFlagsCreateOrUpdateMutationRequest,
    }
  }

  const originalId = parseFieldValue(
    { key: 'original_id', label: 'Original ID', kind: 'text', required: true },
    input.original_id
  )
  if (!originalId.ok) return originalId

  return {
    ok: true,
    value: {
      category,
      action,
      original_id: originalId.value,
      values: parsedValues.value,
    } as RatesFlagsCreateOrUpdateMutationRequest,
  }
}

function parseActivationRequest<TKey extends RatesFlagsEditableCategoryKey>(
  category: TKey,
  action: 'archive' | 'reactivate',
  input: RawObject
): ParseResult<RatesFlagsActivationMutationRequest> {
  const allowedTopLevelKeys = new Set(['category', 'action', 'rowId'])
  for (const key of Object.keys(input)) {
    if (!allowedTopLevelKeys.has(key)) {
      return { ok: false, error: `Body does not support field '${key}'.` }
    }
  }

  const rowId = parseFieldValue(
    { key: 'id', label: 'Row ID', kind: 'text', required: true },
    input.rowId
  )
  if (!rowId.ok) {
    return { ok: false, error: 'Body must include rowId for archive/reactivate.' }
  }

  return {
    ok: true,
    value: {
      category,
      action,
      rowId: rowId.value,
    } as RatesFlagsActivationMutationRequest,
  }
}

export function parseRatesFlagsMutationRequest(input: unknown): ParseResult<RatesFlagsMutationRequest> {
  if (!isPlainObject(input)) {
    return { ok: false, error: 'Invalid body.' }
  }

  const category = parseCategory(input)
  if (!category.ok) return category

  const action = parseAction(input)
  if (!action.ok) return action

  if (action.value === 'archive' || action.value === 'reactivate') {
    return parseActivationRequest(category.value, action.value, input)
  }

  return parseCreateOrUpdateRequest(category.value, action.value, input)
}

export function getRatesFlagsMutationParserCategoryKeys() {
  return ratesFlagsEditableCategoryKeys
}

export function getRatesFlagsMutationParserFieldKeys(
  categoryKey: RatesFlagsEditableCategoryKey
) {
  return MUTATION_PARSERS[categoryKey].specs.map((spec) => spec.key)
}

export function getRatesFlagsMutationParserRequiredFieldKeys(
  categoryKey: RatesFlagsEditableCategoryKey
) {
  return MUTATION_PARSERS[categoryKey].specs
    .filter((spec) => spec.kind !== 'yn' && spec.kind !== 'literal' && spec.required)
    .map((spec) => spec.key)
}
