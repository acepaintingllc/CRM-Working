export type RatesFlagsTab = 'rates' | 'flags' | 'room_defaults'

export type RatesFlagsCategoryKey =
  | 'production_rates_walls'
  | 'production_rates_ceilings'
  | 'production_rates_trim'
  | 'unit_rates_doors'
  | 'unit_rates_trim'
  | 'unit_rates_drywall'
  | 'access_fees_ladders'
  | 'access_fees_scaffolding'
  | 'access_fees_specialty'
  | 'supply_rates_per_color'
  | 'supply_rates_area_based'
  | 'supply_rates_per_job'
  | 'supply_rates_roller_covers'
  | 'wall_complexity'
  | 'height_factors'
  | 'ceiling_types'
  | 'condition_modifiers'
  | 'room_types'
  | 'room_templates'
  | 'scope_defaults'
  // legacy compatibility keys (seeded data before taxonomy migration)
  | 'unit_rates'
  | 'access_fees'
  | 'supply_rates'
  | 'production_rates'
  | 'area_costs'
  | 'fixed_fees'

export type RatesFlagsGroup =
  | 'production_rates'
  | 'unit_rates'
  | 'access_fees'
  | 'supply_rates'
  | 'condition_modifiers'
  | 'height_factors'
  | 'wall_complexity'
  | 'ceiling_types'
  | 'room_types'
  | 'room_templates'
  | 'scope_defaults'
  | 'legacy'

export type RatesFlagsFieldType = 'text' | 'number' | 'select'

export type RatesFlagsFieldDef = {
  key: string
  label: string
  type: RatesFlagsFieldType
  required?: boolean
  readOnly?: boolean
  helperText?: string
  options?: string[]
}

export type RatesFlagsColumnDef = {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
}

export type RatesFlagsBaseRow = {
  id: string
  display_name: string
  notes: string
  active: boolean
}

export type ProductionRateRow = RatesFlagsBaseRow & {
  production_scope: 'walls' | 'ceilings' | 'trim'
  scope_id: string
  surface_type: string
  condition: string
  prep_sqft_per_hr: string
  sqft_per_hr: string
  primer_sqft_per_hr: string
}

export type UnitRateRow = RatesFlagsBaseRow & {
  unit_rate_group: 'doors' | 'trim' | 'drywall'
  unit_rate_type: string
  unit: string
  helper_allowed?: string
  default_production_rate_id?: string
  default_qty: string
  labor_rate: string
  material_rate: string
  amount: string
}

export type AccessFeeRow = RatesFlagsBaseRow & {
  access_group: 'ladders' | 'scaffolding' | 'specialty'
  fee_type: string
  amount: string
  unit: string
}

export type SupplyRateRow = RatesFlagsBaseRow & {
  supply_group: 'per_color' | 'area_based' | 'per_job' | 'roller_covers'
  scope: string
  unit: string
  cost_per: string
  size_in: string
  price_each: string
}

export type MultiplierRow = RatesFlagsBaseRow & {
  multiplier_type: 'wall_complexity' | 'height_factors' | 'ceiling_types'
  primary_label: string
  primary_value: string
  secondary_label: string
  secondary_value: string
}

export type ConditionModifierRow = RatesFlagsBaseRow & {
  wall_factor: string
  ceil_factor: string
  trim_factor: string
}

export type RoomTypeDefaultRow = RatesFlagsBaseRow & {
  default_wall_rate_id: string
  default_ceil_rate_id: string
  default_complexity_id: string
  default_wall_mode: string
  top_cut_in_factor: string
  bot_cut_in_factor: string
  typical_height_ft: string
}

export type RoomTemplateRow = RatesFlagsBaseRow & {
  room_type_id: string
  default_wall_rate_id: string
  default_ceil_rate_id: string
  default_complexity_id: string
  default_wall_mode: string
  include_walls: string
  include_ceilings: string
  include_trim: string
  include_doors: string
  include_drywall: string
}

export type ScopeDefaultRow = RatesFlagsBaseRow & {
  default_wall_mode: string
  top_cut_in_factor: string
  bot_cut_in_factor: string
  typical_height_ft: string
  include_walls: string
  include_ceilings: string
  include_trim: string
  include_doors: string
  include_drywall: string
}

export type RatesFlagsRow =
  | ProductionRateRow
  | UnitRateRow
  | AccessFeeRow
  | SupplyRateRow
  | MultiplierRow
  | ConditionModifierRow
  | RoomTypeDefaultRow
  | RoomTemplateRow
  | ScopeDefaultRow

export type RatesFlagsCategory = {
  key: RatesFlagsCategoryKey
  tab: RatesFlagsTab
  group: RatesFlagsGroup
  label: string
  table_title: string
  description: string
  columns: RatesFlagsColumnDef[]
  fields: RatesFlagsFieldDef[]
  rows: RatesFlagsRow[]
}

export type RatesFlagsPayload = {
  source: 'db' | 'sheet'
  seeded: boolean
  template_version: number | null
  schema_version?: string
  categories: RatesFlagsCategory[]
}

export type RatesFlagsMutationAction = 'create' | 'update' | 'archive' | 'reactivate'

export type RatesFlagsMutationRequest = {
  category: RatesFlagsCategoryKey
  action: RatesFlagsMutationAction
  original_id?: string
  values: Record<string, unknown>
}
