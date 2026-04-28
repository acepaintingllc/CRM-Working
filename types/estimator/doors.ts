import type { MissingInput, WallRoomTotal, YN } from '@/lib/estimator/wallsTypes'

export type DoorUnitRateCatalogRow = {
  id: string
  label: string
  unit_rate_type: string | null
  unit: string | null
  default_qty: number | null
  labor_rate: number | null
  material_rate: number | null
  amount: number | null
}

export type DoorCalculationScopeRow = {
  id?: string | null
  room_id: string
  position?: number | null
  include?: YN | null
  scope_name?: string | null
  door_type_id?: string | null
  color_id?: string | null
  paint_product_id?: string | null
  primer_product_id?: string | null
  prime_mode?: 'NONE' | 'SPOT' | 'FULL' | null
  quantity?: number | string | null
  sides?: number | string | null
  paint_coats?: number | string | null
  primer_coats?: number | string | null
  spot_prime_percent?: number | string | null
  condition_factor?: number | string | null
  labor_rate?: number | string | null
  material_rate?: number | string | null
  raw_units?: number | null
  effective_units?: number | null
  raw_paint_hours?: number | null
  override_paint_hours?: number | string | null
  effective_paint_hours?: number | null
  raw_primer_hours?: number | null
  override_primer_hours?: number | string | null
  effective_primer_hours?: number | null
  raw_paint_gallons?: number | null
  effective_paint_gallons?: number | null
  raw_primer_gallons?: number | null
  effective_primer_gallons?: number | null
  raw_material_cost?: number | null
  override_material_cost?: number | string | null
  effective_material_cost?: number | null
  raw_supply_cost?: number | null
  override_supply_cost?: number | string | null
  effective_supply_cost?: number | null
  raw_total?: number | null
  override_total?: number | string | null
  effective_total?: number | null
  notes?: string | null
}

export type DoorCalculationCatalogs = {
  door_unit_rates?: DoorUnitRateCatalogRow[]
}

export type DoorCalculationInput = {
  scopes: DoorCalculationScopeRow[]
  settings?: {
    labor_rate_per_hour?: number | null
    crew_size?: number | null
  } | null
  catalogs?: DoorCalculationCatalogs | null
}

export type DoorCalculationScopeResult = DoorCalculationScopeRow & {
  include: YN
  raw_units: number
  effective_units: number
  raw_paint_hours: number
  effective_paint_hours: number
  raw_primer_hours: number
  effective_primer_hours: number
  raw_paint_gallons: number
  effective_paint_gallons: number
  raw_primer_gallons: number
  effective_primer_gallons: number
  raw_material_cost: number
  effective_material_cost: number
  raw_supply_cost: number
  effective_supply_cost: number
  raw_total: number
  effective_total: number
}

export type DoorCalculationOutput = {
  scopes: DoorCalculationScopeResult[]
  room_totals: WallRoomTotal[]
  per_color_supply_groups: []
  missing_inputs: MissingInput[]
  assumptions: {
    labor_rate_per_hour: number
    crew_size: number
  }
}
