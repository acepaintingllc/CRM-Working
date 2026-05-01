import type { RatesFlagsEditableCategoryKey } from '../../types/estimator/ratesFlags.ts'

export type RatesFlagsMutationFieldSource = {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'checkbox_group'
  required?: boolean
  readOnly?: boolean
  options?: readonly string[]
  writeDefault?: string
}

export type RatesFlagsMutationFieldSpec =
  | {
      key: string
      label: string
      kind: 'text'
      required?: boolean
      defaultValue?: string
    }
  | {
      key: string
      label: string
      kind: 'number'
      required?: boolean
      defaultValue?: string
    }
  | {
      key: string
      label: string
      kind: 'select'
      options: readonly string[]
      required?: boolean
      defaultValue?: string
    }
  | {
      key: string
      label: string
      kind: 'checkbox_group'
      options: readonly string[]
      required?: boolean
      defaultValue?: string
    }
  | {
      key: string
      label: string
      kind: 'yn'
      required?: boolean
      defaultValue?: 'Y' | 'N'
    }
  | {
      key: string
      label: string
      kind: 'literal'
      value: string
    }

export type RatesFlagsCategoryValidationIssue = {
  error: string
  fieldKey?: string
}

type RatesFlagsCategoryValidationRule = (params: {
  categoryKey: RatesFlagsEditableCategoryKey
  specs: readonly RatesFlagsMutationFieldSpec[]
  values: Readonly<Record<string, unknown>>
}) => RatesFlagsCategoryValidationIssue | null

export function isRatesFlagsYnOptions(options: readonly string[] | undefined) {
  return options?.length === 2 && options[0] === 'Y' && options[1] === 'N'
}

function asWriteDefault(field: RatesFlagsMutationFieldSource) {
  return typeof field.writeDefault === 'string' ? field.writeDefault : undefined
}

function mutationSpecFromField(
  field: RatesFlagsMutationFieldSource
): RatesFlagsMutationFieldSpec {
  const defaultValue = asWriteDefault(field)
  const singleOption = field.options?.length === 1 ? field.options[0] : undefined

  if (field.readOnly && (defaultValue != null || singleOption != null)) {
    return {
      key: field.key,
      label: field.label,
      kind: 'literal',
      value: defaultValue ?? singleOption ?? '',
    }
  }

  if (isRatesFlagsYnOptions(field.options)) {
    return {
      key: field.key,
      label: field.label,
      kind: 'yn',
      required: field.required,
      defaultValue: defaultValue === 'N' ? 'N' : 'Y',
    }
  }

  if (field.type === 'select' || field.type === 'checkbox_group') {
    return {
      key: field.key,
      label: field.label,
      kind: field.type,
      options: field.options ?? [],
      required: field.required,
      defaultValue,
    }
  }

  return {
    key: field.key,
    label: field.label,
    kind: field.type,
    required: field.required,
    defaultValue,
  }
}

export function getRatesFlagsMutationFieldSpecsFromFields(
  fields: readonly RatesFlagsMutationFieldSource[]
) {
  return [
    ...fields.map((field) => mutationSpecFromField(field)),
    { key: 'active', label: 'Active', kind: 'yn', defaultValue: 'Y' },
  ] satisfies readonly RatesFlagsMutationFieldSpec[]
}

function asTrimmedText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function parseValidationNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = asTrimmedText(value)
  if (!text) return null
  const parsed = Number(text.replace(/[$,%\s,]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function findSpec(
  specs: readonly RatesFlagsMutationFieldSpec[],
  fieldKey: string
) {
  return specs.find((spec) => spec.key === fieldKey) ?? null
}

function requiredIdentityFieldsRule({
  specs,
  values,
}: {
  specs: readonly RatesFlagsMutationFieldSpec[]
  values: Readonly<Record<string, unknown>>
}) {
  for (const spec of specs) {
    const isRequiredIdentityField =
      spec.kind !== 'literal' &&
      spec.kind !== 'yn' &&
      'required' in spec &&
      spec.required &&
      (spec.key === 'id' || spec.key === 'display_name' || spec.key.endsWith('_id'))
    if (!isRequiredIdentityField) continue

    if (!asTrimmedText(values[spec.key])) {
      return {
        error: `${spec.label} is required.`,
        fieldKey: spec.key,
      }
    }
  }

  return null
}

const allowNegativeNumberFieldsByCategory = {
  production_rates_walls: [],
  production_rates_ceilings: [],
  production_rates_trim: [],
  unit_rates_doors: [],
  unit_rates_trim: [],
  unit_rates_drywall: [],
  access_fees_ladders: [],
  access_fees_scaffolding: [],
  access_fees_specialty: [],
  supply_rates_per_color: [],
  supply_rates_area_based: [],
  supply_rates_per_job: [],
  supply_rates_roller_covers: [],
  wall_complexity: [],
  height_factors: [],
  ceiling_types: [],
  condition_modifiers: [],
  room_types: [],
  room_templates: [],
  scope_defaults: [],
} satisfies {
  [TKey in RatesFlagsEditableCategoryKey]: readonly string[]
}

function nonNegativeNumericFieldsRule({
  categoryKey,
  specs,
  values,
}: {
  categoryKey: RatesFlagsEditableCategoryKey
  specs: readonly RatesFlagsMutationFieldSpec[]
  values: Readonly<Record<string, unknown>>
}) {
  const allowedNegativeFields = new Set<string>(allowNegativeNumberFieldsByCategory[categoryKey])

  for (const spec of specs) {
    if (spec.kind !== 'number' || allowedNegativeFields.has(spec.key)) continue
    const numericValue = parseValidationNumber(values[spec.key])
    if (numericValue != null && numericValue < 0) {
      return {
        error: `${spec.label} must not be negative.`,
        fieldKey: spec.key,
      }
    }
  }

  return null
}

function heightRangeRule({
  specs,
  values,
}: {
  specs: readonly RatesFlagsMutationFieldSpec[]
  values: Readonly<Record<string, unknown>>
}) {
  const min = parseValidationNumber(values.min_height_ft)
  const max = parseValidationNumber(values.max_height_ft)
  if (min == null || max == null || min <= max) return null

  const minSpec = findSpec(specs, 'min_height_ft')
  const maxSpec = findSpec(specs, 'max_height_ft')
  return {
    error: `${minSpec?.label ?? 'Min Height'} must be less than or equal to ${
      maxSpec?.label ?? 'Max Height'
    }.`,
    fieldKey: 'max_height_ft',
  }
}

const defaultCategoryValidationRules = [
  requiredIdentityFieldsRule,
  nonNegativeNumericFieldsRule,
] satisfies readonly RatesFlagsCategoryValidationRule[]

const categorySpecificValidationRules = {
  production_rates_walls: [],
  production_rates_ceilings: [],
  production_rates_trim: [],
  unit_rates_doors: [],
  unit_rates_trim: [],
  unit_rates_drywall: [],
  access_fees_ladders: [],
  access_fees_scaffolding: [],
  access_fees_specialty: [],
  supply_rates_per_color: [],
  supply_rates_area_based: [],
  supply_rates_per_job: [],
  supply_rates_roller_covers: [],
  wall_complexity: [],
  height_factors: [heightRangeRule],
  ceiling_types: [],
  condition_modifiers: [],
  room_types: [],
  room_templates: [],
  scope_defaults: [],
} satisfies {
  [TKey in RatesFlagsEditableCategoryKey]: readonly RatesFlagsCategoryValidationRule[]
}

export function validateRatesFlagsCategoryValues(params: {
  categoryKey: RatesFlagsEditableCategoryKey
  specs: readonly RatesFlagsMutationFieldSpec[]
  values: Readonly<Record<string, unknown>>
}): RatesFlagsCategoryValidationIssue | null {
  const rules = [
    ...defaultCategoryValidationRules,
    ...categorySpecificValidationRules[params.categoryKey],
  ]

  for (const rule of rules) {
    const issue = rule(params)
    if (issue) return issue
  }

  return null
}
