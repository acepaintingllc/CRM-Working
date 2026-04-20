export type YN = 'Y' | 'N'
export type WallMode = 'RECT' | 'SEG'
export type PrimeMode = 'NONE' | 'SPOT' | 'FULL'
export type SegmentShape = 'RECTANGLE' | 'TRIANGLE' | 'MANUAL'

export type ProductRow = {
  id: string
  type: string
  label: string | null
  price_per_gal: number | null
  coverage_sqft_per_gal_per_coat: number | null
}

export type SupplyRateRow = {
  key: string
  scope: string | null
  unit: string | null
  value: number
}

export type WallCalculationCatalogs = {
  paint_products?: ProductRow[] | null
  supplies_rates?: SupplyRateRow[] | null
}

export type WallCalculationScopeRow = {
  id?: string
  room_id: string
  position: number
  mode: WallMode
  include: YN
  scope_name: string | null
  color_id: string | null
  paint_product_id: string | null
  primer_product_id: string | null
  prime_mode: PrimeMode
  height_in: number | null
  perimeter_in: number | null
  standard_door_count: number | null
  standard_window_count: number | null
  height_factor: number | null
  complexity_factor: number | null
  wall_flag_factor: number | null
  cut_in_top_factor: number | null
  cut_in_bottom_factor: number | null
  raw_area_sf: number | null
  override_area_sf: number | null
  effective_area_sf: number | null
  raw_paint_hours: number | null
  override_paint_hours: number | null
  effective_paint_hours: number | null
  raw_primer_hours: number | null
  override_primer_hours: number | null
  effective_primer_hours: number | null
  raw_paint_gallons: number | null
  override_paint_gallons: number | null
  effective_paint_gallons: number | null
  paint_material_group_key?: string | null
  paint_product_label?: string | null
  allocated_paint_gallons?: number | null
  allocated_paint_material_cost?: number | null
  raw_paint_material_cost?: number | null
  raw_primer_gallons: number | null
  override_primer_gallons: number | null
  effective_primer_gallons: number | null
  primer_material_cost?: number | null
  raw_supply_cost: number | null
  override_supply_cost: number | null
  effective_supply_cost: number | null
  raw_total: number | null
  override_total: number | null
  effective_total: number | null
  notes: string | null
  paint_coats?: number | null
  primer_coats?: number | null
  spot_prime_percent?: number | null
  paint_coverage_sqft_per_gal_per_coat?: number | null
  primer_coverage_sqft_per_gal_per_coat?: number | null
  paint_prod_rate_sqft_per_hour?: number | null
  primer_prod_rate_sqft_per_hour?: number | null
  area_supply_cost_per_sf?: number | null
  per_color_supply_cost?: number | null
  labor_rate_per_hour?: number | null
  paint_price_per_gal?: number | null
  primer_price_per_gal?: number | null
}

export type WallCalculationSegmentRow = {
  id?: string
  wall_scope_id: string
  room_id: string
  position: number
  segment_name: string | null
  include: YN
  shape_type: SegmentShape
  quantity: number
  width_in: number | null
  height_in: number | null
  base_in: number | null
  manual_area_sf: number | null
  standard_door_count: number | null
  standard_window_count: number | null
  raw_area_sf: number | null
  override_area_sf: number | null
  effective_area_sf: number | null
  notes: string | null
}

export type WallCalculationSettings = {
  labor_rate_per_hour?: number | null
  paint_prod_rate_sqft_per_hour?: number | null
  primer_prod_rate_sqft_per_hour?: number | null
  paint_coverage_sqft_per_gal_per_coat?: number | null
  primer_coverage_sqft_per_gal_per_coat?: number | null
  paint_coats?: number | null
  primer_coats?: number | null
  spot_prime_percent?: number | null
  area_supply_cost_per_sf?: number | null
  per_color_supply_cost?: number | null
  paint_price_per_gal?: number | null
  primer_price_per_gal?: number | null
  standard_door_deduction_sf?: number | null
  standard_window_deduction_sf?: number | null
}

export type MissingInput = {
  level: 'scope' | 'segment'
  room_id: string
  scope_id: string | null
  segment_id: string | null
  field: string
  message: string
}

export type WallPerColorSupplyGroup = {
  group_key: string
  color_id: string | null
  paint_product_id: string | null
  total_shared_supply_cost: number
  total_effective_area_sf: number
  scope_count: number
  allocations: Array<{
    scope_key: string
    scope_id: string | null
    room_id: string
    effective_area_sf: number
    weight: number
    allocated_supply_cost: number
  }>
}

export type WallRoomTotal = {
  room_id: string
  scope_count: number
  included_scope_count: number
  raw_area_sf: number
  effective_area_sf: number
  raw_paint_hours: number
  effective_paint_hours: number
  raw_primer_hours: number
  effective_primer_hours: number
  raw_paint_gallons: number
  effective_paint_gallons: number
  raw_paint_material_cost: number
  effective_paint_material_cost: number
  raw_primer_gallons: number
  effective_primer_gallons: number
  raw_supply_cost: number
  effective_supply_cost: number
  raw_total: number
  effective_total: number
}

export type WallScopeTrace = {
  scope_key: string
  scope_id: string | null
  room_id: string
  mode: WallMode
  include: YN
  area: {
    geometry_area_sf: number | null
    deduction_area_sf: number | null
    raw_area_sf: number | null
    override_area_sf: number | null
    effective_area_sf: number | null
  }
  labor: {
    modifier_factor: number
    paint: { raw: number | null; override: number | null; effective: number | null }
    primer: { raw: number | null; override: number | null; effective: number | null }
  }
  gallons: {
    paint: { raw: number | null; override: number | null; effective: number | null }
    primer: { raw: number | null; override: number | null; effective: number | null }
  }
  paint_material: {
    paint_product_id: string | null
    paint_product_label: string | null
    group_key: string | null
    raw_gallons: number | null
    allocated_gallons: number | null
    allocated_cost: number | null
  }
  supplies: {
    area_based_cost: number | null
    color_group_key: string | null
    color_group_total_cost: number | null
    allocated_color_cost: number
    raw_supply_cost: number | null
    override_supply_cost: number | null
    effective_supply_cost: number | null
  }
  totals: {
    raw_total: number | null
    effective_total_before_override: number | null
    override_total: number | null
    effective_total: number | null
  }
  missing_inputs: MissingInput[]
}

export type WallCalculationInput = {
  scopes: WallCalculationScopeRow[]
  segments: WallCalculationSegmentRow[]
  settings?: WallCalculationSettings
  catalogs?: WallCalculationCatalogs | null
}

export type ResolvedSettings = {
  labor_rate_per_hour: number
  paint_prod_rate_sqft_per_hour: number
  primer_prod_rate_sqft_per_hour: number
  paint_coverage_sqft_per_gal_per_coat: number
  primer_coverage_sqft_per_gal_per_coat: number
  paint_coats: number
  primer_coats: number
  spot_prime_percent: number
  area_supply_cost_per_sf: number
  per_color_supply_cost: number
  paint_price_per_gal: number
  primer_price_per_gal: number
  standard_door_deduction_sf: number
  standard_window_deduction_sf: number
}

export type WallCalculationOutput = {
  scopes: WallCalculationScopeRow[]
  segments: WallCalculationSegmentRow[]
  room_totals: WallRoomTotal[]
  per_color_supply_groups: WallPerColorSupplyGroup[]
  paint_material_groups: Array<{
    group_key: string
    paint_product_id: string | null
    paint_product_label: string | null
    raw_paint_gallons: number
    rounded_paint_gallons: number
    unit_price: number
    total_paint_cost: number
    contributing_scopes: Array<{
      scope_key: string
      scope_id: string | null
      room_id: string
      raw_paint_gallons: number
      allocated_paint_gallons: number
      allocated_paint_cost: number
      weight: number
    }>
  }>
  scope_traces: WallScopeTrace[]
  missing_inputs: MissingInput[]
  assumptions: ResolvedSettings
  required_inputs: {
    scope_rect_required: string[]
    scope_seg_required: string[]
    segment_required_by_shape: Record<SegmentShape, string[]>
    common_optional_overrides: string[]
    common_optional_assumption_overrides: string[]
  }
}
