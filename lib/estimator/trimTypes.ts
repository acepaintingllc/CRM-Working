import type {
  MissingInput,
  ResolvedSettings,
  WallCalculationCatalogs,
  WallPerColorSupplyGroup,
  WallRoomTotal,
  YN,
} from './wallsTypes.ts'
import type { PaintMaterialGroup } from './paintMaterial.ts'

export type TrimUnitType = 'LF' | 'EA' | 'SF'
export type TrimMeasurementMode = 'MANUAL' | 'ROOM_HELPER'
export type TrimHelperSource = 'ROOM_PERIMETER'

export type TrimCalculationScopeRow = {
  id?: string
  room_id: string
  position: number
  include: YN
  scope_name: string | null
  trim_type_id: string | null
  trim_family: string | null
  unit_type: TrimUnitType
  measurement_mode: TrimMeasurementMode
  helper_source: TrimHelperSource | null
  measurement_value: number | null
  helper_value: number | null
  baseboard_opening_count?: number | null
  color_id: string | null
  paint_product_id: string | null
  primer_product_id: string | null
  paint_enabled: YN
  prime_mode: 'NONE' | 'SPOT' | 'FULL'
  spot_prime_percent: number | null
  production_rate_id: string | null
  prep_factor: number | null
  height_factor: number | null
  profile_factor: number | null
  room_flag_factor: number | null
  masking_factor: number | null
  stair_factor: number | null
  difficult_finish_factor: number | null
  caulk_fill_factor: number | null
  override_measurement: number | null
  override_hours: number | null
  override_gallons: number | null
  override_supply_cost: number | null
  override_total: number | null
  override_description: string | null
  raw_measurement: number | null
  effective_measurement: number | null
  raw_paint_hours: number | null
  effective_paint_hours: number | null
  raw_primer_hours: number | null
  effective_primer_hours: number | null
  raw_paint_gallons: number | null
  effective_paint_gallons: number | null
  paint_product_label?: string | null
  paint_material_group_key?: string | null
  allocated_paint_gallons?: number | null
  allocated_paint_material_cost?: number | null
  raw_paint_material_cost?: number | null
  raw_primer_gallons: number | null
  effective_primer_gallons: number | null
  raw_supply_cost: number | null
  effective_supply_cost: number | null
  raw_total: number | null
  effective_total: number | null
  notes: string | null
  condition_factor?: number | null
  condition_selections?: Partial<Record<string, string>> | null
  paint_coats?: number | null
  primer_coats?: number | null
  paint_prod_rate_units_per_hour?: number | null
  primer_prod_rate_units_per_hour?: number | null
  paint_coverage_units_per_gal_per_coat?: number | null
  primer_coverage_units_per_gal_per_coat?: number | null
  area_supply_cost_per_unit?: number | null
  per_color_supply_cost?: number | null
  primer_supply_cost?: number | null
  labor_rate_per_hour?: number | null
  paint_price_per_gal?: number | null
  primer_price_per_gal?: number | null
}

export type TrimCalculationRoomInput = {
  room_id: string
  length_in: number | null
  width_in: number | null
  mode: 'RECT' | 'SEG'
}

export type TrimTypeCatalogRow = {
  id: string
  family: string | null
  default_unit_type: TrimUnitType | null
  helper_allowed: boolean | null
  default_production_rate_id: string | null
}

export type TrimProductionRateCatalogRow = {
  id: string
  scope_id: string | null
  units_per_hour: number | null
  prep_units_per_hour: number | null
  primer_units_per_hour: number | null
}

export type TrimCalculationInput = {
  scopes: TrimCalculationScopeRow[]
  rooms: TrimCalculationRoomInput[]
  settings?: {
    labor_rate_per_hour?: number | null
    crew_size?: number | null
  }
  catalogs?:
    | (WallCalculationCatalogs & {
        trim_items?: TrimTypeCatalogRow[] | null
        production_rates?: TrimProductionRateCatalogRow[] | null
      })
    | null
}

export type TrimCalculationOutput = {
  scopes: TrimCalculationScopeRow[]
  room_totals: WallRoomTotal[]
  per_color_supply_groups: WallPerColorSupplyGroup[]
  paint_material_groups: PaintMaterialGroup[]
  missing_inputs: MissingInput[]
  assumptions: ResolvedSettings
}
