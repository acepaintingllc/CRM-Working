import {
  asNullableNumber,
  asText,
  type UnsafeRecord as Unsafe,
} from '../../estimator/parsing.ts'
import { normalizeTrimPaintGallons } from '../trimPaint.ts'
import type { EstimateJobSettingsPersistenceRow } from './persistenceTypes.ts'

type ExistingEstimateJobSettingsRow = Partial<EstimateJobSettingsPersistenceRow> & Unsafe

export function buildEstimateJobSettingsPersistenceRow(params: {
  orgId: string
  estimateId: string
  jobId: string
  row: Unsafe
  existingRow: ExistingEstimateJobSettingsRow
}): EstimateJobSettingsPersistenceRow {
  const row = params.row
  const existingRow = params.existingRow
  const has = (key: string) => Object.prototype.hasOwnProperty.call(row, key)

  const trimPaintGallons = asNullableNumber(row.trim_paint_gallons)
  const trimPaintQuarts = asNullableNumber(row.trim_paint_quarts)
  const legacyTrimPaintQty = asNullableNumber(row.trim_paint_qty)
  const legacyTrimPaintUom = asText(row.trim_paint_uom).toLowerCase()
  const normalizedTrimPaintGallons =
    trimPaintGallons != null || trimPaintQuarts != null
      ? normalizeTrimPaintGallons(trimPaintGallons, trimPaintQuarts)
      : legacyTrimPaintQty != null
        ? legacyTrimPaintUom === 'quart'
          ? legacyTrimPaintQty / 4
          : legacyTrimPaintQty
        : null
  const normalizedTrimPaintQuarts =
    trimPaintQuarts != null
      ? trimPaintQuarts
      : legacyTrimPaintQty != null && legacyTrimPaintUom === 'quart'
        ? legacyTrimPaintQty
        : 0

  return {
    org_id: params.orgId,
    estimate_id: params.estimateId,
    job_id: params.jobId,
    walls_paint_id: has('walls_paint_id')
      ? asText(row.walls_paint_id) || null
      : existingRow.walls_paint_id ?? null,
    ceiling_paint_id: has('ceiling_paint_id')
      ? asText(row.ceiling_paint_id) || null
      : existingRow.ceiling_paint_id ?? null,
    trim_paint_id: has('trim_paint_id')
      ? asText(row.trim_paint_id) || null
      : existingRow.trim_paint_id ?? null,
    primer_id:
      has('primer_id') || has('walls_primer_id') || has('ceiling_primer_id') || has('trim_primer_id')
        ? asText(row.primer_id) ||
          asText(row.walls_primer_id) ||
          asText(row.ceiling_primer_id) ||
          asText(row.trim_primer_id) ||
          null
        : existingRow.primer_id ?? null,
    walls_primer_id: has('walls_primer_id')
      ? asText(row.walls_primer_id) || null
      : existingRow.walls_primer_id ?? null,
    ceiling_primer_id: has('ceiling_primer_id')
      ? asText(row.ceiling_primer_id) || null
      : existingRow.ceiling_primer_id ?? null,
    trim_primer_id: has('trim_primer_id')
      ? asText(row.trim_primer_id) || null
      : existingRow.trim_primer_id ?? null,
    override_labor_rate: has('override_labor_rate')
      ? asNullableNumber(row.override_labor_rate)
      : existingRow.override_labor_rate ?? null,
    override_markup: has('override_markup')
      ? asNullableNumber(row.override_markup)
      : existingRow.override_markup ?? null,
    rounding_increment_hours: has('rounding_increment_hours')
      ? asNullableNumber(row.rounding_increment_hours)
      : existingRow.rounding_increment_hours ?? null,
    dayhours: has('dayhours') ? asNullableNumber(row.dayhours) : existingRow.dayhours ?? null,
    default_walls_prep_level: has('default_walls_prep_level')
      ? asText(row.default_walls_prep_level) || null
      : existingRow.default_walls_prep_level ?? null,
    default_ceiling_prep_level: has('default_ceiling_prep_level')
      ? asText(row.default_ceiling_prep_level) || null
      : existingRow.default_ceiling_prep_level ?? null,
    default_trim_prep_level: has('default_trim_prep_level')
      ? asText(row.default_trim_prep_level) || null
      : existingRow.default_trim_prep_level ?? null,
    notes: has('notes') ? asText(row.notes) || null : existingRow.notes ?? null,
    walls_paint_gal_override: has('walls_paint_gal_override')
      ? asNullableNumber(row.walls_paint_gal_override)
      : existingRow.walls_paint_gal_override ?? null,
    ceiling_paint_gal_override: has('ceiling_paint_gal_override')
      ? asNullableNumber(row.ceiling_paint_gal_override)
      : existingRow.ceiling_paint_gal_override ?? null,
    primer_gal_override: has('primer_gal_override')
      ? asNullableNumber(row.primer_gal_override)
      : existingRow.primer_gal_override ?? null,
    extra_supplies_walls: has('extra_supplies_walls')
      ? asNullableNumber(row.extra_supplies_walls)
      : existingRow.extra_supplies_walls ?? null,
    extra_supplies_ceilings: has('extra_supplies_ceilings')
      ? asNullableNumber(row.extra_supplies_ceilings)
      : existingRow.extra_supplies_ceilings ?? null,
    extra_supplies_trim: has('extra_supplies_trim')
      ? asNullableNumber(row.extra_supplies_trim)
      : existingRow.extra_supplies_trim ?? null,
    trim_paint_gallons:
      has('trim_paint_gallons') || has('trim_paint_quarts') || has('trim_paint_qty') || has('trim_paint_uom')
        ? normalizedTrimPaintGallons
        : existingRow.trim_paint_gallons ?? null,
    trim_paint_quarts:
      has('trim_paint_gallons') || has('trim_paint_quarts') || has('trim_paint_qty') || has('trim_paint_uom')
        ? normalizedTrimPaintQuarts
        : existingRow.trim_paint_quarts ?? null,
    trim_paint_qty:
      has('trim_paint_gallons') || has('trim_paint_quarts') || has('trim_paint_qty') || has('trim_paint_uom')
        ? normalizedTrimPaintGallons
        : existingRow.trim_paint_qty ?? null,
    trim_paint_uom:
      has('trim_paint_gallons') || has('trim_paint_quarts') || has('trim_paint_qty') || has('trim_paint_uom')
        ? normalizedTrimPaintGallons != null
          ? 'Gallon'
          : null
        : existingRow.trim_paint_uom ?? null,
    trim_primer_qty: has('trim_primer_qty')
      ? asNullableNumber(row.trim_primer_qty)
      : existingRow.trim_primer_qty ?? null,
    trim_primer_uom: has('trim_primer_uom')
      ? asText(row.trim_primer_uom) || null
      : existingRow.trim_primer_uom ?? null,
    paint_supplied_by: has('paint_supplied_by')
      ? asText(row.paint_supplied_by) || null
      : existingRow.paint_supplied_by ?? null,
    crew_size: has('crew_size') ? asNullableNumber(row.crew_size) : existingRow.crew_size ?? null,
    standard_door_deduction_sf: has('standard_door_deduction_sf')
      ? asNullableNumber(row.standard_door_deduction_sf)
      : existingRow.standard_door_deduction_sf ?? null,
    standard_window_deduction_sf: has('standard_window_deduction_sf')
      ? asNullableNumber(row.standard_window_deduction_sf)
      : existingRow.standard_window_deduction_sf ?? null,
    baseboard_opening_deduction_lf: has('baseboard_opening_deduction_lf')
      ? asNullableNumber(row.baseboard_opening_deduction_lf)
      : existingRow.baseboard_opening_deduction_lf ?? null,
    labor_day_policy_enabled: has('labor_day_policy_enabled')
      ? typeof row.labor_day_policy_enabled === 'boolean'
        ? row.labor_day_policy_enabled
        : row.labor_day_policy_enabled == null
          ? undefined
          : Boolean(row.labor_day_policy_enabled)
      : existingRow.labor_day_policy_enabled,
    job_minimum_enabled: has('job_minimum_enabled')
      ? typeof row.job_minimum_enabled === 'boolean'
        ? row.job_minimum_enabled
        : row.job_minimum_enabled == null
          ? undefined
          : Boolean(row.job_minimum_enabled)
      : existingRow.job_minimum_enabled,
    job_minimum_amount: has('job_minimum_amount')
      ? asNullableNumber(row.job_minimum_amount)
      : existingRow.job_minimum_amount ?? null,
  }
}
