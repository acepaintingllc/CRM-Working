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
import { allocatePaintMaterialRollups } from './paintMaterial.ts'
import { resolvePrimerSupplyCost } from './scopeRules.ts'
import type {
  MissingInput,
  ResolvedSettings,
  WallPerColorSupplyGroup,
  WallRoomTotal,
  YN,
} from './wallsTypes.ts'
import type {
  CeilingCalculationInput,
  CeilingCalculationOutput,
  CeilingCalculationScopeRow,
  CeilingCalculationSegmentRow,
} from './ceilingTypes.ts'

type ScopeCalc = {
  scope_key: string
  scope_id: string | null
  room_id: string
  row: CeilingCalculationScopeRow
  paint_price_per_gal: number
  paint_product_id: string | null
  paint_product_label: string | null
  geometry: number | null
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

function ceilingScopeKey(scope: CeilingCalculationScopeRow) {
  return scope.id ?? `${scope.room_id}::${scope.position}`
}

// Mirror of wallsHelpers segmentArea but uses ceiling_scope_id for error reporting
// and has no door/window deductions.
function ceilingSegmentArea(
  segment: CeilingCalculationSegmentRow,
  missing: MissingInput[]
): { geometry: number | null; effective: number } {
  const qty = pos(n(segment.quantity)) ?? 0
  let geometry: number | null = null

  if (qty <= 0) {
    missing.push({
      level: 'segment',
      room_id: segment.room_id,
      scope_id: segment.ceiling_scope_id,
      segment_id: segment.id ?? null,
      field: 'quantity',
      message: `Segment ${segment.segment_name ?? segment.position + 1}: quantity must be > 0`,
    })
  }

  if (segment.shape_type === 'RECTANGLE') {
    const width = pos(n(segment.width_in))
    const height = pos(n(segment.height_in))
    if (width == null || height == null) {
      missing.push({
        level: 'segment',
        room_id: segment.room_id,
        scope_id: segment.ceiling_scope_id,
        segment_id: segment.id ?? null,
        field: width == null ? 'width_in' : 'height_in',
        message: `Segment ${segment.segment_name ?? segment.position + 1}: width and height are required`,
      })
    } else {
      geometry = round4((width * height * qty) / 144)
    }
  } else if (segment.shape_type === 'TRIANGLE') {
    const base = pos(n(segment.base_in))
    const height = pos(n(segment.height_in))
    if (base == null || height == null) {
      missing.push({
        level: 'segment',
        room_id: segment.room_id,
        scope_id: segment.ceiling_scope_id,
        segment_id: segment.id ?? null,
        field: base == null ? 'base_in' : 'height_in',
        message: `Segment ${segment.segment_name ?? segment.position + 1}: base and height are required`,
      })
    } else {
      geometry = round4(((base * height) / 2 / 144) * qty)
    }
  } else {
    const manual = pos(n(segment.manual_area_sf))
    if (manual == null) {
      missing.push({
        level: 'segment',
        room_id: segment.room_id,
        scope_id: segment.ceiling_scope_id,
        segment_id: segment.id ?? null,
        field: 'manual_area_sf',
        message: `Segment ${segment.segment_name ?? segment.position + 1}: manual area is required`,
      })
    } else {
      geometry = round4(manual * qty)
    }
  }

  // No deductions for ceiling segments
  const override = nonNeg(n(segment.override_area_sf))
  const effective = segment.include === 'Y' ? round4(override ?? geometry ?? 0) : 0
  return { geometry, effective }
}

// Looks up ceiling area supply rate from catalogs (scope='ceiling' or 'ceilings').
function resolveCeilingAreaSupplyRate(
  catalogs: CeilingCalculationInput['catalogs'],
  base: ResolvedSettings
): number {
  for (const row of catalogs?.supplies_rates ?? []) {
    const scope = String(row.scope ?? '').toLowerCase().replace(/[^a-z]/g, '')
    const unit = String(row.unit ?? '').toLowerCase().replace(/[^a-z]/g, '')
    if ((scope === 'ceiling' || scope === 'ceilings') && (unit === 'sf' || unit === 'sqft')) {
      const v = pos(n(row.value))
      if (v != null) return v
    }
  }
  // Fall back to the global area supply rate (wall default) if no ceiling rate found
  return base.area_supply_cost_per_sf
}

function applyScopeCosts(
  scope: ScopeCalc,
  settings: ResolvedSettings,
  products: ReturnType<typeof productMap>
) {
  const laborRate = pos(n(scope.row.labor_rate_per_hour)) ?? settings.labor_rate_per_hour
  const paintProduct = scope.row.paint_product_id ? products.get(scope.row.paint_product_id) : undefined
  const primerProduct = scope.row.primer_product_id ? products.get(scope.row.primer_product_id) : undefined
  const paintPrice =
    pos(n(scope.row.paint_price_per_gal)) ?? pos(n(paintProduct?.price_per_gal)) ?? settings.paint_price_per_gal
  const primerPrice =
    pos(n(scope.row.primer_price_per_gal)) ??
    pos(n(primerProduct?.price_per_gal)) ??
    settings.primer_price_per_gal
  scope.paint_price_per_gal = paintPrice
  scope.paint_product_label = paintProduct?.label ?? scope.paint_product_label ?? null
  scope.raw_paint_material_cost = round4((scope.raw_paint_gallons ?? 0) * paintPrice)
  scope.primer_material_cost = round4((scope.raw_primer_gallons ?? 0) * primerPrice)
  const paintMaterialCost = scope.allocated_paint_material_cost ?? scope.raw_paint_material_cost ?? 0
  const primerMaterialCost = round4((scope.effective_primer_gallons ?? 0) * primerPrice)

  const rawLaborCost = round4(((scope.raw_paint_hours ?? 0) + (scope.raw_primer_hours ?? 0)) * laborRate)
  const effectiveLaborCost = round4(
    ((scope.effective_paint_hours ?? 0) + (scope.effective_primer_hours ?? 0)) * laborRate
  )
  const rawMaterialCost = round4((scope.raw_paint_material_cost ?? 0) + (scope.raw_primer_gallons ?? 0) * primerPrice)
  const effectiveMaterialCost = round4(paintMaterialCost + primerMaterialCost)

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
    room.raw_total = round4(room.raw_total + scope.raw_total)
    room.effective_total = round4(room.effective_total + scope.effective_total)
    totals.set(scope.row.room_id, room)
  }
  return Array.from(totals.values()).sort((a, b) => a.room_id.localeCompare(b.room_id))
}

export function calculateCeilings(input: CeilingCalculationInput): CeilingCalculationOutput {
  const settings = resolveSettings(input.settings, input.catalogs)
  const products = productMap(input.catalogs)
  const missingInputs: MissingInput[] = []

  // Build ceiling_type_mult lookup: ceiling_type_id → labor_mult (default 1)
  const ceilingTypeMultMap = new Map<string, number>()
  for (const ct of input.catalogs?.ceiling_types ?? []) {
    if (ct.id) ceilingTypeMultMap.set(ct.id, pos(n(ct.labor_mult)) ?? 1)
  }

  // Ceiling-scoped area supply rate
  const ceilingAreaSupplyRate = resolveCeilingAreaSupplyRate(input.catalogs, settings)

  // Process segments: compute area for each
  const normalizedSegments = input.segments.map((segment) => {
    const calc = ceilingSegmentArea(segment, missingInputs)
    return { ...segment, raw_area_sf: calc.geometry, effective_area_sf: calc.effective }
  })

  // Group segments by ceiling_scope_id for SEG mode scopes
  const segByScope = new Map<string, typeof normalizedSegments>()
  for (const segment of normalizedSegments) {
    if (!segByScope.has(segment.ceiling_scope_id)) segByScope.set(segment.ceiling_scope_id, [])
    segByScope.get(segment.ceiling_scope_id)?.push(segment)
  }

  const scopeCalcs: ScopeCalc[] = []

  const normalizedScopes = input.scopes.map((scope) => {
    const include: YN = normalizeInclude(scope.include)
    const scopeKey = ceilingScopeKey(scope)
    const segments = segByScope.get(scope.id ?? '') ?? []

    let geometry: number | null = null
    let rawArea: number | null = null

    if (scope.mode === 'RECT') {
      // RECT: use direct area_sf first, then fall back to L×W
      const directArea = pos(n(scope.area_sf))
      if (directArea != null) {
        geometry = directArea
        rawArea = directArea
      } else {
        const lengthIn = pos(n(scope.length_in))
        const widthIn = pos(n(scope.width_in))
        if (lengthIn == null || widthIn == null) {
          if (lengthIn == null) {
            missingInputs.push({
              level: 'scope',
              room_id: scope.room_id,
              scope_id: scopeKey,
              segment_id: null,
              field: 'length_in',
              message: `Ceiling scope ${scope.scope_name ?? scope.position + 1}: length is required`,
            })
          }
          if (widthIn == null) {
            missingInputs.push({
              level: 'scope',
              room_id: scope.room_id,
              scope_id: scopeKey,
              segment_id: null,
              field: 'width_in',
              message: `Ceiling scope ${scope.scope_name ?? scope.position + 1}: width is required`,
            })
          }
        } else {
          geometry = round4((lengthIn * widthIn) / 144)
          rawArea = geometry
        }
      }
    } else {
      // SEG mode: sum included segment areas
      const includedSegments = segments.filter((seg) => seg.include === 'Y')
      if (includedSegments.length === 0 && include === 'Y') {
        missingInputs.push({
          level: 'scope',
          room_id: scope.room_id,
          scope_id: scopeKey,
          segment_id: null,
          field: 'ceiling_segments',
          message: `Ceiling scope ${scope.scope_name ?? scope.position + 1}: SEG mode needs at least one included segment`,
        })
      }
      geometry = sumNumbers(includedSegments.map((seg) => seg.raw_area_sf))
      rawArea = sumNumbers(includedSegments.map((seg) => seg.effective_area_sf))
    }

    const overrideArea = nonNeg(n(scope.override_area_sf))
    const effectiveArea = include === 'Y' ? round4(overrideArea ?? rawArea ?? 0) : 0

    // Modifier: ceiling_type_mult × height_factor × complexity_factor × ceiling_flag_factor
    const ceilingTypeMult = scope.ceiling_type_id ? (ceilingTypeMultMap.get(scope.ceiling_type_id) ?? 1) : 1
    const modifier = round4(
      ceilingTypeMult *
        (nonNeg(n(scope.height_factor)) ?? 1) *
        (nonNeg(n(scope.complexity_factor)) ?? 1) *
        (nonNeg(n(scope.ceiling_flag_factor)) ?? 1)
    )

    // Paint / primer rates
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

    // Primer area
    const primerMultiplier =
      scope.prime_mode === 'FULL' ? 1 : scope.prime_mode === 'SPOT' ? spotPrimePercent / 100 : 0
    const primerArea = include === 'Y' ? round4(effectiveArea * primerMultiplier) : 0

    // Labor hours
    const rawPaintHours = include === 'Y' ? round4(((effectiveArea * paintCoats) / paintRate) * modifier) : 0
    const rawPrimerHours = include === 'Y' ? round4(((primerArea * primerCoats) / primerRate) * modifier) : 0
    const effectivePaintHours =
      include === 'Y' ? round4(nonNeg(n(scope.override_paint_hours)) ?? rawPaintHours) : 0
    const effectivePrimerHours =
      include === 'Y' ? round4(nonNeg(n(scope.override_primer_hours)) ?? rawPrimerHours) : 0

    // Gallons
    const rawPaintGallons = include === 'Y' ? round4((effectiveArea * paintCoats) / paintCoverage) : 0
    const rawPrimerGallons = include === 'Y' ? round4((primerArea * primerCoats) / primerCoverage) : 0
    const effectivePaintGallons =
      include === 'Y' ? round4(nonNeg(n(scope.override_paint_gallons)) ?? rawPaintGallons) : 0
    const effectivePrimerGallons =
      include === 'Y' ? round4(nonNeg(n(scope.override_primer_gallons)) ?? rawPrimerGallons) : 0

    // Area-based supply cost (ceiling-scoped rate)
    const areaRate = pos(n(scope.area_supply_cost_per_sf)) ?? ceilingAreaSupplyRate
    const areaSupplyCost = include === 'Y' ? round4(effectiveArea * areaRate) : 0
    const primerSupplyCost =
      include === 'Y'
        ? round4(
            pos(n(scope.primer_supply_cost)) ??
              resolvePrimerSupplyCost({
                primeMode: scope.prime_mode,
                scope: 'ceilings',
                suppliesRates: input.catalogs?.supplies_rates,
              })
          )
        : 0

    // Per-color supply group key
    const colorGroupKey =
      include === 'Y' && scope.color_id ? `${scope.paint_product_id ?? 'PAINT'}::${scope.color_id}` : null

    const calc: ScopeCalc = {
      scope_key: scopeKey,
      scope_id: scope.id ?? null,
      room_id: scope.room_id,
      row: { ...scope, include },
      paint_price_per_gal: paintPrice,
      paint_product_id: scope.paint_product_id ?? null,
      paint_product_label: paintProduct?.label ?? scope.paint_product_label ?? null,
      geometry,
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

  // Per-color supply grouping (identical logic to walls)
  const grouped = new Map<string, ScopeCalc[]>()
  for (const scope of scopeCalcs) {
    if (!scope.color_group_key) continue
    if (!grouped.has(scope.color_group_key)) grouped.set(scope.color_group_key, [])
    grouped.get(scope.color_group_key)?.push(scope)
  }

  const perColorGroups: WallPerColorSupplyGroup[] = Array.from(grouped.entries()).map(([groupKey, scopes]) => {
    const totalArea = sumNumbers(scopes.map((scope) => scope.effective_area))
    const totalCost = round4(
      Math.max(...scopes.map((scope) => pos(n(scope.row.per_color_supply_cost)) ?? settings.per_color_supply_cost))
    )

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

  // Re-apply costs after per-color allocation
  for (const scope of scopeCalcs) {
    applyScopeCosts(scope, settings, products)
  }

  // Write per-color supply + cost updates back to normalized scopes
  const normalizedScopeByKey = new Map(normalizedScopes.map((scope) => [ceilingScopeKey(scope), scope] as const))
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
    missing_inputs: missingInputs,
    assumptions: settings,
  }
}

export type {
  CeilingCalculationInput,
  CeilingCalculationOutput,
  CeilingCalculationScopeRow,
  CeilingCalculationSegmentRow,
} from './ceilingTypes.ts'
