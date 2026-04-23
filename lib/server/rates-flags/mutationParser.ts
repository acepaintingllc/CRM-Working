import type {
  RatesFlagsActivationMutationRequest,
  RatesFlagsCategoryValueMap,
  RatesFlagsCreateOrUpdateMutationRequest,
  RatesFlagsEditableCategoryKey,
  RatesFlagsMutationRequest,
  RatesFlagsMutationValues,
} from '../../../types/estimator/ratesFlags'
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

type MutationFieldSpec =
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
      kind: 'yn'
      defaultValue?: 'Y' | 'N'
    }
  | {
      key: string
      label: string
      kind: 'literal'
      value: string
    }

type MutationParserEntry<TKey extends RatesFlagsEditableCategoryKey> = {
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

function parseFieldValue(spec: MutationFieldSpec, raw: unknown): ParseResult<string> {
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
  specs: readonly MutationFieldSpec[]
): ParseResult<Record<string, string>> {
  // The route parser mirrors each category contract exactly so invalid fields
  // are rejected at the boundary instead of leaking as loose value bags.
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
  categoryLabel: string,
  specs: readonly MutationFieldSpec[],
  build: (values: Record<string, string>) => RatesFlagsCategoryValueMap[TKey]
): MutationParserEntry<TKey> {
  return {
    parseValues(input) {
      const parsed = parseValueObject(input, categoryLabel, specs)
      if (!parsed.ok) return parsed
      return { ok: true, value: build(parsed.value) }
    },
  }
}

function createProductionRateParser<TKey extends 'production_rates_walls' | 'production_rates_ceilings' | 'production_rates_trim'>(
  category: TKey,
  productionScope: RatesFlagsCategoryValueMap[TKey]['production_scope'],
  scopeIdDefault: string
) {
  return createParser<TKey>(
    category,
    [
      { key: 'production_scope', label: 'Production Scope', kind: 'literal', value: productionScope },
      { key: 'id', label: 'ID', kind: 'text', required: true },
      { key: 'scope_id', label: 'Scope', kind: 'text', required: true, defaultValue: scopeIdDefault },
      { key: 'display_name', label: 'Display Name', kind: 'text', required: true },
      { key: 'surface_type', label: 'Surface Type', kind: 'text' },
      { key: 'condition', label: 'Condition', kind: 'text' },
      { key: 'prep_sqft_per_hr', label: 'Prep Rate', kind: 'number' },
      { key: 'sqft_per_hr', label: 'Paint Rate', kind: 'number', required: true },
      { key: 'primer_sqft_per_hr', label: 'Primer Rate', kind: 'number' },
      { key: 'notes', label: 'Notes', kind: 'text' },
      { key: 'active', label: 'Active', kind: 'yn', defaultValue: 'Y' },
    ],
    (values) => ({
      production_scope: productionScope,
      id: values.id,
      scope_id: values.scope_id,
      display_name: values.display_name,
      surface_type: values.surface_type,
      condition: values.condition,
      prep_sqft_per_hr: values.prep_sqft_per_hr,
      sqft_per_hr: values.sqft_per_hr,
      primer_sqft_per_hr: values.primer_sqft_per_hr,
      notes: values.notes,
      active: values.active as 'Y' | 'N',
    } as RatesFlagsCategoryValueMap[TKey])
  )
}

function createAccessFeeParser<TKey extends 'access_fees_ladders' | 'access_fees_scaffolding' | 'access_fees_specialty'>(
  category: TKey,
  accessGroup: RatesFlagsCategoryValueMap[TKey]['access_group']
) {
  return createParser<TKey>(
    category,
    [
      { key: 'access_group', label: 'Access Group', kind: 'literal', value: accessGroup },
      { key: 'id', label: 'ID', kind: 'text', required: true },
      { key: 'display_name', label: 'Display Name', kind: 'text', required: true },
      {
        key: 'fee_type',
        label: 'Fee Type',
        kind: 'select',
        options: ['Labor', 'PassThrough', 'Specialty', 'Other'],
      },
      { key: 'amount', label: 'Amount', kind: 'number', required: true },
      { key: 'unit', label: 'Unit', kind: 'text' },
      { key: 'notes', label: 'Notes', kind: 'text' },
      { key: 'active', label: 'Active', kind: 'yn', defaultValue: 'Y' },
    ],
    (values) => ({
      access_group: accessGroup,
      id: values.id,
      display_name: values.display_name,
      fee_type: values.fee_type,
      amount: values.amount,
      unit: values.unit,
      notes: values.notes,
      active: values.active as 'Y' | 'N',
    } as RatesFlagsCategoryValueMap[TKey])
  )
}

function createSupplyRateParser<TKey extends 'supply_rates_per_color' | 'supply_rates_area_based' | 'supply_rates_per_job'>(
  category: TKey,
  supplyGroup: RatesFlagsCategoryValueMap[TKey]['supply_group'],
  unitSpec: MutationFieldSpec
) {
  return createParser<TKey>(
    category,
    [
      { key: 'supply_group', label: 'Supply Group', kind: 'literal', value: supplyGroup },
      { key: 'id', label: 'ID', kind: 'text', required: true },
      { key: 'display_name', label: 'Display Name', kind: 'text', required: true },
      { key: 'scope', label: 'Scope', kind: 'text' },
      unitSpec,
      { key: 'cost_per', label: 'Cost', kind: 'number', required: true },
      { key: 'notes', label: 'Notes', kind: 'text' },
      { key: 'active', label: 'Active', kind: 'yn', defaultValue: 'Y' },
    ],
    (values) => ({
      supply_group: supplyGroup,
      id: values.id,
      display_name: values.display_name,
      scope: values.scope,
      unit: values.unit,
      cost_per: values.cost_per,
      notes: values.notes,
      active: values.active as 'Y' | 'N',
    } as RatesFlagsCategoryValueMap[TKey])
  )
}

const MUTATION_PARSERS: {
  [TCategory in RatesFlagsEditableCategoryKey]: MutationParserEntry<TCategory>
} = {
  production_rates_walls: createProductionRateParser('production_rates_walls', 'walls', 'WALLS'),
  production_rates_ceilings: createProductionRateParser(
    'production_rates_ceilings',
    'ceilings',
    'CEILINGS'
  ),
  production_rates_trim: createProductionRateParser('production_rates_trim', 'trim', 'TRIM'),
  unit_rates_doors: createParser(
    'unit_rates_doors',
    [
      { key: 'unit_rate_group', label: 'Unit Group', kind: 'literal', value: 'doors' },
      { key: 'id', label: 'ID', kind: 'text', required: true },
      { key: 'display_name', label: 'Display Name', kind: 'text', required: true },
      { key: 'unit_rate_type', label: 'Type', kind: 'text' },
      { key: 'unit', label: 'Unit', kind: 'text' },
      { key: 'default_qty', label: 'Default Qty', kind: 'number' },
      { key: 'labor_rate', label: 'Labor', kind: 'number' },
      { key: 'material_rate', label: 'Material', kind: 'number' },
      { key: 'amount', label: 'Amount', kind: 'number' },
      { key: 'notes', label: 'Notes', kind: 'text' },
      { key: 'active', label: 'Active', kind: 'yn', defaultValue: 'Y' },
    ],
    (values) => ({
      unit_rate_group: 'doors',
      id: values.id,
      display_name: values.display_name,
      unit_rate_type: values.unit_rate_type,
      unit: values.unit,
      default_qty: values.default_qty,
      labor_rate: values.labor_rate,
      material_rate: values.material_rate,
      amount: values.amount,
      notes: values.notes,
      active: values.active as 'Y' | 'N',
    })
  ),
  unit_rates_trim: createParser(
    'unit_rates_trim',
    [
      { key: 'unit_rate_group', label: 'Unit Group', kind: 'literal', value: 'trim' },
      { key: 'id', label: 'ID', kind: 'text', required: true },
      { key: 'display_name', label: 'Display Name', kind: 'text', required: true },
      { key: 'unit_rate_type', label: 'Type', kind: 'text' },
      { key: 'unit', label: 'Unit', kind: 'text' },
      { key: 'helper_allowed', label: 'Helper Allowed', kind: 'yn', defaultValue: 'N' },
      { key: 'default_production_rate_id', label: 'Default Production Rate ID', kind: 'text' },
      { key: 'default_qty', label: 'Default Qty', kind: 'number' },
      { key: 'labor_rate', label: 'Labor', kind: 'number' },
      { key: 'material_rate', label: 'Material', kind: 'number' },
      { key: 'amount', label: 'Amount', kind: 'number' },
      { key: 'notes', label: 'Notes', kind: 'text' },
      { key: 'active', label: 'Active', kind: 'yn', defaultValue: 'Y' },
    ],
    (values) => ({
      unit_rate_group: 'trim',
      id: values.id,
      display_name: values.display_name,
      unit_rate_type: values.unit_rate_type,
      unit: values.unit,
      helper_allowed: values.helper_allowed as 'Y' | 'N',
      default_production_rate_id: values.default_production_rate_id,
      default_qty: values.default_qty,
      labor_rate: values.labor_rate,
      material_rate: values.material_rate,
      amount: values.amount,
      notes: values.notes,
      active: values.active as 'Y' | 'N',
    })
  ),
  unit_rates_drywall: createParser(
    'unit_rates_drywall',
    [
      { key: 'unit_rate_group', label: 'Unit Group', kind: 'literal', value: 'drywall' },
      { key: 'id', label: 'ID', kind: 'text', required: true },
      { key: 'display_name', label: 'Display Name', kind: 'text', required: true },
      { key: 'unit_rate_type', label: 'Type', kind: 'text' },
      { key: 'unit', label: 'Unit', kind: 'text' },
      { key: 'default_qty', label: 'Default Qty', kind: 'number' },
      { key: 'labor_rate', label: 'Labor', kind: 'number' },
      { key: 'material_rate', label: 'Material', kind: 'number' },
      { key: 'amount', label: 'Amount', kind: 'number' },
      { key: 'notes', label: 'Notes', kind: 'text' },
      { key: 'active', label: 'Active', kind: 'yn', defaultValue: 'Y' },
    ],
    (values) => ({
      unit_rate_group: 'drywall',
      id: values.id,
      display_name: values.display_name,
      unit_rate_type: values.unit_rate_type,
      unit: values.unit,
      default_qty: values.default_qty,
      labor_rate: values.labor_rate,
      material_rate: values.material_rate,
      amount: values.amount,
      notes: values.notes,
      active: values.active as 'Y' | 'N',
    })
  ),
  access_fees_ladders: createAccessFeeParser('access_fees_ladders', 'ladders'),
  access_fees_scaffolding: createAccessFeeParser('access_fees_scaffolding', 'scaffolding'),
  access_fees_specialty: createAccessFeeParser('access_fees_specialty', 'specialty'),
  supply_rates_per_color: createSupplyRateParser('supply_rates_per_color', 'per_color', {
    key: 'unit',
    label: 'Unit',
    kind: 'text',
  }),
  supply_rates_area_based: createSupplyRateParser('supply_rates_area_based', 'area_based', {
    key: 'unit',
    label: 'Unit',
    kind: 'literal',
    value: '$/sqft',
  }),
  supply_rates_per_job: createSupplyRateParser('supply_rates_per_job', 'per_job', {
    key: 'unit',
    label: 'Unit',
    kind: 'text',
  }),
  supply_rates_roller_covers: createParser(
    'supply_rates_roller_covers',
    [
      { key: 'supply_group', label: 'Supply Group', kind: 'literal', value: 'roller_covers' },
      { key: 'id', label: 'ID', kind: 'text', required: true },
      { key: 'display_name', label: 'Display Name', kind: 'text', required: true },
      { key: 'scope', label: 'Scope', kind: 'select', options: ['Wall', 'Ceiling', 'Other'] },
      { key: 'size_in', label: 'Size (in)', kind: 'number' },
      { key: 'price_each', label: 'Price Each', kind: 'number' },
      { key: 'notes', label: 'Notes', kind: 'text' },
      { key: 'active', label: 'Active', kind: 'yn', defaultValue: 'Y' },
    ],
    (values) => ({
      supply_group: 'roller_covers',
      id: values.id,
      display_name: values.display_name,
      scope: values.scope,
      size_in: values.size_in,
      price_each: values.price_each,
      notes: values.notes,
      active: values.active as 'Y' | 'N',
    })
  ),
  wall_complexity: createParser(
    'wall_complexity',
    [
      { key: 'id', label: 'ID', kind: 'text', required: true },
      { key: 'display_name', label: 'Display Name', kind: 'text', required: true },
      { key: 'primary_value', label: 'Labor Multiplier', kind: 'number', required: true },
      { key: 'secondary_value', label: 'Access Fee', kind: 'number' },
      { key: 'notes', label: 'Notes', kind: 'text' },
      { key: 'active', label: 'Active', kind: 'yn', defaultValue: 'Y' },
    ],
    (values) => ({
      id: values.id,
      display_name: values.display_name,
      primary_value: values.primary_value,
      secondary_value: values.secondary_value,
      notes: values.notes,
      active: values.active as 'Y' | 'N',
    })
  ),
  height_factors: createParser(
    'height_factors',
    [
      { key: 'id', label: 'ID', kind: 'text', required: true },
      { key: 'display_name', label: 'Display Name', kind: 'text', required: true },
      { key: 'min_height_ft', label: 'Min Height', kind: 'number' },
      { key: 'max_height_ft', label: 'Max Height', kind: 'number' },
      { key: 'primary_value', label: 'Labor Multiplier', kind: 'number', required: true },
      { key: 'notes', label: 'Notes', kind: 'text' },
      { key: 'active', label: 'Active', kind: 'yn', defaultValue: 'Y' },
    ],
    (values) => ({
      id: values.id,
      display_name: values.display_name,
      min_height_ft: values.min_height_ft,
      max_height_ft: values.max_height_ft,
      primary_value: values.primary_value,
      notes: values.notes,
      active: values.active as 'Y' | 'N',
    })
  ),
  ceiling_types: createParser(
    'ceiling_types',
    [
      { key: 'id', label: 'ID', kind: 'text', required: true },
      { key: 'display_name', label: 'Display Name', kind: 'text', required: true },
      { key: 'primary_value', label: 'Labor Multiplier', kind: 'number', required: true },
      { key: 'secondary_value', label: 'Surcharge / sqft', kind: 'number' },
      { key: 'notes', label: 'Notes', kind: 'text' },
      { key: 'active', label: 'Active', kind: 'yn', defaultValue: 'Y' },
    ],
    (values) => ({
      id: values.id,
      display_name: values.display_name,
      primary_value: values.primary_value,
      secondary_value: values.secondary_value,
      notes: values.notes,
      active: values.active as 'Y' | 'N',
    })
  ),
  condition_modifiers: createParser(
    'condition_modifiers',
    [
      { key: 'id', label: 'ID', kind: 'text', required: true },
      { key: 'display_name', label: 'Display Name', kind: 'text', required: true },
      { key: 'wall_factor', label: 'Wall Factor', kind: 'number' },
      { key: 'ceil_factor', label: 'Ceiling Factor', kind: 'number' },
      { key: 'trim_factor', label: 'Trim Factor', kind: 'number' },
      { key: 'notes', label: 'Notes', kind: 'text' },
      { key: 'active', label: 'Active', kind: 'yn', defaultValue: 'Y' },
    ],
    (values) => ({
      id: values.id,
      display_name: values.display_name,
      wall_factor: values.wall_factor,
      ceil_factor: values.ceil_factor,
      trim_factor: values.trim_factor,
      notes: values.notes,
      active: values.active as 'Y' | 'N',
    })
  ),
  room_types: createParser(
    'room_types',
    [
      { key: 'id', label: 'ID', kind: 'text', required: true },
      { key: 'display_name', label: 'Display Name', kind: 'text', required: true },
      { key: 'default_wall_rate_id', label: 'Default Wall Rate ID', kind: 'text' },
      { key: 'default_ceil_rate_id', label: 'Default Ceiling Rate ID', kind: 'text' },
      { key: 'default_complexity_id', label: 'Default Complexity ID', kind: 'text' },
      { key: 'default_wall_mode', label: 'Default Wall Mode', kind: 'select', options: ['RECT', 'SEG'] },
      { key: 'top_cut_in_factor', label: 'Top Cut-In Factor', kind: 'number' },
      { key: 'bot_cut_in_factor', label: 'Bottom Cut-In Factor', kind: 'number' },
      { key: 'typical_height_ft', label: 'Typical Height', kind: 'number' },
      { key: 'notes', label: 'Notes', kind: 'text' },
      { key: 'active', label: 'Active', kind: 'yn', defaultValue: 'Y' },
    ],
    (values) => ({
      id: values.id,
      display_name: values.display_name,
      default_wall_rate_id: values.default_wall_rate_id,
      default_ceil_rate_id: values.default_ceil_rate_id,
      default_complexity_id: values.default_complexity_id,
      default_wall_mode: values.default_wall_mode,
      top_cut_in_factor: values.top_cut_in_factor,
      bot_cut_in_factor: values.bot_cut_in_factor,
      typical_height_ft: values.typical_height_ft,
      notes: values.notes,
      active: values.active as 'Y' | 'N',
    })
  ),
  room_templates: createParser(
    'room_templates',
    [
      { key: 'id', label: 'ID', kind: 'text', required: true },
      { key: 'display_name', label: 'Display Name', kind: 'text', required: true },
      { key: 'room_type_id', label: 'Room Type ID', kind: 'text' },
      { key: 'default_wall_rate_id', label: 'Default Wall Rate ID', kind: 'text' },
      { key: 'default_ceil_rate_id', label: 'Default Ceiling Rate ID', kind: 'text' },
      { key: 'default_complexity_id', label: 'Default Complexity ID', kind: 'text' },
      { key: 'default_wall_mode', label: 'Default Wall Mode', kind: 'select', options: ['RECT', 'SEG'] },
      { key: 'include_walls', label: 'Include Walls', kind: 'yn', defaultValue: 'Y' },
      { key: 'include_ceilings', label: 'Include Ceilings', kind: 'yn', defaultValue: 'N' },
      { key: 'include_trim', label: 'Include Trim', kind: 'yn', defaultValue: 'N' },
      { key: 'include_doors', label: 'Include Doors', kind: 'yn', defaultValue: 'N' },
      { key: 'include_drywall', label: 'Include Drywall', kind: 'yn', defaultValue: 'N' },
      { key: 'notes', label: 'Notes', kind: 'text' },
      { key: 'active', label: 'Active', kind: 'yn', defaultValue: 'Y' },
    ],
    (values) => ({
      id: values.id,
      display_name: values.display_name,
      room_type_id: values.room_type_id,
      default_wall_rate_id: values.default_wall_rate_id,
      default_ceil_rate_id: values.default_ceil_rate_id,
      default_complexity_id: values.default_complexity_id,
      default_wall_mode: values.default_wall_mode,
      include_walls: values.include_walls as 'Y' | 'N',
      include_ceilings: values.include_ceilings as 'Y' | 'N',
      include_trim: values.include_trim as 'Y' | 'N',
      include_doors: values.include_doors as 'Y' | 'N',
      include_drywall: values.include_drywall as 'Y' | 'N',
      notes: values.notes,
      active: values.active as 'Y' | 'N',
    })
  ),
  scope_defaults: createParser(
    'scope_defaults',
    [
      { key: 'id', label: 'ID', kind: 'text', required: true },
      { key: 'display_name', label: 'Display Name', kind: 'text', required: true },
      { key: 'default_wall_mode', label: 'Default Wall Mode', kind: 'select', options: ['RECT', 'SEG'] },
      { key: 'top_cut_in_factor', label: 'Top Cut-In Factor', kind: 'number' },
      { key: 'bot_cut_in_factor', label: 'Bottom Cut-In Factor', kind: 'number' },
      { key: 'typical_height_ft', label: 'Typical Height', kind: 'number' },
      { key: 'include_walls', label: 'Include Walls', kind: 'yn', defaultValue: 'Y' },
      { key: 'include_ceilings', label: 'Include Ceilings', kind: 'yn', defaultValue: 'N' },
      { key: 'include_trim', label: 'Include Trim', kind: 'yn', defaultValue: 'N' },
      { key: 'include_doors', label: 'Include Doors', kind: 'yn', defaultValue: 'N' },
      { key: 'include_drywall', label: 'Include Drywall', kind: 'yn', defaultValue: 'N' },
      { key: 'notes', label: 'Notes', kind: 'text' },
      { key: 'active', label: 'Active', kind: 'yn', defaultValue: 'Y' },
    ],
    (values) => ({
      id: values.id,
      display_name: values.display_name,
      default_wall_mode: values.default_wall_mode,
      top_cut_in_factor: values.top_cut_in_factor,
      bot_cut_in_factor: values.bot_cut_in_factor,
      typical_height_ft: values.typical_height_ft,
      include_walls: values.include_walls as 'Y' | 'N',
      include_ceilings: values.include_ceilings as 'Y' | 'N',
      include_trim: values.include_trim as 'Y' | 'N',
      include_doors: values.include_doors as 'Y' | 'N',
      include_drywall: values.include_drywall as 'Y' | 'N',
      notes: values.notes,
      active: values.active as 'Y' | 'N',
    })
  ),
}

function parseCategory(input: RawObject): ParseResult<RatesFlagsEditableCategoryKey> {
  const category = asText(input.category) as RatesFlagsEditableCategoryKey
  if (!category) return { ok: false, error: 'Body must include category and action.' }
  if (!(category in MUTATION_PARSERS)) {
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
