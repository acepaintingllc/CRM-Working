import {
  n,
  nonNeg,
  normalizeInclude,
  pos,
  productMap,
  resolveSettings,
  round4,
  scopeKey,
  segmentArea,
  sumNumbers,
} from './wallsHelpers.ts'
import { allocatePaintMaterialRollups } from './paintMaterial.ts'
import { resolvePrimerSupplyCost } from './scopeRules.ts'
import type {
  MissingInput,
  ResolvedSettings,
  WallCalculationInput,
  WallCalculationOutput,
  WallCalculationScopeRow,
  WallRoomTotal,
  WallScopeTrace,
  YN,
} from './wallsTypes.ts'

type ScopeCalc = {
  scope_key: string
  scope_id: string | null
  room_id: string
  row: WallCalculationScopeRow
  paint_price_per_gal: number
  paint_product_id: string | null
  paint_product_label: string | null
  geometry: number | null
  deduction: number | null
  raw_area: number | null
  effective_area: number | null
  raw_paint_hours: number | null
  effective_paint_hours: number | null
  raw_primer_hours: number | null
  effective_primer_hours: number | null
  raw_paint_gallons: number | null
  effective_paint_gallons: number | null
  paint_material_group_key: string | null
  allocated_paint_gallons: number | null
  allocated_paint_material_cost: number | null
  raw_paint_material_cost: number | null
  raw_primer_gallons: number | null
  effective_primer_gallons: number | null
  primer_material_cost: number | null
  area_supply_cost: number | null
  primer_supply_cost: number | null
  color_group_key: string | null
  color_allocated_cost: number
  raw_supply_cost: number | null
  effective_supply_cost: number | null
  raw_total: number
  effective_total_before_override: number
  effective_total: number
  modifier: number
}

function calcRectArea(scope: WallCalculationScopeRow, settings: ResolvedSettings, missing: MissingInput[]) {
  if (normalizeInclude(scope.include) === 'N') {
    return { geometry: null as number | null, deduction: null as number | null, rawArea: null as number | null }
  }

  const perimeter = pos(n(scope.perimeter_in))
  const height = pos(n(scope.height_in))
  if (perimeter == null || height == null) {
    if (perimeter == null) {
      missing.push({
        level: 'scope',
        room_id: scope.room_id,
        scope_id: scopeKey(scope),
        segment_id: null,
        field: 'perimeter_in',
        message: `Scope ${scope.scope_name ?? scope.position + 1}: perimeter is required`,
      })
    }
    if (height == null) {
      missing.push({
        level: 'scope',
        room_id: scope.room_id,
        scope_id: scopeKey(scope),
        segment_id: null,
        field: 'height_in',
        message: `Scope ${scope.scope_name ?? scope.position + 1}: height is required`,
      })
    }
    return { geometry: null as number | null, deduction: null as number | null, rawArea: null as number | null }
  }

  const doors = Math.max(0, n(scope.standard_door_count) ?? 0)
  const windows = Math.max(0, n(scope.standard_window_count) ?? 0)
  const geometry = round4((perimeter * height) / 144)
  const deduction = round4(
    doors * settings.standard_door_deduction_sf + windows * settings.standard_window_deduction_sf
  )
  return { geometry, deduction, rawArea: round4(Math.max(geometry - deduction, 0)) }
}

function applyScopeCosts(scope: ScopeCalc, settings: ResolvedSettings, products: ReturnType<typeof productMap>) {
  const laborRate = pos(n(scope.row.labor_rate_per_hour)) ?? settings.labor_rate_per_hour
  const paintProduct = scope.row.paint_product_id ? products.get(scope.row.paint_product_id) : undefined
  const primerProduct = scope.row.primer_product_id ? products.get(scope.row.primer_product_id) : undefined
  const paintPrice =
    pos(n(scope.row.paint_price_per_gal)) ?? pos(n(paintProduct?.price_per_gal)) ?? settings.paint_price_per_gal
  const primerPrice =
    pos(n(scope.row.primer_price_per_gal)) ?? pos(n(primerProduct?.price_per_gal)) ?? settings.primer_price_per_gal
  scope.paint_price_per_gal = paintPrice
  scope.paint_product_label = paintProduct?.label ?? scope.paint_product_label ?? null
  scope.raw_paint_material_cost = round4((scope.raw_paint_gallons ?? 0) * paintPrice)
  scope.primer_material_cost = round4((scope.raw_primer_gallons ?? 0) * primerPrice)
  const paintMaterialCost = scope.allocated_paint_material_cost ?? scope.raw_paint_material_cost ?? 0
  const primerMaterialCost = round4((scope.effective_primer_gallons ?? 0) * primerPrice)

  const rawLaborCost = round4(((scope.raw_paint_hours ?? 0) + (scope.raw_primer_hours ?? 0)) * laborRate)
  const effectiveLaborCost =
    round4(((scope.effective_paint_hours ?? 0) + (scope.effective_primer_hours ?? 0)) * laborRate)
  const rawMaterialCost = round4((scope.raw_paint_material_cost ?? 0) + (scope.raw_primer_gallons ?? 0) * primerPrice)
  const effectiveMaterialCost = round4(paintMaterialCost + primerMaterialCost)

  scope.raw_total = round4(rawLaborCost + rawMaterialCost + (scope.raw_supply_cost ?? 0))
  scope.effective_total_before_override =
    round4(effectiveLaborCost + effectiveMaterialCost + (scope.effective_supply_cost ?? 0))
  const overrideTotal = scope.row.include === 'Y' ? nonNeg(n(scope.row.override_total)) : null
  scope.effective_total = round4(overrideTotal ?? scope.effective_total_before_override)
}

function buildRoomTotals(scopeCalcs: ScopeCalc[]) {
  const totals = new Map<string, WallRoomTotal>()
  for (const scope of scopeCalcs) {
    const room =
      totals.get(scope.row.room_id) ??
      {
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
    room.raw_area_sf = round4(room.raw_area_sf + (scope.raw_area ?? 0))
    room.effective_area_sf = round4(room.effective_area_sf + (scope.effective_area ?? 0))
    room.raw_paint_hours = round4(room.raw_paint_hours + (scope.raw_paint_hours ?? 0))
    room.effective_paint_hours = round4(room.effective_paint_hours + (scope.effective_paint_hours ?? 0))
    room.raw_primer_hours = round4(room.raw_primer_hours + (scope.raw_primer_hours ?? 0))
    room.effective_primer_hours = round4(room.effective_primer_hours + (scope.effective_primer_hours ?? 0))
    room.raw_paint_gallons = round4(room.raw_paint_gallons + (scope.raw_paint_gallons ?? 0))
    room.effective_paint_gallons = round4(room.effective_paint_gallons + (scope.effective_paint_gallons ?? 0))
    room.raw_paint_material_cost = round4(room.raw_paint_material_cost + (scope.raw_paint_material_cost ?? 0))
    room.effective_paint_material_cost = round4(
      room.effective_paint_material_cost + (scope.allocated_paint_material_cost ?? scope.raw_paint_material_cost ?? 0)
    )
    room.raw_primer_gallons = round4(room.raw_primer_gallons + (scope.raw_primer_gallons ?? 0))
    room.effective_primer_gallons = round4(room.effective_primer_gallons + (scope.effective_primer_gallons ?? 0))
    room.raw_supply_cost = round4(room.raw_supply_cost + (scope.raw_supply_cost ?? 0))
    room.effective_supply_cost = round4(room.effective_supply_cost + (scope.effective_supply_cost ?? 0))
    room.raw_total = round4(room.raw_total + (scope.raw_total ?? 0))
    room.effective_total = round4(room.effective_total + (scope.effective_total ?? 0))
    totals.set(scope.row.room_id, room)
  }
  return Array.from(totals.values()).sort((a, b) => a.room_id.localeCompare(b.room_id))
}

function buildScopeTraces(
  scopeCalcs: ScopeCalc[],
  missingInputs: MissingInput[],
  colorGroupTotalCost: Map<string, number>
) {
  const traces: WallScopeTrace[] = scopeCalcs.map((scope) => {
    const scopeMissing = missingInputs.filter(
      (item) => item.scope_id === scope.scope_key || item.scope_id === scope.scope_id
    )
    return {
      scope_key: scope.scope_key,
      scope_id: scope.scope_id,
      room_id: scope.row.room_id,
      mode: scope.row.mode,
      include: scope.row.include,
      area: {
        geometry_area_sf: scope.geometry,
        deduction_area_sf: scope.deduction,
        raw_area_sf: scope.raw_area,
        override_area_sf: nonNeg(n(scope.row.override_area_sf)),
        effective_area_sf: scope.effective_area,
      },
      labor: {
        modifier_factor: scope.modifier,
        paint: {
          raw: scope.raw_paint_hours,
          override: nonNeg(n(scope.row.override_paint_hours)),
          effective: scope.effective_paint_hours,
        },
        primer: {
          raw: scope.raw_primer_hours,
          override: nonNeg(n(scope.row.override_primer_hours)),
          effective: scope.effective_primer_hours,
        },
      },
      gallons: {
        paint: {
          raw: scope.raw_paint_gallons,
          override: nonNeg(n(scope.row.override_paint_gallons)),
          effective: scope.effective_paint_gallons,
        },
        primer: {
          raw: scope.raw_primer_gallons,
          override: nonNeg(n(scope.row.override_primer_gallons)),
          effective: scope.effective_primer_gallons,
        },
      },
      paint_material: {
        paint_product_id: scope.row.paint_product_id,
        paint_product_label: scope.paint_product_label,
        group_key: scope.paint_material_group_key,
        raw_gallons: scope.raw_paint_gallons,
        allocated_gallons: scope.allocated_paint_gallons,
        allocated_cost: scope.allocated_paint_material_cost,
      },
      supplies: {
        area_based_cost: scope.area_supply_cost,
        primer_supply_cost: scope.primer_supply_cost,
        color_group_key: scope.color_group_key,
        color_group_total_cost: scope.color_group_key
          ? colorGroupTotalCost.get(scope.color_group_key) ?? null
          : null,
        allocated_color_cost: scope.color_allocated_cost,
        raw_supply_cost: scope.raw_supply_cost,
        override_supply_cost: nonNeg(n(scope.row.override_supply_cost)),
        effective_supply_cost: scope.effective_supply_cost,
      },
      totals: {
        raw_total: scope.raw_total,
        effective_total_before_override: scope.effective_total_before_override,
        override_total: nonNeg(n(scope.row.override_total)),
        effective_total: scope.effective_total,
      },
      missing_inputs: scopeMissing,
    }
  })
  return traces
}

function pushMissingRequiredAssumption(
  missing: MissingInput[],
  scope: WallCalculationScopeRow,
  field: string
) {
  if (scope.include === 'N') return
  missing.push({
    level: 'scope',
    room_id: scope.room_id,
    scope_id: scopeKey(scope),
    segment_id: null,
    field,
    message: `Scope ${scope.scope_name ?? scope.position + 1}: ${field} is required`,
  })
}

function pushMissingWallPricingAssumptions(params: {
  scope: WallCalculationScopeRow
  settings: WallCalculationInput['settings']
  products: ReturnType<typeof productMap>
  missing: MissingInput[]
}) {
  const paintProduct = params.scope.paint_product_id ? params.products.get(params.scope.paint_product_id) : undefined
  const primerProduct = params.scope.primer_product_id ? params.products.get(params.scope.primer_product_id) : undefined
  const required: Array<[string, unknown]> = [
    ['labor_rate_per_hour', params.scope.labor_rate_per_hour ?? params.settings?.labor_rate_per_hour],
    ['paint_prod_rate_sqft_per_hour', params.scope.paint_prod_rate_sqft_per_hour ?? params.settings?.paint_prod_rate_sqft_per_hour],
    [
      'paint_coverage_sqft_per_gal_per_coat',
      params.scope.paint_coverage_sqft_per_gal_per_coat ??
        paintProduct?.coverage_sqft_per_gal_per_coat ??
        params.settings?.paint_coverage_sqft_per_gal_per_coat,
    ],
    ['paint_coats', params.scope.paint_coats ?? params.settings?.paint_coats],
    [
      'paint_price_per_gal',
      params.scope.paint_price_per_gal ?? paintProduct?.price_per_gal ?? params.settings?.paint_price_per_gal,
    ],
  ]
  if (params.scope.prime_mode !== 'NONE') {
    required.push(
      ['primer_prod_rate_sqft_per_hour', params.scope.primer_prod_rate_sqft_per_hour ?? params.settings?.primer_prod_rate_sqft_per_hour],
      [
        'primer_coverage_sqft_per_gal_per_coat',
        params.scope.primer_coverage_sqft_per_gal_per_coat ??
          primerProduct?.coverage_sqft_per_gal_per_coat ??
          params.settings?.primer_coverage_sqft_per_gal_per_coat,
      ],
      ['primer_coats', params.scope.primer_coats ?? params.settings?.primer_coats],
      [
        'primer_price_per_gal',
        params.scope.primer_price_per_gal ?? primerProduct?.price_per_gal ?? params.settings?.primer_price_per_gal,
      ]
    )
  }
  if (params.scope.prime_mode === 'SPOT') {
    required.push(['spot_prime_percent', params.scope.spot_prime_percent ?? params.settings?.spot_prime_percent])
  }

  for (const [field, value] of required) {
    if (pos(n(value)) == null) pushMissingRequiredAssumption(params.missing, params.scope, field)
  }
}

export function calculateWalls(input: WallCalculationInput): WallCalculationOutput {
  const settings = resolveSettings(input.settings, input.catalogs)
  const products = productMap(input.catalogs)
  const missingInputs: MissingInput[] = []
  const includedScopeIds = new Set(
    input.scopes
      .filter((scope) => normalizeInclude(scope.include) === 'Y')
      .map((scope) => scope.id)
      .filter((id): id is string => Boolean(id))
  )

  const normalizedSegments = input.segments.map((segment) => {
    const requiresInputs = segment.include === 'Y' && includedScopeIds.has(segment.wall_scope_id)
    const calc = segmentArea(segment, settings, requiresInputs ? missingInputs : [])
    return { ...segment, raw_area_sf: calc.geometry, effective_area_sf: calc.effective }
  })

  const segByScope = new Map<string, typeof normalizedSegments>()
  for (const segment of normalizedSegments) {
    if (!segByScope.has(segment.wall_scope_id)) segByScope.set(segment.wall_scope_id, [])
    segByScope.get(segment.wall_scope_id)?.push(segment)
  }

  const scopeCalcs: ScopeCalc[] = []
  const normalizedScopes = input.scopes.map((scope) => {
    pushMissingWallPricingAssumptions({
      scope,
      settings: input.settings,
      products,
      missing: missingInputs,
    })
    const include: YN = normalizeInclude(scope.include)
    const segments = segByScope.get(scope.id ?? '') ?? []
    let geometry: number | null = null
    let deduction: number | null = null
    let rawArea: number | null = null

    if (scope.mode === 'RECT') {
      const rect = calcRectArea(scope, settings, missingInputs)
      geometry = rect.geometry
      deduction = rect.deduction
      rawArea = rect.rawArea
    } else {
      if (segments.filter((segment) => segment.include === 'Y').length === 0 && include === 'Y') {
        missingInputs.push({
          level: 'scope',
          room_id: scope.room_id,
          scope_id: scopeKey(scope),
          segment_id: null,
          field: 'wall_segments',
          message: `Scope ${scope.scope_name ?? scope.position + 1}: SEG mode needs at least one included segment`,
        })
      }
      geometry = sumNumbers(
        segments.filter((segment) => segment.include === 'Y').map((segment) => segment.raw_area_sf)
      )
      deduction = round4(
        segments
          .filter((segment) => segment.include === 'Y')
          .reduce((sum, segment) => {
            const doors = Math.max(0, n(segment.standard_door_count) ?? 0)
            const windows = Math.max(0, n(segment.standard_window_count) ?? 0)
            return sum + doors * settings.standard_door_deduction_sf + windows * settings.standard_window_deduction_sf
          }, 0)
      )
      rawArea = sumNumbers(
        segments.filter((segment) => segment.include === 'Y').map((segment) => segment.effective_area_sf)
      )
    }

    const overrideArea = nonNeg(n(scope.override_area_sf))
    const effectiveArea = include === 'Y' ? round4(overrideArea ?? rawArea ?? 0) : 0
    const modifier = round4(
      (nonNeg(n(scope.height_factor)) ?? 1) *
        (nonNeg(n(scope.complexity_factor)) ?? 1) *
        (nonNeg(n(scope.wall_flag_factor)) ?? 1) *
        (nonNeg(n(scope.cut_in_top_factor)) ?? 1) *
        (nonNeg(n(scope.cut_in_bottom_factor)) ?? 1) *
        (nonNeg(n(scope.condition_factor)) ?? 1)
    )

    const paintCoats = pos(n(scope.paint_coats)) ?? settings.paint_coats
    const primerCoats = pos(n(scope.primer_coats)) ?? settings.primer_coats
    const spotPrimePercent = Math.min(100, nonNeg(n(scope.spot_prime_percent)) ?? settings.spot_prime_percent)
    const paintRate = pos(n(scope.paint_prod_rate_sqft_per_hour)) ?? settings.paint_prod_rate_sqft_per_hour
    const primerRate = pos(n(scope.primer_prod_rate_sqft_per_hour)) ?? settings.primer_prod_rate_sqft_per_hour

    const paintProduct = scope.paint_product_id ? products.get(scope.paint_product_id) : undefined
    const primerProduct = scope.primer_product_id ? products.get(scope.primer_product_id) : undefined
    const paintPrice =
      pos(n(scope.paint_price_per_gal)) ?? pos(n(paintProduct?.price_per_gal)) ?? settings.paint_price_per_gal
    const paintCoverage =
      pos(n(scope.paint_coverage_sqft_per_gal_per_coat)) ??
      pos(n(paintProduct?.coverage_sqft_per_gal_per_coat)) ??
      settings.paint_coverage_sqft_per_gal_per_coat
    const primerCoverage =
      pos(n(scope.primer_coverage_sqft_per_gal_per_coat)) ??
      pos(n(primerProduct?.coverage_sqft_per_gal_per_coat)) ??
      settings.primer_coverage_sqft_per_gal_per_coat

    const primerMultiplier =
      scope.prime_mode === 'FULL' ? 1 : scope.prime_mode === 'SPOT' ? spotPrimePercent / 100 : 0
    const primerArea = include === 'Y' ? round4(effectiveArea * primerMultiplier) : 0

    const rawPaintHours =
      include === 'Y' && paintRate > 0 ? round4(((effectiveArea * paintCoats) / paintRate) * modifier) : 0
    const rawPrimerHours =
      include === 'Y' && primerRate > 0 ? round4(((primerArea * primerCoats) / primerRate) * modifier) : 0
    const rawPaintGallons =
      include === 'Y' && paintCoverage > 0 ? round4((effectiveArea * paintCoats) / paintCoverage) : 0
    const rawPrimerGallons =
      include === 'Y' && primerCoverage > 0 ? round4((primerArea * primerCoats) / primerCoverage) : 0
    const effectivePaintHours = include === 'Y' ? round4(nonNeg(n(scope.override_paint_hours)) ?? rawPaintHours) : 0
    const effectivePrimerHours = include === 'Y' ? round4(nonNeg(n(scope.override_primer_hours)) ?? rawPrimerHours) : 0
    const effectivePaintGallons =
      include === 'Y' ? round4(nonNeg(n(scope.override_paint_gallons)) ?? rawPaintGallons) : 0
    const effectivePrimerGallons =
      include === 'Y' ? round4(nonNeg(n(scope.override_primer_gallons)) ?? rawPrimerGallons) : 0

    const areaRate = pos(n(scope.area_supply_cost_per_sf)) ?? settings.area_supply_cost_per_sf
    const areaSupplyCost = include === 'Y' ? round4(effectiveArea * areaRate) : 0
    const primerSupplyCost =
      include === 'Y'
        ? round4(
            pos(n(scope.primer_supply_cost)) ??
              resolvePrimerSupplyCost({
                primeMode: scope.prime_mode,
                scope: 'walls',
                suppliesRates: input.catalogs?.supplies_rates,
              })
          )
        : 0
    const colorGroupKey =
      include === 'Y' && scope.color_id ? `${scope.paint_product_id ?? 'PAINT'}::${scope.color_id}` : null

    const calc: ScopeCalc = {
      scope_key: scopeKey(scope),
      scope_id: scope.id ?? null,
      room_id: scope.room_id,
      row: { ...scope, include },
      paint_price_per_gal: paintPrice,
      paint_product_id: scope.paint_product_id ?? null,
      paint_product_label: paintProduct?.label ?? scope.paint_product_label ?? null,
      geometry,
      deduction,
      raw_area: include === 'Y' ? rawArea : 0,
      effective_area: effectiveArea,
      raw_paint_hours: rawPaintHours,
      effective_paint_hours: effectivePaintHours,
      raw_primer_hours: rawPrimerHours,
      effective_primer_hours: effectivePrimerHours,
      raw_paint_gallons: rawPaintGallons,
      effective_paint_gallons: effectivePaintGallons,
      paint_material_group_key: null,
      allocated_paint_gallons: null,
      allocated_paint_material_cost: null,
      raw_paint_material_cost: null,
      raw_primer_gallons: rawPrimerGallons,
      effective_primer_gallons: effectivePrimerGallons,
      primer_material_cost: null,
      area_supply_cost: areaSupplyCost,
      primer_supply_cost: primerSupplyCost,
      color_group_key: colorGroupKey,
      color_allocated_cost: 0,
      raw_supply_cost: round4(areaSupplyCost + primerSupplyCost),
      effective_supply_cost: round4(nonNeg(n(scope.override_supply_cost)) ?? areaSupplyCost + primerSupplyCost),
      raw_total: 0,
      effective_total_before_override: 0,
      effective_total: 0,
      modifier,
    }
    applyScopeCosts(calc, settings, products)
    scopeCalcs.push(calc)

    return {
      ...scope,
      include,
      raw_area_sf: calc.raw_area,
      effective_area_sf: calc.effective_area,
      raw_paint_hours: calc.raw_paint_hours,
      effective_paint_hours: calc.effective_paint_hours,
      raw_primer_hours: calc.raw_primer_hours,
      effective_primer_hours: calc.effective_primer_hours,
      raw_paint_gallons: calc.raw_paint_gallons,
      effective_paint_gallons: calc.effective_paint_gallons,
      paint_product_id: scope.paint_product_id ?? null,
      paint_material_group_key: calc.paint_material_group_key,
      paint_product_label: calc.paint_product_label ?? scope.paint_product_label ?? null,
      allocated_paint_gallons: calc.allocated_paint_gallons,
      allocated_paint_material_cost: calc.allocated_paint_material_cost,
      raw_paint_material_cost: calc.raw_paint_material_cost,
      raw_primer_gallons: calc.raw_primer_gallons,
      effective_primer_gallons: calc.effective_primer_gallons,
      primer_material_cost: calc.primer_material_cost,
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

  const colorGroupTotalCost = new Map<string, number>()
  const perColorGroups = Array.from(grouped.entries()).map(([groupKey, scopes]) => {
    const totalArea = sumNumbers(scopes.map((scope) => scope.effective_area))
    const totalCost = round4(
      Math.max(
        ...scopes.map((scope) => pos(n(scope.row.per_color_supply_cost)) ?? settings.per_color_supply_cost)
      )
    )
    colorGroupTotalCost.set(groupKey, totalCost)

    for (const scope of scopes) {
      const weight = totalArea > 0 ? (scope.effective_area ?? 0) / totalArea : 1 / scopes.length
      scope.color_allocated_cost = round4(totalCost * weight)
      scope.raw_supply_cost = round4(
        (scope.area_supply_cost ?? 0) + (scope.primer_supply_cost ?? 0) + scope.color_allocated_cost
      )
      scope.effective_supply_cost = round4(nonNeg(n(scope.row.override_supply_cost)) ?? scope.raw_supply_cost)
      applyScopeCosts(scope, settings, products)
    }

    return {
      group_key: groupKey,
      color_id: groupKey.split('::')[1] ?? null,
      paint_product_id: groupKey.split('::')[0] ?? null,
      total_shared_supply_cost: totalCost,
      total_effective_area_sf: totalArea,
      scope_count: scopes.length,
      allocations: scopes.map((scope) => ({
        scope_key: scope.scope_key,
        scope_id: scope.scope_id,
        room_id: scope.row.room_id,
        effective_area_sf: scope.effective_area ?? 0,
        weight: totalArea > 0 ? round4((scope.effective_area ?? 0) / totalArea) : round4(1 / scopes.length),
        allocated_supply_cost: scope.color_allocated_cost,
      })),
    }
  })

  const paintMaterialGroups = allocatePaintMaterialRollups(scopeCalcs)

  for (const scope of scopeCalcs) {
    applyScopeCosts(scope, settings, products)
  }

  const normalizedScopeByKey = new Map(normalizedScopes.map((scope) => [scopeKey(scope), scope] as const))
  for (const scope of scopeCalcs) {
    const row = normalizedScopeByKey.get(scope.scope_key)
    if (!row) continue
    row.raw_supply_cost = scope.raw_supply_cost
    row.effective_supply_cost = scope.effective_supply_cost
    row.raw_total = scope.raw_total
    row.effective_total = scope.effective_total
    row.paint_material_group_key = scope.paint_material_group_key
    row.paint_product_label = scope.paint_product_label
    row.allocated_paint_gallons = scope.allocated_paint_gallons
    row.allocated_paint_material_cost = scope.allocated_paint_material_cost
    row.raw_paint_material_cost = scope.raw_paint_material_cost
    row.primer_material_cost = scope.primer_material_cost
  }

  return {
    scopes: normalizedScopes,
    segments: normalizedSegments,
    room_totals: buildRoomTotals(scopeCalcs),
    per_color_supply_groups: perColorGroups,
    paint_material_groups: paintMaterialGroups,
    scope_traces: buildScopeTraces(scopeCalcs, missingInputs, colorGroupTotalCost),
    missing_inputs: missingInputs,
    assumptions: settings,
    required_inputs: {
      scope_rect_required: ['room_id', 'mode=RECT', 'perimeter_in', 'height_in'],
      scope_seg_required: ['room_id', 'mode=SEG', 'wall_segments[] (included)'],
      segment_required_by_shape: {
        RECTANGLE: ['wall_scope_id', 'shape_type=RECTANGLE', 'quantity', 'width_in', 'height_in'],
        TRIANGLE: ['wall_scope_id', 'shape_type=TRIANGLE', 'quantity', 'base_in', 'height_in'],
        MANUAL: ['wall_scope_id', 'shape_type=MANUAL', 'quantity', 'manual_area_sf'],
      },
      common_optional_overrides: [
        'override_area_sf',
        'override_paint_hours',
        'override_primer_hours',
        'override_paint_gallons',
        'override_primer_gallons',
        'override_supply_cost',
        'override_total',
      ],
      common_optional_assumption_overrides: [
        'paint_coats',
        'primer_coats',
        'spot_prime_percent',
        'paint_prod_rate_sqft_per_hour',
        'primer_prod_rate_sqft_per_hour',
        'paint_coverage_sqft_per_gal_per_coat',
        'primer_coverage_sqft_per_gal_per_coat',
        'area_supply_cost_per_sf',
        'per_color_supply_cost',
        'labor_rate_per_hour',
        'paint_price_per_gal',
        'primer_price_per_gal',
      ],
    },
  }
}

export type {
  MissingInput,
  WallCalculationCatalogs,
  WallCalculationInput,
  WallCalculationOutput,
  WallCalculationScopeRow,
  WallCalculationSegmentRow,
  WallCalculationSettings,
  WallPerColorSupplyGroup,
  WallRoomTotal,
  WallScopeTrace,
} from './wallsTypes.ts'
