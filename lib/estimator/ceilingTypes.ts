import type {
  WallCalculationSettings,
  WallCalculationCatalogs,
  WallRoomTotal,
  WallPerColorSupplyGroup,
  MissingInput,
  ResolvedSettings,
} from './wallsTypes.ts'

export type CeilingMode = 'RECT' | 'SEG'
export type CeilingSegmentShape = 'RECTANGLE' | 'TRIANGLE' | 'MANUAL'

export type CeilingCalculationScopeRow = {
  id?: string
  room_id: string
  position: number
  mode: CeilingMode
  include: 'Y' | 'N'
  scope_name: string | null
  // Geometry — area computed from L×W if area_sf not provided (RECT mode)
  area_sf: number | null          // direct area input (alternative to L×W)
  length_in: number | null
  width_in: number | null
  // Paint setup
  color_id: string | null
  paint_product_id: string | null
  primer_product_id: string | null
  prime_mode: 'NONE' | 'SPOT' | 'FULL'
  spot_prime_percent: number | null
  // Rate modifiers
  ceiling_type_id: string | null  // maps to labor_mult from catalog
  height_factor: number | null
  complexity_factor: number | null
  ceiling_flag_factor: number | null  // aggregated ceil_factor from room flags
  // Overrides (same pattern as walls)
  override_area_sf: number | null
  override_paint_hours: number | null
  override_primer_hours: number | null
  override_paint_gallons: number | null
  override_primer_gallons: number | null
  override_supply_cost: number | null
  override_total: number | null
  // Computed outputs (null before calculation)
  raw_area_sf: number | null
  effective_area_sf: number | null
  raw_paint_hours: number | null
  effective_paint_hours: number | null
  raw_primer_hours: number | null
  effective_primer_hours: number | null
  raw_paint_gallons: number | null
  effective_paint_gallons: number | null
  paint_material_group_key?: string | null
  paint_product_label?: string | null
  allocated_paint_gallons?: number | null
  allocated_paint_material_cost?: number | null
  raw_paint_material_cost?: number | null
  raw_primer_gallons: number | null
  effective_primer_gallons: number | null
  primer_material_cost?: number | null
  raw_supply_cost: number | null
  effective_supply_cost: number | null
  raw_total: number | null
  effective_total: number | null
  notes: string | null
  condition_factor?: number | null
  condition_selections?: Partial<Record<string, string>> | null
  // Per-scope setting overrides (same pattern as walls)
  paint_coats?: number | null
  primer_coats?: number | null
  paint_prod_rate_sqft_per_hour?: number | null
  primer_prod_rate_sqft_per_hour?: number | null
  paint_coverage_sqft_per_gal_per_coat?: number | null
  primer_coverage_sqft_per_gal_per_coat?: number | null
  area_supply_cost_per_sf?: number | null
  per_color_supply_cost?: number | null
  primer_supply_cost?: number | null
  labor_rate_per_hour?: number | null
  paint_price_per_gal?: number | null
  primer_price_per_gal?: number | null
}

// SEG mode child rows — no door/window deductions for ceilings
export type CeilingCalculationSegmentRow = {
  id?: string
  ceiling_scope_id: string
  room_id: string
  position: number
  segment_name: string | null
  include: 'Y' | 'N'
  shape_type: CeilingSegmentShape
  quantity: number
  width_in: number | null        // RECTANGLE
  height_in: number | null       // RECTANGLE
  base_in: number | null         // TRIANGLE
  manual_area_sf: number | null  // MANUAL
  raw_area_sf: number | null
  override_area_sf: number | null
  effective_area_sf: number | null
  notes: string | null
}

export type CeilingCalculationInput = {
  scopes: CeilingCalculationScopeRow[]
  segments: CeilingCalculationSegmentRow[]
  settings?: WallCalculationSettings
  catalogs?: WallCalculationCatalogs & {
    ceiling_types?: Array<{ id: string; labor_mult: number | null }> | null
  }
}

// Satisfies EngineOutput from pricingPolicies — no separate adapter needed.
export type CeilingCalculationOutput = {
  scopes: CeilingCalculationScopeRow[]
  segments: CeilingCalculationSegmentRow[]
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
  missing_inputs: MissingInput[]
  assumptions: ResolvedSettings
}
