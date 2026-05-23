import type { EstimateV2ConditionModifier as EstimateV2LegacyConditionModifier } from '@/lib/estimator/conditionModifiers'

// Catalog option types — lookup tables fetched from the server for the estimator UI

export type EstimateV2CatalogOption = {
  id: string
  label: string
}

export type EstimateV2AccessFeeGroup = 'ladders' | 'scaffolding' | 'specialty'

export type EstimateV2AccessFeeOption = EstimateV2CatalogOption & {
  access_group: EstimateV2AccessFeeGroup
  fee_type: string | null
  amount: number | null
  unit: string | null
  notes: string | null
}

export type EstimateV2PaintProductOption = EstimateV2CatalogOption & {
  type: string
  scopes?: string[]
  price_per_gal?: number | null
  coverage_sqft_per_gal_per_coat?: number | null
}

export type EstimateV2SupplyRateOption = {
  key: string
  supply_group?: string | null
  scope?: string | null
  unit?: string | null
  value: number | null
  crew_multiplier?: 'Y' | 'N' | string | null
}

export type EstimateV2ProductionRateOption = EstimateV2CatalogOption & {
  scope_id: string | null
  surface_type: string | null
  condition: string | null
  prep_sqft_per_hr: number | null
  sqft_per_hr: number | null
  primer_sqft_per_hr: number | null
}

export type EstimateV2RoomFlagOption = EstimateV2CatalogOption & {
  wall_factor: number | null
  ceil_factor: number | null
  trim_factor: number | null
}

export type EstimateV2CeilingTypeOption = EstimateV2CatalogOption & {
  labor_mult: number | null
  area_factor?: number | null
}

export type EstimateV2HeightFactorOption = EstimateV2CatalogOption & {
  min_height_ft: number | null
  max_height_ft: number | null
  labor_multiplier: number | null
}

export type EstimateV2TrimCategory = 'base' | 'crown' | 'casing' | 'rail' | 'door_window' | 'panel' | 'feature' | 'other'

export type EstimateV2TrimMeasurementClass = 'linear' | 'opening' | 'surface' | 'assembly'

export type EstimateV2TrimTypeOption = EstimateV2CatalogOption & {
  family: string | null
  category: string | null
  unit_type: 'LF' | 'EA' | 'SF' | null
  helper_allowed: boolean
  default_production_rate_id: string | null
  trim_category?: EstimateV2TrimCategory | null
  measurement_class?: EstimateV2TrimMeasurementClass | null
  picker_group?: string | null
}

export type EstimateV2DoorTypeOption = EstimateV2CatalogOption & {
  unit_rate_type: string | null
  unit: string | null
  default_qty: number | null
  labor_rate: number | null
  material_rate: number | null
  amount: number | null
}

export type EstimateV2DrywallRateOption = EstimateV2CatalogOption & {
  unit_rate_type: string | null
  unit: 'LF' | 'SQFT' | string | null
  amount: number | null
  ceiling_multiplier: number | null
}

export type EstimateV2Catalogs = {
  paint_products: EstimateV2PaintProductOption[]
  color_codes: EstimateV2CatalogOption[]
  production_rates: EstimateV2ProductionRateOption[]
  supplies_rates?: EstimateV2SupplyRateOption[]
  height_factors: EstimateV2HeightFactorOption[]
  room_types: EstimateV2CatalogOption[]
  room_flags: EstimateV2RoomFlagOption[]
  ceiling_types: EstimateV2CeilingTypeOption[]
  trim_items: EstimateV2TrimTypeOption[]
  door_types?: EstimateV2DoorTypeOption[]
  drywall_rates?: EstimateV2DrywallRateOption[]
  access_fees?: EstimateV2AccessFeeOption[]
  condition_modifiers?: EstimateV2LegacyConditionModifier[]
}

export type EstimateV2CatalogsPayload = {
  catalogs: EstimateV2Catalogs
}
