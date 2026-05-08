import { calculateAccessFeeRows, hasCrownTrimAccessEligibility } from './accessFees.ts'
import {
  DEFAULT_DAY_HOURS,
  DEFAULT_JOB_MINIMUM_AMOUNT,
  DEFAULT_ROUNDING_INCREMENT_HOURS,
} from './defaults.ts'
import { asNullableNumber, asText, type UnsafeRecord as Unsafe } from './parsing.ts'
import { buildEstimatePricingSummaryFromEngines, buildPerJobSupplyCost } from './pricingPolicies.ts'
import { parseConditionModifierRow } from './conditionModifiers.ts'
import type { CeilingCalculationScopeRow } from './ceilingTypes.ts'
import type { TrimUnitType } from './trimTypes.ts'
import type { WallCalculationCatalogs, WallCalculationScopeRow } from './wallsTypes.ts'
import type { EstimateV2AccessFeeOption, EstimateV2JobSettingsInput } from '@/types/estimator/v2'
import type {
  EstimateV2AccessFeeCalculationInputRow,
  EstimateV2CalculationJobSettingsInput,
} from '@/types/estimator/v2Boundary'

export type EstimatorV2ProductionRateRow = {
  id?: unknown
  scope_id?: unknown
  scope?: unknown
  sqft_per_hr?: unknown
  prep_sqft_per_hr?: unknown
  primer_sqft_per_hr?: unknown
  units_per_hour?: unknown
  prep_units_per_hour?: unknown
  primer_units_per_hour?: unknown
  active?: unknown
}

export type EstimatorV2EffectiveJobSettings = {
  walls_paint_id: string | null
  walls_primer_id: string | null
  ceiling_paint_id: string | null
  ceiling_primer_id: string | null
  trim_paint_id: string | null
  trim_primer_id: string | null
  override_labor_rate: number | null
  crew_size: number | null
  labor_day_policy_enabled: boolean | null
  dayhours: number | null
  rounding_increment_hours: number | null
  job_minimum_enabled: boolean | null
  job_minimum_amount: number | null
  standard_door_deduction_sf: number | null
  standard_window_deduction_sf: number | null
  baseboard_opening_deduction_lf: number | null
}

export type TrimPaintProduct = {
  label?: string | null
  price_per_gal?: number | null
}

export type TrimPaintInput = {
  paint_product_id: string | null
  paint_product_label: string | null
  gallons: number
  quarts: number
  normalized_gallons: number
  paint_cost: number
}

function normalizeId(value: unknown) {
  return asText(value).toUpperCase()
}

function positiveNumber(value: unknown) {
  const parsed = asNullableNumber(value)
  return parsed != null && parsed > 0 ? parsed : null
}

function defaultText(payloadValue: unknown, orgValue: unknown) {
  return asText(payloadValue) || asText(orgValue) || null
}

function defaultNumber(payloadValue: unknown, orgValue: unknown) {
  return asNullableNumber(payloadValue) ?? asNullableNumber(orgValue)
}

function defaultBoolean(payloadValue: unknown, orgValue: unknown) {
  if (typeof payloadValue === 'boolean') return payloadValue
  if (typeof orgValue === 'boolean') return orgValue
  return null
}

function toTrimUnitType(value: unknown): TrimUnitType {
  const raw = asText(value).toUpperCase()
  if (raw === 'EA' || raw === 'SF') return raw
  return 'LF'
}

export function resolveEstimatorV2EffectiveJobSettings(params: {
  jobsettings: EstimateV2CalculationJobSettingsInput | Unsafe | null | undefined
  orgDefaults?: EstimateV2JobSettingsInput | Unsafe | null
}): EstimatorV2EffectiveJobSettings {
  const jobsettings = params.jobsettings ?? {}
  const orgDefaults = params.orgDefaults
  return {
    walls_paint_id: defaultText(
      jobsettings.walls_paint_id ?? jobsettings.wall_paint_id,
      orgDefaults?.walls_paint_id ?? orgDefaults?.wall_paint_id
    ),
    walls_primer_id: defaultText(
      jobsettings.walls_primer_id ?? jobsettings.wall_primer_id ?? jobsettings.primer_id,
      orgDefaults?.walls_primer_id ?? orgDefaults?.wall_primer_id ?? orgDefaults?.primer_id
    ),
    ceiling_paint_id: defaultText(jobsettings.ceiling_paint_id, orgDefaults?.ceiling_paint_id),
    ceiling_primer_id: defaultText(
      jobsettings.ceiling_primer_id ?? jobsettings.primer_id,
      orgDefaults?.ceiling_primer_id ?? orgDefaults?.primer_id
    ),
    trim_paint_id: defaultText(jobsettings.trim_paint_id, orgDefaults?.trim_paint_id),
    trim_primer_id: defaultText(
      jobsettings.trim_primer_id ?? jobsettings.primer_id,
      orgDefaults?.trim_primer_id ?? orgDefaults?.primer_id
    ),
    override_labor_rate: defaultNumber(jobsettings.override_labor_rate, orgDefaults?.override_labor_rate),
    crew_size: defaultNumber(jobsettings.crew_size, orgDefaults?.crew_size),
    labor_day_policy_enabled: defaultBoolean(
      jobsettings.labor_day_policy_enabled,
      orgDefaults?.labor_day_policy_enabled
    ),
    dayhours: defaultNumber(jobsettings.dayhours, orgDefaults?.dayhours),
    rounding_increment_hours: defaultNumber(
      jobsettings.rounding_increment_hours,
      orgDefaults?.rounding_increment_hours
    ),
    job_minimum_enabled: defaultBoolean(jobsettings.job_minimum_enabled, orgDefaults?.job_minimum_enabled),
    job_minimum_amount: defaultNumber(jobsettings.job_minimum_amount, orgDefaults?.job_minimum_amount),
    standard_door_deduction_sf: defaultNumber(
      jobsettings.standard_door_deduction_sf,
      orgDefaults?.standard_door_deduction_sf
    ),
    standard_window_deduction_sf: defaultNumber(
      jobsettings.standard_window_deduction_sf,
      orgDefaults?.standard_window_deduction_sf
    ),
    baseboard_opening_deduction_lf: defaultNumber(
      jobsettings.baseboard_opening_deduction_lf,
      orgDefaults?.baseboard_opening_deduction_lf
    ),
  }
}

export function buildEstimatorV2CalculationSettings(settings: EstimatorV2EffectiveJobSettings) {
  return {
    labor_rate_per_hour: settings.override_labor_rate,
    crew_size: resolveEstimatorV2CrewSize(settings),
    standard_door_deduction_sf: settings.standard_door_deduction_sf,
    standard_window_deduction_sf: settings.standard_window_deduction_sf,
    baseboard_opening_deduction_lf: settings.baseboard_opening_deduction_lf,
  }
}

export function resolveEstimatorV2CrewSize(settings: Pick<EstimatorV2EffectiveJobSettings, 'crew_size'>) {
  return Math.max(1, Math.floor(settings.crew_size ?? 1))
}

function isWallProductionRate(row: EstimatorV2ProductionRateRow) {
  const scope = normalizeId(row.scope_id ?? row.scope)
  return scope === 'WALLS' || scope === 'WALL'
}

export function applySelectedWallProductionRates<TScope extends WallCalculationScopeRow>(params: {
  rooms: Array<{ room_id?: unknown; wall_complexity_id?: unknown; wall_complexity_type_id?: unknown }>
  scopes: TScope[]
  productionRates: EstimatorV2ProductionRateRow[]
}): TScope[] {
  const ratesById = new Map<string, EstimatorV2ProductionRateRow>()
  for (const row of params.productionRates) {
    const id = normalizeId(row.id)
    if (id && isWallProductionRate(row)) ratesById.set(id, row)
  }
  if (ratesById.size === 0) return params.scopes

  const selectedRateByRoomId = new Map<string, EstimatorV2ProductionRateRow>()
  for (const room of params.rooms) {
    const roomId = normalizeId(room.room_id)
    const rateId = normalizeId(room.wall_complexity_id || room.wall_complexity_type_id)
    const rate = ratesById.get(rateId)
    if (roomId && rate) selectedRateByRoomId.set(roomId, rate)
  }
  if (selectedRateByRoomId.size === 0) return params.scopes

  return params.scopes.map((scope) => {
    const rate = selectedRateByRoomId.get(normalizeId(scope.room_id))
    if (!rate) return scope
    const paintRate = positiveNumber(rate.sqft_per_hr ?? rate.prep_sqft_per_hr ?? rate.units_per_hour)
    const primerRate = positiveNumber(rate.primer_sqft_per_hr ?? rate.primer_units_per_hour)
    if (paintRate == null && primerRate == null) return scope
    return {
      ...scope,
      paint_prod_rate_sqft_per_hour: positiveNumber(scope.paint_prod_rate_sqft_per_hour) ?? paintRate,
      primer_prod_rate_sqft_per_hour: positiveNumber(scope.primer_prod_rate_sqft_per_hour) ?? primerRate,
    }
  })
}

function isActive(row: EstimatorV2ProductionRateRow) {
  const active = normalizeId(row.active)
  return active !== 'N' && active !== 'FALSE' && active !== 'INACTIVE'
}

function isCeilingProductionRate(row: EstimatorV2ProductionRateRow) {
  const scope = normalizeId(row.scope_id ?? row.scope)
  return scope === 'CEILINGS' || scope === 'CEILING' || scope === 'CEIL'
}

export function applyBaseCeilingProductionRates<TScope extends CeilingCalculationScopeRow>(params: {
  scopes: TScope[]
  productionRates: EstimatorV2ProductionRateRow[]
}): TScope[] {
  const rate =
    params.productionRates.find(
      (row) => isActive(row) && isCeilingProductionRate(row) && normalizeId(row.id) === 'CEIL_STD'
    ) ?? null
  if (!rate) return params.scopes

  const paintRate = positiveNumber(rate.sqft_per_hr ?? rate.prep_sqft_per_hr ?? rate.units_per_hour)
  const primerRate = positiveNumber(rate.primer_sqft_per_hr ?? rate.primer_units_per_hour)
  if (paintRate == null && primerRate == null) return params.scopes

  return params.scopes.map((scope) => ({
    ...scope,
    paint_prod_rate_sqft_per_hour: positiveNumber(scope.paint_prod_rate_sqft_per_hour) ?? paintRate,
    primer_prod_rate_sqft_per_hour: positiveNumber(scope.primer_prod_rate_sqft_per_hour) ?? primerRate,
  }))
}

export type EstimatorV2RoomModeRoom = {
  room_id: string
  mode?: 'RECT' | 'SEG' | string | null
}

export type EstimatorV2RoomModeScope = {
  room_id: string
  mode?: 'RECT' | 'SEG' | string | null
}

export function resolveEstimatorV2RoomModeById(params: {
  rooms: EstimatorV2RoomModeRoom[]
  wallScopes: EstimatorV2RoomModeScope[]
  ceilingScopes: EstimatorV2RoomModeScope[]
  useRoomMode?: boolean
}) {
  const roomMode = new Map<string, 'RECT' | 'SEG'>()
  for (const scope of params.wallScopes) {
    const roomId = normalizeId(scope.room_id)
    if (!roomId || roomMode.has(roomId)) continue
    roomMode.set(roomId, normalizeId(scope.mode) === 'SEG' ? 'SEG' : 'RECT')
  }
  for (const scope of params.ceilingScopes) {
    const roomId = normalizeId(scope.room_id)
    if (!roomId || roomMode.has(roomId)) continue
    roomMode.set(roomId, normalizeId(scope.mode) === 'SEG' ? 'SEG' : 'RECT')
  }
  for (const room of params.rooms) {
    const roomId = normalizeId(room.room_id)
    if (!roomId || roomMode.has(roomId)) continue
    roomMode.set(roomId, params.useRoomMode && normalizeId(room.mode) === 'SEG' ? 'SEG' : 'RECT')
  }
  return roomMode
}

export function toWallCalculationCatalogs(raw: Unsafe | null | undefined): WallCalculationCatalogs {
  const catalogs = raw && typeof raw === 'object' ? raw : {}
  const paintProducts = Array.isArray(catalogs.paint_products) ? catalogs.paint_products : []
  const suppliesRates = Array.isArray(catalogs.supplies_rates) ? catalogs.supplies_rates : []
  const conditionModifiers = Array.isArray(catalogs.condition_modifiers) ? catalogs.condition_modifiers : []
  return {
    paint_products: paintProducts.map((row) => ({
      id: asText((row as Unsafe).id),
      type: asText((row as Unsafe).type),
      label: asText((row as Unsafe).label || (row as Unsafe).name || (row as Unsafe).type),
      price_per_gal: asNullableNumber((row as Unsafe).price_per_gal),
      coverage_sqft_per_gal_per_coat: asNullableNumber((row as Unsafe).coverage_sqft_per_gal_per_coat),
    })),
    supplies_rates: suppliesRates.map((row) => ({
      key: asText((row as Unsafe).key),
      supply_group: asText((row as Unsafe).supply_group) || null,
      scope: asText((row as Unsafe).scope) || null,
      unit: asText((row as Unsafe).unit) || null,
      value: asNullableNumber((row as Unsafe).value),
      crew_multiplier: asText((row as Unsafe).crew_multiplier).toUpperCase() === 'Y' ? 'Y' : 'N',
    })),
    condition_modifiers: conditionModifiers
      .map((row) => parseConditionModifierRow(row))
      .filter((row): row is NonNullable<ReturnType<typeof parseConditionModifierRow>> => row != null),
  }
}

export function toCeilingCalculationCatalogs(raw: Unsafe | null | undefined) {
  const catalogs = raw && typeof raw === 'object' ? raw : {}
  return {
    ...toWallCalculationCatalogs(raw),
    ceiling_types: Array.isArray(catalogs.ceiling_types)
      ? catalogs.ceiling_types.map((row) => ({
          id: asText((row as Unsafe).id),
          labor_mult: asNullableNumber((row as Unsafe).labor_mult),
          area_factor: asNullableNumber((row as Unsafe).area_factor),
        }))
      : [],
  }
}

export function toTrimCalculationCatalogs(raw: Unsafe | null | undefined) {
  const catalogs = raw && typeof raw === 'object' ? raw : {}
  return {
    ...toWallCalculationCatalogs(raw),
    trim_items: Array.isArray(catalogs.trim_items)
      ? catalogs.trim_items.map((row) => ({
          id: asText((row as Unsafe).id),
          family: asText((row as Unsafe).family || (row as Unsafe).category) || null,
          default_unit_type: toTrimUnitType((row as Unsafe).unit_type || (row as Unsafe).unit),
          helper_allowed: asText((row as Unsafe).helper_allowed).toUpperCase() === 'Y' || row.helper_allowed === true,
          default_production_rate_id:
            asText((row as Unsafe).default_production_rate_id || (row as Unsafe).production_rate_id) || null,
          trim_category: asText((row as Unsafe).trim_category) || null,
          measurement_class: asText((row as Unsafe).measurement_class) || null,
          picker_group: asText((row as Unsafe).picker_group) || null,
        }))
      : [],
    production_rates: Array.isArray(catalogs.production_rates)
      ? catalogs.production_rates
          .map((row) => ({
            id: asText((row as Unsafe).id),
            scope_id: asText((row as Unsafe).scope_id || (row as Unsafe).scope) || null,
            units_per_hour: asNullableNumber((row as Unsafe).sqft_per_hr ?? (row as Unsafe).units_per_hour),
            prep_units_per_hour: asNullableNumber(
              (row as Unsafe).prep_sqft_per_hr ?? (row as Unsafe).prep_units_per_hour
            ),
            primer_units_per_hour: asNullableNumber(
              (row as Unsafe).primer_sqft_per_hr ?? (row as Unsafe).primer_units_per_hour
            ),
          }))
          .filter((row) => row.id)
      : [],
  }
}

export function toDoorCalculationCatalogs(raw: Unsafe | null | undefined) {
  const catalogs = raw && typeof raw === 'object' ? raw : {}
  const categoryRows = Array.isArray(catalogs.categories)
    ? ((catalogs.categories.find((entry) => asText((entry as Unsafe).key) === 'unit_rates_doors') as Unsafe | undefined)?.rows as Unsafe[] | undefined)
    : undefined
  const rows = Array.isArray(catalogs.door_types)
    ? catalogs.door_types
    : Array.isArray(catalogs.unit_rates_doors)
      ? catalogs.unit_rates_doors
      : Array.isArray(categoryRows)
        ? categoryRows
        : []
  return {
    door_unit_rates: rows
      .filter((row) => (row as Unsafe).active !== false)
      .map((row) => ({
        id: asText((row as Unsafe).id).toUpperCase(),
        label: asText((row as Unsafe).label || (row as Unsafe).display_name || (row as Unsafe).id),
        unit_rate_type: asText((row as Unsafe).unit_rate_type) || null,
        unit: asText((row as Unsafe).unit) || null,
        default_qty: asNullableNumber((row as Unsafe).default_qty),
        labor_rate: asNullableNumber((row as Unsafe).labor_rate),
        material_rate: asNullableNumber((row as Unsafe).material_rate),
        amount: asNullableNumber((row as Unsafe).amount),
      }))
      .filter((row) => row.id),
  }
}

export function toDrywallCalculationCatalogs(raw: Unsafe | null | undefined) {
  const catalogs = raw && typeof raw === 'object' ? raw : {}
  const categoryRows = Array.isArray(catalogs.categories)
    ? ((catalogs.categories.find((entry) => asText((entry as Unsafe).key) === 'unit_rates_drywall') as Unsafe | undefined)?.rows as Unsafe[] | undefined)
    : undefined
  const rows = Array.isArray(catalogs.drywall_rates)
    ? catalogs.drywall_rates
    : Array.isArray(catalogs.unit_rates_drywall)
      ? catalogs.unit_rates_drywall
      : Array.isArray(categoryRows)
        ? categoryRows
        : []
  return {
    drywall_unit_rates: rows
      .filter((row) => (row as Unsafe).active !== false)
      .map((row) => ({
        id: asText((row as Unsafe).id).toLowerCase(),
        label: asText((row as Unsafe).label || (row as Unsafe).display_name || (row as Unsafe).id),
        unit_rate_type: asText((row as Unsafe).unit_rate_type).toLowerCase() || null,
        unit: asText((row as Unsafe).unit).toUpperCase() || null,
        amount: asNullableNumber((row as Unsafe).amount),
        labor_rate: asNullableNumber((row as Unsafe).labor_rate),
        material_rate: asNullableNumber((row as Unsafe).material_rate),
        ceiling_multiplier: asNullableNumber((row as Unsafe).ceiling_multiplier),
      }))
      .filter((row) => row.id),
  }
}

export function productMapFromWallCatalog(catalogs: WallCalculationCatalogs | null | undefined) {
  return new Map((catalogs?.paint_products ?? []).map((row) => [row.id, row as TrimPaintProduct]))
}

export function normalizeTrimPaintGallons(gallons: unknown, quarts: unknown) {
  const gallonsValue = asNullableNumber(gallons) ?? 0
  const quartsValue = asNullableNumber(quarts) ?? 0
  return Math.max(gallonsValue + quartsValue / 4, 0)
}

export function buildTrimPaintInput(params: {
  jobsettings: EstimateV2CalculationJobSettingsInput | null | undefined
  productId: string | null | undefined
  product: TrimPaintProduct | null | undefined
}): TrimPaintInput | null {
  const row = params.jobsettings
  if (!row || !params.productId) return null
  const gallons = asNullableNumber(row.trim_paint_gallons)
  const quarts = asNullableNumber(row.trim_paint_quarts)
  const legacyQty = asNullableNumber(row.trim_paint_qty)
  const legacyUnit = asText(row.trim_paint_uom).toLowerCase()
  const normalizedGallons =
    gallons != null || quarts != null
      ? normalizeTrimPaintGallons(gallons, quarts)
      : legacyQty != null
        ? legacyUnit === 'quart'
          ? legacyQty / 4
          : legacyQty
        : 0
  const wholeGallons = gallons != null ? gallons : Math.floor(normalizedGallons)
  const remainingQuarts = quarts != null ? quarts : Math.max(Math.round((normalizedGallons - wholeGallons) * 4), 0)

  return {
    paint_product_id: params.productId,
    paint_product_label: params.product?.label ?? null,
    gallons: wholeGallons,
    quarts: remainingQuarts,
    normalized_gallons: normalizedGallons,
    paint_cost: normalizedGallons * (params.product?.price_per_gal ?? 0),
  }
}

export function buildAccessFeeDrafts(rows: EstimateV2AccessFeeCalculationInputRow[] | null | undefined) {
  return (rows ?? []).map((row, index) => ({
    id: asText(row.id) || `access-fee-${index}`,
    roomId: asText(row.room_id).toUpperCase(),
    accessFeeId: asText(row.access_fee_id),
    qty: asText(row.qty),
    actualCostOverride: asText(row.actual_cost_override),
    notes: asText(row.notes),
    position: asNullableNumber(row.position) ?? index,
  }))
}

export function calculateEstimatorV2AccessFees(params: {
  rows: EstimateV2AccessFeeCalculationInputRow[] | null | undefined
  catalog: EstimateV2AccessFeeOption[]
}) {
  return calculateAccessFeeRows({
    drafts: buildAccessFeeDrafts(params.rows),
    catalog: params.catalog,
  })
}

export function buildEstimatorV2PricingSummary(params: {
  engines: Parameters<typeof buildEstimatePricingSummaryFromEngines>[0]
  settings: EstimatorV2EffectiveJobSettings
  wallCatalogs: WallCalculationCatalogs
  accessFeeTotal: number
  wallRoomTotals: Array<{ effective_total?: number | null }>
  ceilingRoomTotals: Array<{ effective_total?: number | null }>
  trimRoomTotals: Array<{ effective_total?: number | null }>
  wallScopes: Array<{ include?: unknown }>
  ceilingScopes: Array<{ include?: unknown }>
  trimScopes: Array<{ include?: unknown }>
  sourceTrimScopes: Array<{
    include?: unknown
    trim_family?: unknown
    trimFamily?: unknown
    trim_type_id?: unknown
    trimTypeId?: unknown
  }>
  trimPaintInput: TrimPaintInput | null
}) {
  const wallSubtotal = params.wallRoomTotals.reduce((sum, row) => sum + (row.effective_total ?? 0), 0)
  const ceilingSubtotal = params.ceilingRoomTotals.reduce((sum, row) => sum + (row.effective_total ?? 0), 0)
  const trimSubtotal = params.trimRoomTotals.reduce((sum, row) => sum + (row.effective_total ?? 0), 0)
  const subtotalForKind = (kind: 'doors' | 'drywall' | 'other') =>
    params.engines
      .filter((engine) => engine.kind === kind)
      .reduce(
        (sum, engine) =>
          sum +
          engine.output.room_totals.reduce((roomSum, row) => roomSum + row.effective_total, 0) +
          (kind === 'other' ? Math.max(0, engine.output.job_level_total ?? 0) : 0),
        0
      )
  const doorSubtotal = subtotalForKind('doors')
  const drywallSubtotal = subtotalForKind('drywall')
  const otherSubtotal = subtotalForKind('other')
  const crewSize = resolveEstimatorV2CrewSize(params.settings)

  return buildEstimatePricingSummaryFromEngines(
    params.engines,
    {
      enabled: params.settings.labor_day_policy_enabled !== false,
      dayhours: params.settings.dayhours ?? DEFAULT_DAY_HOURS,
      roundingIncrementHours: params.settings.rounding_increment_hours ?? DEFAULT_ROUNDING_INCREMENT_HOURS,
    },
    {
      enabled: params.settings.job_minimum_enabled === true,
      amount: params.settings.job_minimum_amount ?? DEFAULT_JOB_MINIMUM_AMOUNT,
    },
    params.trimPaintInput,
    buildPerJobSupplyCost({
      catalogs: params.wallCatalogs,
      crewSize,
      activeScopes: [
        params.wallScopes.some((scope) => scope.include === 'Y') ? 'walls' as const : null,
        params.ceilingScopes.some((scope) => scope.include === 'Y') ? 'ceilings' as const : null,
        params.trimScopes.some((scope) => scope.include === 'Y') ? 'trim' as const : null,
      ].filter((scope): scope is 'walls' | 'ceilings' | 'trim' => scope != null),
    }),
    {
      total: params.accessFeeTotal,
      scopes: [
        { key: 'walls', eligible: wallSubtotal > 0, preAccessSubtotal: wallSubtotal },
        { key: 'ceilings', eligible: ceilingSubtotal > 0, preAccessSubtotal: ceilingSubtotal },
        {
          key: 'trim',
          eligible: hasCrownTrimAccessEligibility(
            params.sourceTrimScopes.map((row) => ({
              include: asText(row.include).toUpperCase() === 'N' ? 'N' : 'Y',
              trimFamily: asText(row.trim_family || row.trimFamily),
              trimTypeId: asText(row.trim_type_id || row.trimTypeId),
            }))
          ),
          preAccessSubtotal: trimSubtotal,
        },
        { key: 'doors', eligible: doorSubtotal > 0, preAccessSubtotal: doorSubtotal },
        { key: 'drywall', eligible: drywallSubtotal > 0, preAccessSubtotal: drywallSubtotal },
        { key: 'other', eligible: otherSubtotal > 0, preAccessSubtotal: otherSubtotal },
      ],
    }
  )
}
