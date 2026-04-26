import type { TemplateConstantRowRecord } from './categoryTypes.ts'
import { CATEGORY_CONFIGS } from './categories.ts'
import { toStringRecord } from './categoryHelpers.ts'
import {
  asBooleanYN,
  asText,
  isAreaBasedUnit,
  normalizeId,
  normalizeProductionScope,
  parseNumber,
  type RatesFlagsCatalogOverlay,
} from './shared.ts'

export function buildOverlayFromRows(params: {
  templateVersion: number
  rows: TemplateConstantRowRecord[]
}): RatesFlagsCatalogOverlay {
  const grouped = new Map<TemplateConstantRowRecord['category_key'], TemplateConstantRowRecord[]>()
  for (const config of CATEGORY_CONFIGS) grouped.set(config.key, [])
  for (const row of params.rows) {
    const existing = grouped.get(row.category_key)
    if (existing) {
      existing.push(row)
      continue
    }
    grouped.set(row.category_key, [row])
  }

  const production_rates: RatesFlagsCatalogOverlay['production_rates'] = []
  const height_factors: RatesFlagsCatalogOverlay['height_factors'] = []
  const room_types: RatesFlagsCatalogOverlay['room_types'] = []
  const wall_complexity_types: RatesFlagsCatalogOverlay['wall_complexity_types'] = []
  const ceiling_types: RatesFlagsCatalogOverlay['ceiling_types'] = []
  const room_flags: RatesFlagsCatalogOverlay['room_flags'] = []
  const condition_modifiers: RatesFlagsCatalogOverlay['condition_modifiers'] = []
  const access_fees: RatesFlagsCatalogOverlay['access_fees'] = []
  const trim_items: RatesFlagsCatalogOverlay['trim_items'] = []
  const area_supplies_rates: RatesFlagsCatalogOverlay['area_supplies_rates'] = []

  const productionRows = [
    ...(grouped.get('production_rates_walls') ?? []),
    ...(grouped.get('production_rates_ceilings') ?? []),
    ...(grouped.get('production_rates_trim') ?? []),
  ]
  for (const row of productionRows) {
    const values = toStringRecord(row.values_json)
    const scope =
      normalizeProductionScope(values.production_scope || values.scope_id) ||
      normalizeProductionScope(values.display_name)
    const scopeId =
      asText(values.scope_id) ||
      (scope === 'ceilings' ? 'CEILINGS' : scope === 'walls' ? 'WALLS' : scope === 'trim' ? 'TRIM' : '')
    production_rates.push({
      id: normalizeId(values.id || row.row_id),
      label: asText(values.display_name) || row.display_name,
      scope_id: scopeId || null,
      surface_type: asText(values.surface_type) || null,
      condition: asText(values.condition) || null,
      prep_sqft_per_hr: parseNumber(values.prep_sqft_per_hr),
      sqft_per_hr: parseNumber(values.sqft_per_hr),
      primer_sqft_per_hr: parseNumber(values.primer_sqft_per_hr),
      notes: asText(values.notes) || null,
      active: row.active,
    })
  }

  for (const row of grouped.get('height_factors') ?? []) {
    const values = toStringRecord(row.values_json)
    height_factors.push({
      id: normalizeId(values.id || row.row_id),
      label: asText(values.display_name) || row.display_name,
      min_height_ft: parseNumber(values.min_height_ft),
      max_height_ft: parseNumber(values.max_height_ft),
      labor_multiplier: parseNumber(values.primary_value),
      notes: asText(values.notes) || null,
      active: row.active,
    })
  }

  for (const row of grouped.get('room_types') ?? []) {
    const values = toStringRecord(row.values_json)
    const wallMode = asText(values.default_wall_mode).toUpperCase()
    room_types.push({
      id: normalizeId(values.id || row.row_id),
      label: asText(values.display_name) || row.display_name || normalizeId(values.id || row.row_id),
      default_wall_rate_id: asText(values.default_wall_rate_id) || null,
      default_ceil_rate_id: asText(values.default_ceil_rate_id) || null,
      top_cut_in_factor: parseNumber(values.top_cut_in_factor),
      bot_cut_in_factor: parseNumber(values.bot_cut_in_factor),
      height_factor_ovr: parseNumber(values.height_factor_ovr ?? values.typical_height_ft),
      default_complexity_id: asText(values.default_complexity_id) || null,
      default_wall_mode: wallMode === 'RECT' || wallMode === 'SEG' ? wallMode : null,
      notes: asText(values.notes) || null,
      active: row.active,
    })
  }

  for (const row of grouped.get('wall_complexity') ?? []) {
    const values = toStringRecord(row.values_json)
    wall_complexity_types.push({
      id: normalizeId(values.id || row.row_id),
      label: asText(values.display_name) || row.display_name,
      labor_multiplier: parseNumber(values.primary_value),
      access_fee: parseNumber(values.secondary_value),
      active: row.active,
    })
  }

  for (const row of grouped.get('ceiling_types') ?? []) {
    const values = toStringRecord(row.values_json)
    ceiling_types.push({
      id: normalizeId(values.id || row.row_id),
      label: asText(values.display_name) || row.display_name,
      labor_mult: parseNumber(values.primary_value),
      area_factor: parseNumber(values.area_factor),
      surcharge_per_sqft: parseNumber(values.secondary_value),
      notes: asText(values.notes) || null,
      active: row.active,
    })
  }

  for (const row of grouped.get('condition_modifiers') ?? []) {
    const valuesJson = (row.values_json ?? {}) as Record<string, unknown>
    const values = toStringRecord(row.values_json)
    const levels =
      valuesJson.levels && typeof valuesJson.levels === 'object' && !Array.isArray(valuesJson.levels)
        ? Object.fromEntries(
            Object.entries(valuesJson.levels as Record<string, unknown>)
              .map(([key, value]) => [key.toLowerCase(), parseNumber(value)] as const)
              .filter((entry): entry is [string, number] => entry[1] != null)
          )
        : null
    const scope = asText(values.scope).toLowerCase()
    const normalizedScope =
      scope === 'room' || scope === 'wall' || scope === 'ceiling' || scope === 'trim'
        ? scope
        : scope === 'ceil' || scope === 'ceilings'
          ? 'ceiling'
          : scope === 'walls'
            ? 'wall'
            : ''
    if (normalizedScope && levels) {
      condition_modifiers.push({
        id: normalizeId(values.id || row.row_id),
        label: asText(values.display_name) || row.display_name,
        scope: normalizedScope,
        modifier_type: asText(values.modifier_type).toLowerCase() === 'binary' ? 'binary' : 'severity',
        factor_field: asText(values.factor_field) || null,
        levels,
        notes: asText(values.notes) || null,
        active: row.active,
      })
    }
    room_flags.push({
      id: normalizeId(values.id || row.row_id),
      label: asText(values.display_name) || row.display_name,
      wall_factor: parseNumber(values.wall_factor),
      ceil_factor: parseNumber(values.ceil_factor),
      trim_factor: parseNumber(values.trim_factor),
      notes: asText(values.notes) || null,
      active: row.active,
    })
  }

  const accessRows = [
    ...(grouped.get('access_fees_ladders') ?? []),
    ...(grouped.get('access_fees_scaffolding') ?? []),
    ...(grouped.get('access_fees_specialty') ?? []),
  ]
  for (const row of accessRows) {
    const values = toStringRecord(row.values_json)
    access_fees.push({
      id: normalizeId(values.id || row.row_id),
      label: asText(values.display_name) || row.display_name,
      fee_type: asText(values.fee_type) || null,
      amount: parseNumber(values.amount),
      unit: asText(values.unit) || null,
      notes: asText(values.notes) || null,
      active: row.active,
    })
  }

  for (const row of grouped.get('unit_rates_trim') ?? []) {
    const values = toStringRecord(row.values_json)
    trim_items.push({
      id: normalizeId(values.id || row.row_id),
      label: asText(values.display_name) || row.display_name || normalizeId(values.id || row.row_id),
      unit: asText(values.unit) || null,
      family: asText(values.unit_rate_type) || null,
      unit_type: asText(values.unit) || null,
      helper_allowed: asBooleanYN(values.helper_allowed),
      default_production_rate_id: asText(values.default_production_rate_id) || null,
      production_rate_id: asText(values.default_production_rate_id) || null,
      notes: asText(values.notes) || null,
      default_qty: parseNumber(values.default_qty),
      category: asText(values.unit_rate_type) || null,
      size: asText(values.unit_rate_type) || null,
      active: row.active,
      trim_category: asText(values.trim_category) || null,
      measurement_class: asText(values.measurement_class) || null,
      picker_group: asText(values.picker_group) || null,
    })
  }

  const areaSupplyRows = [
    ...(grouped.get('supply_rates_area_based') ?? []),
    ...(grouped.get('supply_rates_per_color') ?? []),
    ...(grouped.get('supply_rates_per_job') ?? []),
  ]
  for (const row of areaSupplyRows) {
    const values = toStringRecord(row.values_json)
    const supplyGroup = asText(values.supply_group).toLowerCase()
    const unit = asText(values.unit) || '$/sqft'
    const normalizedSupplyGroup =
      supplyGroup === 'per_color' || supplyGroup === 'per_job' || supplyGroup === 'area_based'
        ? supplyGroup
        : isAreaBasedUnit(unit)
          ? 'area_based'
          : 'per_job'
    area_supplies_rates.push({
      key: normalizeId(values.id || row.row_id),
      supply_group: normalizedSupplyGroup,
      scope: asText(values.scope) || null,
      unit,
      value: parseNumber(values.cost_per) ?? 0,
      crew_multiplier: asText(values.crew_multiplier).toUpperCase() === 'Y' ? 'Y' : 'N',
      notes: asText(values.notes) || null,
      active: row.active,
    })
  }

  return {
    template_version: params.templateVersion,
    production_rates,
    height_factors,
    room_types,
    wall_complexity_types,
    ceiling_types,
    room_flags,
    condition_modifiers,
    access_fees,
    trim_items,
    area_supplies_rates,
  }
}
