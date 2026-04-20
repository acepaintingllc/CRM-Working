import {
  n,
  nonNeg,
  normalizeInclude,
  pos,
  productMap,
  resolveSettings,
  round4,
  sumNumbers,
} from './wallsHelpers.ts'
import type {
  MissingInput,
  ResolvedSettings,
  WallPerColorSupplyGroup,
  WallRoomTotal,
  YN,
} from './wallsTypes.ts'
import type {
  TrimCalculationInput,
  TrimCalculationOutput,
  TrimCalculationRoomInput,
  TrimCalculationScopeRow,
  TrimProductionRateCatalogRow,
} from './trimTypes.ts'

type ScopeCalc = {
  scope_key: string
  scope_id: string | null
  row: TrimCalculationScopeRow
  raw_measurement: number | null
  effective_measurement: number | null
  raw_paint_hours: number | null
  effective_paint_hours: number | null
  raw_primer_hours: number | null
  effective_primer_hours: number | null
  raw_paint_gallons: number | null
  effective_paint_gallons: number | null
  raw_primer_gallons: number | null
  effective_primer_gallons: number | null
  area_supply_cost: number | null
  color_group_key: string | null
  color_allocated_cost: number
  raw_supply_cost: number | null
  effective_supply_cost: number | null
  raw_total: number
  effective_total_before_override: number
  effective_total: number
}

function trimScopeKey(scope: TrimCalculationScopeRow) {
  return scope.id ?? `${scope.room_id}::${scope.position}`
}

function resolveRoomPerimeter(room: TrimCalculationRoomInput) {
  if (room.mode !== 'RECT') return null
  const length = pos(n(room.length_in))
  const width = pos(n(room.width_in))
  if (length == null || width == null) return null
  return round4(2 * (length + width) / 12)
}

function buildProductionRateMaps(catalogs: TrimCalculationInput['catalogs']) {
  const byId = new Map<string, TrimProductionRateCatalogRow>()
  const byScopeId = new Map<string, TrimProductionRateCatalogRow>()

  for (const row of catalogs?.production_rates ?? []) {
    if (row.id) byId.set(row.id, row)
    if (row.scope_id) byScopeId.set(String(row.scope_id).toUpperCase(), row)
  }

  return { byId, byScopeId }
}

function buildTrimTypeRateMaps(catalogs: TrimCalculationInput['catalogs']) {
  const byId = new Map<
    string,
    {
      helper_allowed: boolean
      default_production_rate_id: string | null
    }
  >()

  for (const row of catalogs?.trim_items ?? []) {
    if (!row.id) continue
    byId.set(row.id.toUpperCase(), {
      helper_allowed: row.helper_allowed === true,
      default_production_rate_id: row.default_production_rate_id,
    })
  }

  return byId
}

function applyScopeCosts(
  scope: ScopeCalc,
  settings: ResolvedSettings,
  products: ReturnType<typeof productMap>
) {
  const laborRate = pos(n(scope.row.labor_rate_per_hour)) ?? settings.labor_rate_per_hour
  const primerProduct = scope.row.primer_product_id ? products.get(scope.row.primer_product_id) : undefined
  const primerPrice =
    pos(n(scope.row.primer_price_per_gal)) ??
    pos(n(primerProduct?.price_per_gal)) ??
    settings.primer_price_per_gal

  const rawLaborCost = round4(((scope.raw_paint_hours ?? 0) + (scope.raw_primer_hours ?? 0)) * laborRate)
  const effectiveLaborCost = round4(
    ((scope.effective_paint_hours ?? 0) + (scope.effective_primer_hours ?? 0)) * laborRate
  )
  const rawMaterialCost = round4((scope.raw_primer_gallons ?? 0) * primerPrice)
  const effectiveMaterialCost = round4((scope.effective_primer_gallons ?? 0) * primerPrice)

  scope.raw_total = round4(rawLaborCost + rawMaterialCost + (scope.raw_supply_cost ?? 0))
  scope.effective_total_before_override = round4(
    effectiveLaborCost + effectiveMaterialCost + (scope.effective_supply_cost ?? 0)
  )
  scope.effective_total = round4(nonNeg(n(scope.row.override_total)) ?? scope.effective_total_before_override)
}

function buildRoomTotals(scopeCalcs: ScopeCalc[]): WallRoomTotal[] {
  const totals = new Map<string, WallRoomTotal>()
  for (const scope of scopeCalcs) {
    const room: WallRoomTotal = totals.get(scope.row.room_id) ?? {
      room_id: scope.row.room_id,
      scope_count: 0,
      included_scope_count: 0,
      raw_area_sf: 0,
      effective_area_sf: 0,
      raw_paint_hours: 0,
      effective_paint_hours: 0,
      raw_primer_hours: 0,
      effective_primer_hours: 0,
      raw_paint_gallons: 0,
      effective_paint_gallons: 0,
      raw_paint_material_cost: 0,
      effective_paint_material_cost: 0,
      raw_primer_gallons: 0,
      effective_primer_gallons: 0,
      raw_supply_cost: 0,
      effective_supply_cost: 0,
      raw_total: 0,
      effective_total: 0,
    }

    room.scope_count += 1
    if (scope.row.include === 'Y') room.included_scope_count += 1
    room.raw_area_sf = round4(room.raw_area_sf + (scope.raw_measurement ?? 0))
    room.effective_area_sf = round4(room.effective_area_sf + (scope.effective_measurement ?? 0))
    room.raw_paint_hours = round4(room.raw_paint_hours + (scope.raw_paint_hours ?? 0))
    room.effective_paint_hours = round4(room.effective_paint_hours + (scope.effective_paint_hours ?? 0))
    room.raw_primer_hours = round4(room.raw_primer_hours + (scope.raw_primer_hours ?? 0))
    room.effective_primer_hours = round4(room.effective_primer_hours + (scope.effective_primer_hours ?? 0))
    room.raw_paint_gallons = round4(room.raw_paint_gallons + (scope.raw_paint_gallons ?? 0))
    room.effective_paint_gallons = round4(room.effective_paint_gallons + (scope.effective_paint_gallons ?? 0))
    room.raw_paint_material_cost = round4(room.raw_paint_material_cost + 0)
    room.effective_paint_material_cost = round4(room.effective_paint_material_cost + 0)
    room.raw_primer_gallons = round4(room.raw_primer_gallons + (scope.raw_primer_gallons ?? 0))
    room.effective_primer_gallons = round4(room.effective_primer_gallons + (scope.effective_primer_gallons ?? 0))
    room.raw_supply_cost = round4(room.raw_supply_cost + (scope.raw_supply_cost ?? 0))
    room.effective_supply_cost = round4(room.effective_supply_cost + (scope.effective_supply_cost ?? 0))
    room.raw_total = round4(room.raw_total + scope.raw_total)
    room.effective_total = round4(room.effective_total + scope.effective_total)
    totals.set(scope.row.room_id, room)
  }
  return Array.from(totals.values()).sort((a, b) => a.room_id.localeCompare(b.room_id))
}

function splitOverrideByRatio(rawPrimary: number, rawSecondary: number, overrideTotal: number) {
  const rawTotal = rawPrimary + rawSecondary
  if (rawTotal <= 0) {
    return { primary: round4(overrideTotal), secondary: 0 }
  }
  const primaryWeight = rawPrimary / rawTotal
  const primary = round4(overrideTotal * primaryWeight)
  return {
    primary,
    secondary: round4(Math.max(overrideTotal - primary, 0)),
  }
}

export function calculateTrim(input: TrimCalculationInput): TrimCalculationOutput {
  const settings = resolveSettings(input.settings, input.catalogs)
  const products = productMap(input.catalogs)
  const missingInputs: MissingInput[] = []
  const roomById = new Map(input.rooms.map((room) => [room.room_id, room] as const))

  const productionRates = buildProductionRateMaps(input.catalogs)
  const trimTypeMap = buildTrimTypeRateMaps(input.catalogs)

  const scopeCalcs: ScopeCalc[] = []
  const normalizedScopes = input.scopes.map((scope) => {
    const include: YN = normalizeInclude(scope.include)
    const scopeKey = trimScopeKey(scope)
    const room = roomById.get(scope.room_id)

    const helperAllowed =
      scope.trim_type_id != null
        ? trimTypeMap.get(scope.trim_type_id.toUpperCase())?.helper_allowed ?? false
        : false

    const manualMeasurement = nonNeg(n(scope.measurement_value))
    const helperValueFromRoom = room ? resolveRoomPerimeter(room) : null
    const helperValue = nonNeg(n(scope.helper_value)) ?? helperValueFromRoom

    let rawMeasurement: number | null = null
    if (scope.measurement_mode === 'ROOM_HELPER') {
      if (scope.helper_source !== 'ROOM_PERIMETER') {
        if (include === 'Y') {
          missingInputs.push({
            level: 'scope',
            room_id: scope.room_id,
            scope_id: scopeKey,
            segment_id: null,
            field: 'helper_source',
            message: `Trim scope ${scope.scope_name ?? scope.position + 1}: helper source is required`,
          })
        }
      } else if (!room || room.mode !== 'RECT' || !helperAllowed) {
        if (include === 'Y') {
          missingInputs.push({
            level: 'scope',
            room_id: scope.room_id,
            scope_id: scopeKey,
            segment_id: null,
            field: 'measurement_mode',
            message: `Trim scope ${scope.scope_name ?? scope.position + 1}: room helper requires RECT mode and eligible trim type`,
          })
        }
      } else {
        rawMeasurement = helperValue
      }
    } else {
      rawMeasurement = manualMeasurement
    }

    if (include === 'Y' && rawMeasurement == null) {
      missingInputs.push({
        level: 'scope',
        room_id: scope.room_id,
        scope_id: scopeKey,
        segment_id: null,
        field: scope.measurement_mode === 'ROOM_HELPER' ? 'helper_value' : 'measurement_value',
        message: `Trim scope ${scope.scope_name ?? scope.position + 1}: measurement is required`,
      })
    }

    const effectiveMeasurement =
      include === 'Y' ? round4(nonNeg(n(scope.override_measurement)) ?? rawMeasurement ?? 0) : 0

    let productionRateRow: TrimProductionRateCatalogRow | undefined
    const explicitProductionRateId = scope.production_rate_id ? scope.production_rate_id.toUpperCase() : null
    if (explicitProductionRateId) {
      productionRateRow = productionRates.byId.get(explicitProductionRateId)
    }

    if (!productionRateRow && scope.trim_type_id) {
      productionRateRow = productionRates.byScopeId.get(scope.trim_type_id.toUpperCase())
      if (!productionRateRow) {
        const mappedRateId = trimTypeMap.get(scope.trim_type_id.toUpperCase())?.default_production_rate_id
        if (mappedRateId) productionRateRow = productionRates.byId.get(mappedRateId.toUpperCase())
      }
    }

    const modifier = round4(
      (nonNeg(n(scope.prep_factor)) ?? 1) *
        (nonNeg(n(scope.height_factor)) ?? 1) *
        (nonNeg(n(scope.profile_factor)) ?? 1) *
        (nonNeg(n(scope.room_flag_factor)) ?? 1) *
        (nonNeg(n(scope.masking_factor)) ?? 1) *
        (nonNeg(n(scope.stair_factor)) ?? 1) *
        (nonNeg(n(scope.difficult_finish_factor)) ?? 1) *
        (nonNeg(n(scope.caulk_fill_factor)) ?? 1)
    )

    const paintEnabled = scope.paint_enabled === 'N' ? 'N' : 'Y'
    const paintCoats = paintEnabled === 'Y' ? pos(n(scope.paint_coats)) ?? settings.paint_coats : 0
    const primerCoats = paintEnabled === 'Y' ? pos(n(scope.primer_coats)) ?? settings.primer_coats : 0
    const spotPrimePercent = Math.min(100, nonNeg(n(scope.spot_prime_percent)) ?? settings.spot_prime_percent)

    const paintRate =
      pos(n(scope.paint_prod_rate_units_per_hour)) ??
      pos(n(productionRateRow?.units_per_hour)) ??
      settings.paint_prod_rate_sqft_per_hour
    const primerRate =
      pos(n(scope.primer_prod_rate_units_per_hour)) ??
      pos(n(productionRateRow?.primer_units_per_hour)) ??
      settings.primer_prod_rate_sqft_per_hour

    const paintProduct = scope.paint_product_id ? products.get(scope.paint_product_id) : undefined
    const primerProduct = scope.primer_product_id ? products.get(scope.primer_product_id) : undefined
    const paintCoverage =
      pos(n(scope.paint_coverage_units_per_gal_per_coat)) ??
      pos(n(paintProduct?.coverage_sqft_per_gal_per_coat)) ??
      settings.paint_coverage_sqft_per_gal_per_coat
    const primerCoverage =
      pos(n(scope.primer_coverage_units_per_gal_per_coat)) ??
      pos(n(primerProduct?.coverage_sqft_per_gal_per_coat)) ??
      settings.primer_coverage_sqft_per_gal_per_coat

    const primerMultiplier =
      paintEnabled === 'N' || scope.prime_mode === 'NONE'
        ? 0
        : scope.prime_mode === 'FULL'
          ? 1
          : spotPrimePercent / 100

    const primerMeasurement = include === 'Y' ? round4(effectiveMeasurement * primerMultiplier) : 0

    const rawPaintHours =
      include === 'Y' && paintEnabled === 'Y'
        ? round4(((effectiveMeasurement * paintCoats) / paintRate) * modifier)
        : 0
    const rawPrimerHours =
      include === 'Y' && paintEnabled === 'Y'
        ? round4(((primerMeasurement * primerCoats) / primerRate) * modifier)
        : 0

    const overrideHours = nonNeg(n(scope.override_hours))
    const effectiveHours =
      include === 'Y' && overrideHours != null
        ? splitOverrideByRatio(rawPaintHours, rawPrimerHours, round4(overrideHours))
        : { primary: rawPaintHours, secondary: rawPrimerHours }

    const rawPaintGallons =
      include === 'Y' && paintEnabled === 'Y'
        ? round4((effectiveMeasurement * paintCoats) / paintCoverage)
        : 0
    const rawPrimerGallons =
      include === 'Y' && paintEnabled === 'Y'
        ? round4((primerMeasurement * primerCoats) / primerCoverage)
        : 0

    const overrideGallons = nonNeg(n(scope.override_gallons))
    const effectiveGallons =
      include === 'Y' && overrideGallons != null
        ? splitOverrideByRatio(rawPaintGallons, rawPrimerGallons, round4(overrideGallons))
        : { primary: rawPaintGallons, secondary: rawPrimerGallons }

    const areaRate = pos(n(scope.area_supply_cost_per_unit)) ?? settings.area_supply_cost_per_sf
    const areaSupplyCost = include === 'Y' ? round4(effectiveMeasurement * areaRate) : 0

    const colorGroupKey =
      include === 'Y' && scope.color_id && paintEnabled === 'Y'
        ? `${scope.paint_product_id ?? 'PAINT'}::${scope.color_id}`
        : null

    const calc: ScopeCalc = {
      scope_key: scopeKey,
      scope_id: scope.id ?? null,
      row: { ...scope, include },
      raw_measurement: include === 'Y' ? rawMeasurement : 0,
      effective_measurement: effectiveMeasurement,
      raw_paint_hours: rawPaintHours,
      effective_paint_hours: effectiveHours.primary,
      raw_primer_hours: rawPrimerHours,
      effective_primer_hours: effectiveHours.secondary,
      raw_paint_gallons: rawPaintGallons,
      effective_paint_gallons: effectiveGallons.primary,
      raw_primer_gallons: rawPrimerGallons,
      effective_primer_gallons: effectiveGallons.secondary,
      area_supply_cost: areaSupplyCost,
      color_group_key: colorGroupKey,
      color_allocated_cost: 0,
      raw_supply_cost: areaSupplyCost,
      effective_supply_cost: round4(nonNeg(n(scope.override_supply_cost)) ?? areaSupplyCost),
      raw_total: 0,
      effective_total_before_override: 0,
      effective_total: 0,
    }

    applyScopeCosts(calc, settings, products)
    scopeCalcs.push(calc)

    return {
      ...scope,
      include,
      helper_value: round4(helperValue ?? 0),
      raw_measurement: calc.raw_measurement,
      effective_measurement: calc.effective_measurement,
      raw_paint_hours: calc.raw_paint_hours,
      effective_paint_hours: calc.effective_paint_hours,
      raw_primer_hours: calc.raw_primer_hours,
      effective_primer_hours: calc.effective_primer_hours,
      raw_paint_gallons: calc.raw_paint_gallons,
      effective_paint_gallons: calc.effective_paint_gallons,
      raw_primer_gallons: calc.raw_primer_gallons,
      effective_primer_gallons: calc.effective_primer_gallons,
      raw_supply_cost: calc.raw_supply_cost,
      effective_supply_cost: calc.effective_supply_cost,
      raw_total: calc.raw_total,
      effective_total: calc.effective_total,
    }
  })

  const grouped = new Map<string, ScopeCalc[]>()
  for (const scope of scopeCalcs) {
    if (!scope.color_group_key) continue
    if (!grouped.has(scope.color_group_key)) grouped.set(scope.color_group_key, [])
    grouped.get(scope.color_group_key)?.push(scope)
  }

  const perColorGroups: WallPerColorSupplyGroup[] = Array.from(grouped.entries()).map(([groupKey, scopes]) => {
    const totalMeasurement = sumNumbers(scopes.map((scope) => scope.effective_measurement))
    const totalCost = round4(
      Math.max(...scopes.map((scope) => pos(n(scope.row.per_color_supply_cost)) ?? settings.per_color_supply_cost))
    )

    for (const scope of scopes) {
      const weight = totalMeasurement > 0 ? (scope.effective_measurement ?? 0) / totalMeasurement : 1 / scopes.length
      scope.color_allocated_cost = round4(totalCost * weight)
      scope.raw_supply_cost = round4((scope.area_supply_cost ?? 0) + scope.color_allocated_cost)
      scope.effective_supply_cost = round4(nonNeg(n(scope.row.override_supply_cost)) ?? scope.raw_supply_cost)
      applyScopeCosts(scope, settings, products)
    }

    return {
      group_key: groupKey,
      color_id: groupKey.split('::')[1] ?? null,
      paint_product_id: groupKey.split('::')[0] ?? null,
      total_shared_supply_cost: totalCost,
      total_effective_area_sf: totalMeasurement,
      scope_count: scopes.length,
      allocations: scopes.map((scope) => ({
        scope_key: scope.scope_key,
        scope_id: scope.scope_id,
        room_id: scope.row.room_id,
        effective_area_sf: scope.effective_measurement ?? 0,
        weight:
          totalMeasurement > 0
            ? round4((scope.effective_measurement ?? 0) / totalMeasurement)
            : round4(1 / scopes.length),
        allocated_supply_cost: scope.color_allocated_cost,
      })),
    }
  })

  for (const scope of scopeCalcs) {
    applyScopeCosts(scope, settings, products)
  }

  const normalizedScopeByKey = new Map(normalizedScopes.map((scope) => [trimScopeKey(scope), scope] as const))
  for (const scope of scopeCalcs) {
    const row = normalizedScopeByKey.get(scope.scope_key)
    if (!row) continue
    row.raw_supply_cost = scope.raw_supply_cost
    row.effective_supply_cost = scope.effective_supply_cost
    row.raw_total = scope.raw_total
    row.effective_total = scope.effective_total
    row.paint_product_id = scope.row.paint_product_id ?? null
    row.paint_product_label = scope.row.paint_product_label ?? null
  }

  return {
    scopes: normalizedScopes,
    room_totals: buildRoomTotals(scopeCalcs),
    per_color_supply_groups: perColorGroups,
    missing_inputs: missingInputs,
    assumptions: settings,
  }
}

export type {
  TrimCalculationInput,
  TrimCalculationOutput,
  TrimCalculationScopeRow,
} from './trimTypes.ts'
