import type {
  MissingInput,
  ResolvedSettings,
  SupplyRateRow,
  WallCalculationCatalogs,
  WallCalculationScopeRow,
  WallCalculationSegmentRow,
  WallCalculationSettings,
  YN,
} from './wallsTypes.ts'

const DEFAULTS = {
  standard_door_deduction_sf: 21,
  standard_window_deduction_sf: 15,
  paint_prod_rate_sqft_per_hour: 150,
  primer_prod_rate_sqft_per_hour: 180,
  paint_coverage_sqft_per_gal_per_coat: 350,
  primer_coverage_sqft_per_gal_per_coat: 300,
  paint_coats: 2,
  primer_coats: 1,
  spot_prime_percent: 30,
  labor_rate_per_hour: 65,
  area_supply_cost_per_sf: 0.08,
  per_color_supply_cost: 20,
  paint_price_per_gal: 45,
  primer_price_per_gal: 35,
} as const

export function n(v: unknown) {
  if (v == null || v === '') return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

export function pos(v: number | null) {
  if (v == null) return null
  return v > 0 ? v : null
}

export function nonNeg(v: number | null) {
  if (v == null) return null
  return v < 0 ? 0 : v
}

export function round4(v: number) {
  return Math.round((v + Number.EPSILON) * 10_000) / 10_000
}

export function scopeKey(scope: WallCalculationScopeRow) {
  return scope.id ?? `${scope.room_id}::${scope.position}`
}

function normalizeKey(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function rateFromCatalog(
  catalogs: WallCalculationCatalogs | null | undefined,
  check: (row: SupplyRateRow) => boolean
) {
  for (const row of catalogs?.supplies_rates ?? []) {
    if (check(row)) return pos(n(row.value))
  }
  return null
}

export function resolveSettings(
  settings: WallCalculationSettings | undefined,
  catalogs: WallCalculationCatalogs | null | undefined
): ResolvedSettings {
  const areaSupplyFromCatalog =
    rateFromCatalog(catalogs, (row) => {
      const scope = normalizeKey(row.scope)
      const unit = normalizeKey(row.unit)
      return (scope === 'wall' || scope === 'walls') && (unit === 'sf' || unit === 'sqft')
    }) ?? null
  const perColorFromCatalog =
    rateFromCatalog(catalogs, (row) => {
      const scope = normalizeKey(row.scope)
      const unit = normalizeKey(row.unit)
      return (scope === 'wall' || scope === 'walls') && (unit === 'color' || unit === 'percolor')
    }) ?? null

  return {
    standard_door_deduction_sf: pos(n(settings?.standard_door_deduction_sf)) ?? DEFAULTS.standard_door_deduction_sf,
    standard_window_deduction_sf:
      pos(n(settings?.standard_window_deduction_sf)) ?? DEFAULTS.standard_window_deduction_sf,
    paint_prod_rate_sqft_per_hour:
      pos(n(settings?.paint_prod_rate_sqft_per_hour)) ?? DEFAULTS.paint_prod_rate_sqft_per_hour,
    primer_prod_rate_sqft_per_hour:
      pos(n(settings?.primer_prod_rate_sqft_per_hour)) ?? DEFAULTS.primer_prod_rate_sqft_per_hour,
    paint_coverage_sqft_per_gal_per_coat:
      pos(n(settings?.paint_coverage_sqft_per_gal_per_coat)) ??
      DEFAULTS.paint_coverage_sqft_per_gal_per_coat,
    primer_coverage_sqft_per_gal_per_coat:
      pos(n(settings?.primer_coverage_sqft_per_gal_per_coat)) ??
      DEFAULTS.primer_coverage_sqft_per_gal_per_coat,
    paint_coats: pos(n(settings?.paint_coats)) ?? DEFAULTS.paint_coats,
    primer_coats: pos(n(settings?.primer_coats)) ?? DEFAULTS.primer_coats,
    spot_prime_percent: nonNeg(n(settings?.spot_prime_percent)) ?? DEFAULTS.spot_prime_percent,
    labor_rate_per_hour: pos(n(settings?.labor_rate_per_hour)) ?? DEFAULTS.labor_rate_per_hour,
    area_supply_cost_per_sf:
      pos(n(settings?.area_supply_cost_per_sf)) ?? areaSupplyFromCatalog ?? DEFAULTS.area_supply_cost_per_sf,
    per_color_supply_cost:
      pos(n(settings?.per_color_supply_cost)) ?? perColorFromCatalog ?? DEFAULTS.per_color_supply_cost,
    paint_price_per_gal: pos(n(settings?.paint_price_per_gal)) ?? DEFAULTS.paint_price_per_gal,
    primer_price_per_gal: pos(n(settings?.primer_price_per_gal)) ?? DEFAULTS.primer_price_per_gal,
  }
}

export function productMap(catalogs: WallCalculationCatalogs | null | undefined) {
  const map = new Map<
    string,
    { label: string | null; price_per_gal: number | null; coverage_sqft_per_gal_per_coat: number | null }
  >()
  for (const row of catalogs?.paint_products ?? []) {
    if (row.id) {
      map.set(row.id, {
        label: row.label ?? null,
        price_per_gal: row.price_per_gal,
        coverage_sqft_per_gal_per_coat: row.coverage_sqft_per_gal_per_coat,
      })
    }
  }
  return map
}

export function sumNumbers(values: Array<number | null>) {
  const total = values.reduce((sum: number, value) => sum + (value ?? 0), 0)
  return round4(total)
}

export function segmentArea(
  segment: WallCalculationSegmentRow,
  settings: ResolvedSettings,
  missing: MissingInput[]
) {
  const qty = pos(n(segment.quantity)) ?? 0
  let geometry: number | null = null

  if (qty <= 0) {
    missing.push({
      level: 'segment',
      room_id: segment.room_id,
      scope_id: segment.wall_scope_id || null,
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
        scope_id: segment.wall_scope_id || null,
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
        scope_id: segment.wall_scope_id || null,
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
        scope_id: segment.wall_scope_id || null,
        segment_id: segment.id ?? null,
        field: 'manual_area_sf',
        message: `Segment ${segment.segment_name ?? segment.position + 1}: manual area is required`,
      })
    } else {
      geometry = round4(manual * qty)
    }
  }

  const doors = Math.max(0, n(segment.standard_door_count) ?? 0)
  const windows = Math.max(0, n(segment.standard_window_count) ?? 0)
  const deduction = round4(
    doors * settings.standard_door_deduction_sf + windows * settings.standard_window_deduction_sf
  )
  const net = geometry == null ? null : round4(Math.max(geometry - deduction, 0))
  const override = nonNeg(n(segment.override_area_sf))
  const effective = segment.include === 'Y' ? round4(override ?? net ?? 0) : 0
  return { geometry, deduction, effective }
}

export function normalizeInclude(value: YN): YN {
  return value === 'N' ? 'N' : 'Y'
}
