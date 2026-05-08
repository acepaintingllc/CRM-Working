import type { MissingInput, WallRoomTotal } from '@/lib/estimator/wallsTypes'

export const DRYWALL_REPAIR_TYPES = [
  'corner_tape_replacement',
  'flat_wall_crack',
  'stress_crack_at_seam',
  'ceiling_crack',
  'patch_opening_repair',
] as const

export type DrywallRepairType = (typeof DRYWALL_REPAIR_TYPES)[number]
export type DrywallRepairSurface = 'wall' | 'ceiling'
export type DrywallRepairUnit = 'LF' | 'SQFT'

export type DrywallUnitRateCatalogRow = {
  id: string
  label: string
  unit_rate_type: string | null
  unit: string | null
  amount: number | null
  labor_rate?: number | null
  material_rate?: number | null
  ceiling_multiplier?: number | null
}

export type DrywallRepairCalculationRow = {
  id?: string | null
  room_id: string
  position?: number | null
  include?: 'Y' | 'N' | string | null
  active?: 'Y' | 'N' | string | null
  surface: DrywallRepairSurface | string
  repair_type: DrywallRepairType | string
  unit: DrywallRepairUnit | string
  quantity: number | string | null
  raw_quantity?: number | null
  effective_quantity?: number | null
  base_unit_rate?: number | null
  ceiling_multiplier?: number | null
  calculated_total?: number | null
  override_total?: number | string | null
  raw_total?: number | null
  effective_total?: number | null
}

export type DrywallCalculationCatalogs = {
  drywall_unit_rates?: DrywallUnitRateCatalogRow[]
}

export type DrywallCalculationInput = {
  repairs: DrywallRepairCalculationRow[]
  catalogs?: DrywallCalculationCatalogs | null
}

export type DrywallRepairCalculationResult = DrywallRepairCalculationRow & {
  surface: DrywallRepairSurface
  repair_type: DrywallRepairType
  unit: DrywallRepairUnit
  include: 'Y' | 'N'
  active: 'Y' | 'N'
  raw_quantity: number
  effective_quantity: number
  base_unit_rate: number
  ceiling_multiplier: number
  calculated_total: number
  override_total: number | null
  raw_total: number
  effective_total: number
  raw_paint_hours: number
  effective_paint_hours: number
  raw_paint_gallons: number
  effective_paint_gallons: number
  raw_primer_hours: number
  effective_primer_hours: number
  raw_primer_gallons: number
  effective_primer_gallons: number
  raw_supply_cost: number
  effective_supply_cost: number
}

export type DrywallCalculationOutput = {
  scopes: DrywallRepairCalculationResult[]
  room_totals: WallRoomTotal[]
  per_color_supply_groups: []
  missing_inputs: MissingInput[]
  assumptions: {
    labor_rate_per_hour: 0
    quantity_rounding: 'ceil'
  }
}
