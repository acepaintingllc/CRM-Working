import { calculateCeilings } from './ceilings.ts'
import { calculateDoors } from './doors.ts'
import { calculateDrywallRepairs } from './drywall.ts'
import { calculateTrim } from './trim.ts'
import { calculateWalls } from './walls.ts'
import { asNullableNumber, asText, type UnsafeRecord as Unsafe } from './parsing.ts'
import type { CeilingCalculationScopeRow } from './ceilingTypes.ts'
import type { EstimateV2Catalogs, EstimateV2SavePayload } from '@/types/estimator/v2'
import type { DoorCalculationCatalogs } from '@/types/estimator/doors'
import type { DrywallCalculationCatalogs } from '@/types/estimator/drywall'
import type { WallCalculationCatalogs, WallCalculationScopeRow } from './wallsTypes.ts'

type ProductionRateRow = {
  id?: unknown
  scope_id?: unknown
  sqft_per_hr?: unknown
  prep_sqft_per_hr?: unknown
  primer_sqft_per_hr?: unknown
  active?: unknown
}

type PreviewCatalogs = EstimateV2Catalogs & {
  supplies_rates?: Unsafe[]
}

function normalizeId(value: unknown) {
  return asText(value).toUpperCase()
}

function positiveNumber(value: unknown) {
  const parsed = asNullableNumber(value)
  return parsed != null && parsed > 0 ? parsed : null
}

function toWallCalculationCatalogs(catalogs: PreviewCatalogs): WallCalculationCatalogs {
  return {
    paint_products: (catalogs.paint_products ?? []).map((row) => ({
      id: row.id,
      type: row.type,
      label: row.label,
      price_per_gal: asNullableNumber((row as unknown as Unsafe).price_per_gal),
      coverage_sqft_per_gal_per_coat: asNullableNumber(row.coverage_sqft_per_gal_per_coat),
    })),
    supplies_rates: Array.isArray(catalogs.supplies_rates)
      ? catalogs.supplies_rates.map((row) => ({
          key: asText(row.key),
          supply_group: asText(row.supply_group) || null,
          scope: asText(row.scope) || null,
          unit: asText(row.unit) || null,
          value: asNullableNumber(row.value) ?? 0,
          crew_multiplier: asText(row.crew_multiplier).toUpperCase() === 'Y' ? 'Y' : 'N',
        }))
      : [],
  }
}

function toCeilingCalculationCatalogs(catalogs: PreviewCatalogs) {
  return {
    ...toWallCalculationCatalogs(catalogs),
    ceiling_types: (catalogs.ceiling_types ?? []).map((row) => ({
      id: row.id,
      labor_mult: asNullableNumber(row.labor_mult),
      area_factor: asNullableNumber(row.area_factor),
    })),
  }
}

function toTrimCalculationCatalogs(catalogs: PreviewCatalogs) {
  return {
    ...toWallCalculationCatalogs(catalogs),
    trim_items: (catalogs.trim_items ?? []).map((row) => ({
      id: row.id,
      family: row.family ?? row.category ?? null,
      default_unit_type: row.unit_type,
      helper_allowed: row.helper_allowed === true,
      default_production_rate_id: row.default_production_rate_id,
      trim_category: row.trim_category ?? null,
      measurement_class: row.measurement_class ?? null,
      picker_group: row.picker_group ?? null,
    })),
    production_rates: (catalogs.production_rates ?? [])
      .map((row) => ({
        id: row.id,
        scope_id: row.scope_id,
        units_per_hour: asNullableNumber(row.sqft_per_hr),
        prep_units_per_hour: asNullableNumber(row.prep_sqft_per_hr),
        primer_units_per_hour: asNullableNumber(row.primer_sqft_per_hr),
      }))
      .filter((row) => row.id),
  }
}

function toDoorCalculationCatalogs(catalogs: PreviewCatalogs): DoorCalculationCatalogs {
  return {
    door_unit_rates: (catalogs.door_types ?? [])
      .map((row) => ({
        id: row.id.toUpperCase(),
        label: row.label,
        unit_rate_type: row.unit_rate_type,
        unit: row.unit,
        default_qty: asNullableNumber(row.default_qty),
        labor_rate: asNullableNumber(row.labor_rate),
        material_rate: asNullableNumber(row.material_rate),
        amount: asNullableNumber(row.amount),
      }))
      .filter((row) => row.id),
  }
}

function toDrywallCalculationCatalogs(catalogs: PreviewCatalogs): DrywallCalculationCatalogs {
  return {
    drywall_unit_rates: (catalogs.drywall_rates ?? [])
      .map((row) => ({
        id: row.id.toLowerCase(),
        label: row.label,
        unit_rate_type: asText(row.unit_rate_type).toLowerCase() || null,
        unit: asText(row.unit).toUpperCase() || null,
        amount: asNullableNumber(row.amount),
        labor_rate: asNullableNumber((row as unknown as Unsafe).labor_rate),
        material_rate: asNullableNumber((row as unknown as Unsafe).material_rate),
        ceiling_multiplier: asNullableNumber(row.ceiling_multiplier),
      }))
      .filter((row) => row.id),
  }
}

function isActive(row: ProductionRateRow) {
  const active = normalizeId(row.active)
  return active !== 'N' && active !== 'FALSE' && active !== 'INACTIVE'
}

function applySelectedWallProductionRates<TScope extends WallCalculationScopeRow>(params: {
  rooms: EstimateV2SavePayload['rooms']
  scopes: TScope[]
  productionRates: ProductionRateRow[]
}): TScope[] {
  const wallRatesById = new Map<string, ProductionRateRow>()
  for (const row of params.productionRates) {
    const scope = normalizeId(row.scope_id)
    const id = normalizeId(row.id)
    if (id && (scope === 'WALLS' || scope === 'WALL')) wallRatesById.set(id, row)
  }

  return params.scopes.map((scope) => {
    const room = params.rooms.find((item) => normalizeId(item.room_id) === normalizeId(scope.room_id))
    const rate = room ? wallRatesById.get(normalizeId(room.wall_complexity_id)) : null
    if (!rate) return scope
    return {
      ...scope,
      paint_prod_rate_sqft_per_hour:
        positiveNumber(scope.paint_prod_rate_sqft_per_hour) ??
        positiveNumber(rate.sqft_per_hr ?? rate.prep_sqft_per_hr),
      primer_prod_rate_sqft_per_hour:
        positiveNumber(scope.primer_prod_rate_sqft_per_hour) ?? positiveNumber(rate.primer_sqft_per_hr),
    }
  })
}

function applyBaseCeilingProductionRates<TScope extends CeilingCalculationScopeRow>(params: {
  scopes: TScope[]
  productionRates: ProductionRateRow[]
}): TScope[] {
  const rate =
    params.productionRates.find(
      (row) =>
        isActive(row) &&
        normalizeId(row.id) === 'CEIL_STD' &&
        ['CEILINGS', 'CEILING', 'CEIL'].includes(normalizeId(row.scope_id))
    ) ?? null
  if (!rate) return params.scopes

  return params.scopes.map((scope) => ({
    ...scope,
    paint_prod_rate_sqft_per_hour:
      positiveNumber(scope.paint_prod_rate_sqft_per_hour) ??
      positiveNumber(rate.sqft_per_hr ?? rate.prep_sqft_per_hr),
    primer_prod_rate_sqft_per_hour:
      positiveNumber(scope.primer_prod_rate_sqft_per_hour) ?? positiveNumber(rate.primer_sqft_per_hr),
  }))
}

function roomModeById(payload: EstimateV2SavePayload) {
  const next = new Map<string, 'RECT' | 'SEG'>()
  for (const room of payload.rooms) next.set(room.room_id, 'RECT')
  for (const scope of payload.room_wall_scopes) {
    if (asText(scope.mode) === 'SEG') next.set(asText(scope.room_id), 'SEG')
  }
  for (const scope of payload.room_ceiling_scopes) {
    if (asText(scope.mode) === 'SEG') next.set(asText(scope.room_id), 'SEG')
  }
  return next
}

function calculationSettings(payload: EstimateV2SavePayload) {
  return {
    labor_rate_per_hour: asNullableNumber(payload.jobsettings.override_labor_rate),
    crew_size: asNullableNumber(payload.jobsettings.crew_size),
    standard_door_deduction_sf: asNullableNumber(payload.jobsettings.standard_door_deduction_sf),
    standard_window_deduction_sf: asNullableNumber(payload.jobsettings.standard_window_deduction_sf),
    baseboard_opening_deduction_lf: asNullableNumber(payload.jobsettings.baseboard_opening_deduction_lf),
  }
}

export function calculateEstimateV2Preview(params: {
  payload: EstimateV2SavePayload
  catalogs: EstimateV2Catalogs
}) {
  const catalogs = params.catalogs as PreviewCatalogs
  const settings = calculationSettings(params.payload)
  const roomModes = roomModeById(params.payload)
  const productionRates = catalogs.production_rates ?? []

  const wallScopes = applySelectedWallProductionRates({
    rooms: params.payload.rooms,
    scopes: params.payload.room_wall_scopes.map((scope) => ({
      ...scope,
      paint_product_id: asText(scope.paint_product_id) || params.payload.jobsettings.walls_paint_id,
      primer_product_id: asText(scope.primer_product_id) || params.payload.jobsettings.walls_primer_id,
    })) as unknown as WallCalculationScopeRow[],
    productionRates,
  })
  const ceilingScopes = applyBaseCeilingProductionRates({
    scopes: params.payload.room_ceiling_scopes.map((scope) => ({
      ...scope,
      paint_product_id: asText(scope.paint_product_id) || params.payload.jobsettings.ceiling_paint_id,
      primer_product_id: asText(scope.primer_product_id) || params.payload.jobsettings.ceiling_primer_id,
    })) as unknown as CeilingCalculationScopeRow[],
    productionRates,
  })
  const trimScopes = params.payload.room_trim_scopes.map((scope) => ({
    ...scope,
    paint_product_id: asText(scope.paint_product_id) || params.payload.jobsettings.trim_paint_id,
    primer_product_id: asText(scope.primer_product_id) || params.payload.jobsettings.trim_primer_id,
  }))
  const doorScopes = (params.payload.room_door_scopes ?? []).map((scope) => ({
    ...scope,
    paint_product_id: asText(scope.paint_product_id) || params.payload.jobsettings.trim_paint_id,
    primer_product_id: asText(scope.primer_product_id) || params.payload.jobsettings.trim_primer_id,
  }))

  return {
    walls: calculateWalls({
      scopes: wallScopes,
      segments: params.payload.wall_segments as never,
      settings,
      catalogs: toWallCalculationCatalogs(catalogs),
    }),
    ceilings: calculateCeilings({
      scopes: ceilingScopes,
      segments: params.payload.ceiling_scope_segments as never,
      settings,
      catalogs: toCeilingCalculationCatalogs(catalogs),
    }),
    trim: calculateTrim({
      scopes: trimScopes as never,
      rooms: params.payload.rooms.map((room) => ({
        room_id: room.room_id,
        length_in: room.length_in,
        width_in: room.width_in,
        mode: roomModes.get(room.room_id) ?? 'RECT',
      })),
      settings,
      catalogs: toTrimCalculationCatalogs(catalogs),
    }),
    doors: calculateDoors({
      scopes: doorScopes as never,
      settings,
      catalogs: toDoorCalculationCatalogs(catalogs),
    }),
    drywall: calculateDrywallRepairs({
      repairs: (params.payload.drywall_repairs ?? []) as never,
      catalogs: toDrywallCalculationCatalogs(catalogs),
    }),
  }
}
