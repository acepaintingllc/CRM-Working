export type RatesFlagsTab = 'rates' | 'flags' | 'room_defaults'

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

export type RatesFlagsNavigationGroup =
  | 'production'
  | 'unit_rates'
  | 'access_fees'
  | 'supplies'
  | 'condition_modifiers'
  | 'height_factors'
  | 'wall_complexity'
  | 'ceiling_types'
  | 'room_types'
  | 'room_templates'
  | 'scope_defaults'

type RatesFlagsEditableCategoryRegistration = {
  key: string
  tab: RatesFlagsTab
  group: RatesFlagsGroup
  navigationGroup: RatesFlagsNavigationGroup
  navigationLabel: string
  navigationOrder: number
}

function defineRatesFlagsEditableCategoryRegistry<
  const TRegistry extends readonly RatesFlagsEditableCategoryRegistration[],
>(registry: TRegistry) {
  return registry
}

// Canonical editable Rates/Flags category registry.
// To add a category, register it here, then add the category-specific value/row/draft
// types plus its server CategoryConfig. Adapters and page navigation derive coverage
// from this registry and tests fail when a category is missing downstream.
export const ratesFlagsEditableCategoryRegistry = defineRatesFlagsEditableCategoryRegistry([
  {
    key: 'production_rates_walls',
    tab: 'rates',
    group: 'production_rates',
    navigationGroup: 'production',
    navigationLabel: 'Walls',
    navigationOrder: 10,
  },
  {
    key: 'production_rates_ceilings',
    tab: 'rates',
    group: 'production_rates',
    navigationGroup: 'production',
    navigationLabel: 'Ceilings',
    navigationOrder: 20,
  },
  {
    key: 'production_rates_trim',
    tab: 'rates',
    group: 'production_rates',
    navigationGroup: 'production',
    navigationLabel: 'Trim',
    navigationOrder: 30,
  },
  {
    key: 'unit_rates_doors',
    tab: 'rates',
    group: 'unit_rates',
    navigationGroup: 'unit_rates',
    navigationLabel: 'Doors',
    navigationOrder: 10,
  },
  {
    key: 'unit_rates_trim',
    tab: 'rates',
    group: 'unit_rates',
    navigationGroup: 'unit_rates',
    navigationLabel: 'Trim Types',
    navigationOrder: 20,
  },
  {
    key: 'unit_rates_drywall',
    tab: 'rates',
    group: 'unit_rates',
    navigationGroup: 'unit_rates',
    navigationLabel: 'Drywall',
    navigationOrder: 30,
  },
  {
    key: 'access_fees_ladders',
    tab: 'rates',
    group: 'access_fees',
    navigationGroup: 'access_fees',
    navigationLabel: 'Ladders',
    navigationOrder: 10,
  },
  {
    key: 'access_fees_scaffolding',
    tab: 'rates',
    group: 'access_fees',
    navigationGroup: 'access_fees',
    navigationLabel: 'Scaffolding',
    navigationOrder: 20,
  },
  {
    key: 'access_fees_specialty',
    tab: 'rates',
    group: 'access_fees',
    navigationGroup: 'access_fees',
    navigationLabel: 'Specialty',
    navigationOrder: 30,
  },
  {
    key: 'supply_rates_per_color',
    tab: 'rates',
    group: 'supply_rates',
    navigationGroup: 'supplies',
    navigationLabel: 'Per-Color',
    navigationOrder: 10,
  },
  {
    key: 'supply_rates_area_based',
    tab: 'rates',
    group: 'supply_rates',
    navigationGroup: 'supplies',
    navigationLabel: 'Area-Based',
    navigationOrder: 20,
  },
  {
    key: 'supply_rates_per_job',
    tab: 'rates',
    group: 'supply_rates',
    navigationGroup: 'supplies',
    navigationLabel: 'Per-Job',
    navigationOrder: 30,
  },
  {
    key: 'supply_rates_roller_covers',
    tab: 'rates',
    group: 'supply_rates',
    navigationGroup: 'supplies',
    navigationLabel: 'Roller Covers',
    navigationOrder: 40,
  },
  {
    key: 'wall_complexity',
    tab: 'flags',
    group: 'wall_complexity',
    navigationGroup: 'wall_complexity',
    navigationLabel: 'Wall Complexity',
    navigationOrder: 30,
  },
  {
    key: 'height_factors',
    tab: 'flags',
    group: 'height_factors',
    navigationGroup: 'height_factors',
    navigationLabel: 'Height Factors',
    navigationOrder: 20,
  },
  {
    key: 'ceiling_types',
    tab: 'flags',
    group: 'ceiling_types',
    navigationGroup: 'ceiling_types',
    navigationLabel: 'Ceiling Types',
    navigationOrder: 40,
  },
  {
    key: 'condition_modifiers',
    tab: 'flags',
    group: 'condition_modifiers',
    navigationGroup: 'condition_modifiers',
    navigationLabel: 'Condition Modifiers',
    navigationOrder: 10,
  },
  {
    key: 'room_types',
    tab: 'room_defaults',
    group: 'room_types',
    navigationGroup: 'room_types',
    navigationLabel: 'Room Types',
    navigationOrder: 10,
  },
  {
    key: 'room_templates',
    tab: 'room_defaults',
    group: 'room_templates',
    navigationGroup: 'room_templates',
    navigationLabel: 'Room Templates',
    navigationOrder: 20,
  },
  {
    key: 'scope_defaults',
    tab: 'room_defaults',
    group: 'scope_defaults',
    navigationGroup: 'scope_defaults',
    navigationLabel: 'Scope Defaults',
    navigationOrder: 30,
  },
] as const)

export type RatesFlagsEditableCategoryKey =
  (typeof ratesFlagsEditableCategoryRegistry)[number]['key']

export const ratesFlagsEditableCategoryKeys = ratesFlagsEditableCategoryRegistry.map(
  (category) => category.key
) as RatesFlagsEditableCategoryKey[]

export const ratesFlagsLegacyCategoryKeys = [
  'unit_rates',
  'access_fees',
  'supply_rates',
  'production_rates',
  'area_costs',
  'fixed_fees',
] as const

export type RatesFlagsLegacyCategoryKey =
  (typeof ratesFlagsLegacyCategoryKeys)[number]

export type RatesFlagsCategoryKey =
  | RatesFlagsEditableCategoryKey
  | RatesFlagsLegacyCategoryKey

export type RatesFlagsFieldType = 'text' | 'number' | 'select'

export type RatesFlagsFieldDef = {
  key: string
  label: string
  type: RatesFlagsFieldType
  required?: boolean
  readOnly?: boolean
  helperText?: string
  options?: string[]
  writeDefault?: string
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

export type RatesFlagsEditableCategory<
  TCategory extends RatesFlagsEditableCategoryKey = RatesFlagsEditableCategoryKey,
> = RatesFlagsCategory & {
  key: TCategory
  rows: RatesFlagsRowByCategory[TCategory][]
}

export type ProductionRateMutationValues<TScope extends 'walls' | 'ceilings' | 'trim'> = {
  production_scope: TScope
  id: string
  scope_id: string
  display_name: string
  surface_type: string
  condition: string
  prep_sqft_per_hr: string
  sqft_per_hr: string
  primer_sqft_per_hr: string
  notes: string
  active: 'Y' | 'N'
}

export type DoorUnitRateMutationValues = {
  unit_rate_group: 'doors'
  id: string
  display_name: string
  unit_rate_type: string
  unit: string
  default_qty: string
  labor_rate: string
  material_rate: string
  amount: string
  notes: string
  active: 'Y' | 'N'
}

export type TrimUnitRateMutationValues = {
  unit_rate_group: 'trim'
  id: string
  display_name: string
  unit_rate_type: string
  unit: string
  helper_allowed: 'Y' | 'N'
  default_production_rate_id: string
  default_qty: string
  labor_rate: string
  material_rate: string
  amount: string
  notes: string
  active: 'Y' | 'N'
}

export type DrywallUnitRateMutationValues = {
  unit_rate_group: 'drywall'
  id: string
  display_name: string
  unit_rate_type: string
  unit: string
  default_qty: string
  labor_rate: string
  material_rate: string
  amount: string
  notes: string
  active: 'Y' | 'N'
}

export type AccessFeeMutationValues<TGroup extends 'ladders' | 'scaffolding' | 'specialty'> = {
  access_group: TGroup
  id: string
  display_name: string
  fee_type: string
  amount: string
  unit: string
  notes: string
  active: 'Y' | 'N'
}

export type SupplyRateMutationValues<TGroup extends 'per_color' | 'area_based' | 'per_job'> = {
  supply_group: TGroup
  id: string
  display_name: string
  scope: string
  unit: string
  cost_per: string
  notes: string
  active: 'Y' | 'N'
}

export type RollerCoverSupplyRateMutationValues = {
  supply_group: 'roller_covers'
  id: string
  display_name: string
  scope: string
  size_in: string
  price_each: string
  notes: string
  active: 'Y' | 'N'
}

export type WallComplexityMutationValues = {
  id: string
  display_name: string
  primary_value: string
  secondary_value: string
  notes: string
  active: 'Y' | 'N'
}

export type HeightFactorMutationValues = {
  id: string
  display_name: string
  min_height_ft: string
  max_height_ft: string
  primary_value: string
  notes: string
  active: 'Y' | 'N'
}

export type CeilingTypeMutationValues = {
  id: string
  display_name: string
  primary_value: string
  secondary_value: string
  notes: string
  active: 'Y' | 'N'
}

export type ConditionModifierMutationValues = {
  id: string
  display_name: string
  wall_factor: string
  ceil_factor: string
  trim_factor: string
  notes: string
  active: 'Y' | 'N'
}

export type RoomTypeMutationValues = {
  id: string
  display_name: string
  default_wall_rate_id: string
  default_ceil_rate_id: string
  default_complexity_id: string
  default_wall_mode: string
  top_cut_in_factor: string
  bot_cut_in_factor: string
  typical_height_ft: string
  notes: string
  active: 'Y' | 'N'
}

export type RoomTemplateMutationValues = {
  id: string
  display_name: string
  room_type_id: string
  default_wall_rate_id: string
  default_ceil_rate_id: string
  default_complexity_id: string
  default_wall_mode: string
  include_walls: 'Y' | 'N'
  include_ceilings: 'Y' | 'N'
  include_trim: 'Y' | 'N'
  include_doors: 'Y' | 'N'
  include_drywall: 'Y' | 'N'
  notes: string
  active: 'Y' | 'N'
}

export type ScopeDefaultMutationValues = {
  id: string
  display_name: string
  default_wall_mode: string
  top_cut_in_factor: string
  bot_cut_in_factor: string
  typical_height_ft: string
  include_walls: 'Y' | 'N'
  include_ceilings: 'Y' | 'N'
  include_trim: 'Y' | 'N'
  include_doors: 'Y' | 'N'
  include_drywall: 'Y' | 'N'
  notes: string
  active: 'Y' | 'N'
}

export type RatesFlagsCategoryValueMap = {
  production_rates_walls: ProductionRateMutationValues<'walls'>
  production_rates_ceilings: ProductionRateMutationValues<'ceilings'>
  production_rates_trim: ProductionRateMutationValues<'trim'>
  unit_rates_doors: DoorUnitRateMutationValues
  unit_rates_trim: TrimUnitRateMutationValues
  unit_rates_drywall: DrywallUnitRateMutationValues
  access_fees_ladders: AccessFeeMutationValues<'ladders'>
  access_fees_scaffolding: AccessFeeMutationValues<'scaffolding'>
  access_fees_specialty: AccessFeeMutationValues<'specialty'>
  supply_rates_per_color: SupplyRateMutationValues<'per_color'>
  supply_rates_area_based: SupplyRateMutationValues<'area_based'>
  supply_rates_per_job: SupplyRateMutationValues<'per_job'>
  supply_rates_roller_covers: RollerCoverSupplyRateMutationValues
  wall_complexity: WallComplexityMutationValues
  height_factors: HeightFactorMutationValues
  ceiling_types: CeilingTypeMutationValues
  condition_modifiers: ConditionModifierMutationValues
  room_types: RoomTypeMutationValues
  room_templates: RoomTemplateMutationValues
  scope_defaults: ScopeDefaultMutationValues
}

export type RatesFlagsMutationValues<
  TCategory extends RatesFlagsEditableCategoryKey = RatesFlagsEditableCategoryKey,
> = RatesFlagsCategoryValueMap[TCategory]

export type RatesFlagsCreateRequest<
  TCategory extends RatesFlagsEditableCategoryKey = RatesFlagsEditableCategoryKey,
> = {
  category: TCategory
  action: 'create'
  values: RatesFlagsMutationValues<TCategory>
}

export type RatesFlagsUpdateRequest<
  TCategory extends RatesFlagsEditableCategoryKey = RatesFlagsEditableCategoryKey,
> = {
  category: TCategory
  action: 'update'
  values: RatesFlagsMutationValues<TCategory>
  original_id: string
}

export type RatesFlagsArchiveRequest<
  TCategory extends RatesFlagsEditableCategoryKey = RatesFlagsEditableCategoryKey,
> = {
  category: TCategory
  action: 'archive'
  rowId: string
}

export type RatesFlagsReactivateRequest<
  TCategory extends RatesFlagsEditableCategoryKey = RatesFlagsEditableCategoryKey,
> = {
  category: TCategory
  action: 'reactivate'
  rowId: string
}

export type RatesFlagsCreateOrUpdateRequest<
  TCategory extends RatesFlagsEditableCategoryKey = RatesFlagsEditableCategoryKey,
> = RatesFlagsCreateRequest<TCategory> | RatesFlagsUpdateRequest<TCategory>

export type RatesFlagsActivationRequest<
  TCategory extends RatesFlagsEditableCategoryKey = RatesFlagsEditableCategoryKey,
> = RatesFlagsArchiveRequest<TCategory> | RatesFlagsReactivateRequest<TCategory>

export type RatesFlagsCreateRequestMap = {
  [TCategory in RatesFlagsEditableCategoryKey]: RatesFlagsCreateRequest<TCategory>
}

export type RatesFlagsUpdateRequestMap = {
  [TCategory in RatesFlagsEditableCategoryKey]: RatesFlagsUpdateRequest<TCategory>
}

export type RatesFlagsArchiveRequestMap = {
  [TCategory in RatesFlagsEditableCategoryKey]: RatesFlagsArchiveRequest<TCategory>
}

export type RatesFlagsReactivateRequestMap = {
  [TCategory in RatesFlagsEditableCategoryKey]: RatesFlagsReactivateRequest<TCategory>
}

export type RatesFlagsMutationRequestByCategory<
  TCategory extends RatesFlagsEditableCategoryKey,
> = RatesFlagsCreateOrUpdateRequest<TCategory> | RatesFlagsActivationRequest<TCategory>

export type RatesFlagsMutationRequestMap = {
  [TCategory in RatesFlagsEditableCategoryKey]: RatesFlagsMutationRequestByCategory<TCategory>
}

export type RatesFlagsCreateOrUpdateMutation =
  {
    [TCategory in RatesFlagsEditableCategoryKey]: RatesFlagsCreateOrUpdateRequest<TCategory>
  }[RatesFlagsEditableCategoryKey]

export type RatesFlagsActivationMutation =
  {
    [TCategory in RatesFlagsEditableCategoryKey]: RatesFlagsActivationRequest<TCategory>
  }[RatesFlagsEditableCategoryKey]

export type RatesFlagsArchiveMutation = RatesFlagsActivationMutation

export type RatesFlagsMutationRequest =
  | RatesFlagsCreateOrUpdateMutation
  | RatesFlagsActivationMutation

export type RatesFlagsCreateOrUpdateMutationRequest = Extract<
  RatesFlagsMutationRequest,
  { action: 'create' | 'update' }
>

export type RatesFlagsActivationMutationRequest = Extract<
  RatesFlagsMutationRequest,
  { action: 'archive' | 'reactivate' }
>

export type RatesFlagsDraftValue = string | number | boolean | null
export type RatesFlagsNumberDraftValue = number | null | string
export type RatesFlagsYnDraftValue = boolean | string | null

export type ProductionRateDraft = {
  id: string
  display_name: string
  scope_id: string
  surface_type: string
  condition: string
  prep_sqft_per_hr: RatesFlagsNumberDraftValue
  sqft_per_hr: RatesFlagsNumberDraftValue
  primer_sqft_per_hr: RatesFlagsNumberDraftValue
  notes: string
}

export type DoorUnitRateDraft = {
  id: string
  display_name: string
  unit_rate_type: string
  unit: string
  default_qty: RatesFlagsNumberDraftValue
  labor_rate: RatesFlagsNumberDraftValue
  material_rate: RatesFlagsNumberDraftValue
  amount: RatesFlagsNumberDraftValue
  notes: string
}

export type TrimUnitRateDraft = DoorUnitRateDraft & {
  helper_allowed: RatesFlagsYnDraftValue
  default_production_rate_id: string
}

export type DrywallUnitRateDraft = DoorUnitRateDraft

export type AccessFeeDraft = {
  id: string
  display_name: string
  fee_type: string
  amount: RatesFlagsNumberDraftValue
  unit: string
  notes: string
}

export type SupplyRateDraft = {
  id: string
  display_name: string
  scope: string
  unit: string
  cost_per: RatesFlagsNumberDraftValue
  notes: string
}

export type RollerCoverSupplyRateDraft = {
  id: string
  display_name: string
  scope: string
  size_in: RatesFlagsNumberDraftValue
  price_each: RatesFlagsNumberDraftValue
  notes: string
}

export type WallComplexityDraft = {
  id: string
  display_name: string
  primary_value: RatesFlagsNumberDraftValue
  secondary_value: RatesFlagsNumberDraftValue
  notes: string
}

export type HeightFactorDraft = {
  id: string
  display_name: string
  min_height_ft: RatesFlagsNumberDraftValue
  max_height_ft: RatesFlagsNumberDraftValue
  primary_value: RatesFlagsNumberDraftValue
  notes: string
}

export type CeilingTypeDraft = {
  id: string
  display_name: string
  primary_value: RatesFlagsNumberDraftValue
  secondary_value: RatesFlagsNumberDraftValue
  notes: string
}

export type ConditionModifierDraft = {
  id: string
  display_name: string
  wall_factor: RatesFlagsNumberDraftValue
  ceil_factor: RatesFlagsNumberDraftValue
  trim_factor: RatesFlagsNumberDraftValue
  notes: string
}

export type RoomTypeDraft = {
  id: string
  display_name: string
  default_wall_rate_id: string
  default_ceil_rate_id: string
  default_complexity_id: string
  default_wall_mode: string
  top_cut_in_factor: RatesFlagsNumberDraftValue
  bot_cut_in_factor: RatesFlagsNumberDraftValue
  typical_height_ft: RatesFlagsNumberDraftValue
  notes: string
}

export type RoomTemplateDraft = {
  id: string
  display_name: string
  room_type_id: string
  default_wall_rate_id: string
  default_ceil_rate_id: string
  default_complexity_id: string
  default_wall_mode: string
  include_walls: RatesFlagsYnDraftValue
  include_ceilings: RatesFlagsYnDraftValue
  include_trim: RatesFlagsYnDraftValue
  include_doors: RatesFlagsYnDraftValue
  include_drywall: RatesFlagsYnDraftValue
  notes: string
}

export type ScopeDefaultDraft = {
  id: string
  display_name: string
  default_wall_mode: string
  top_cut_in_factor: RatesFlagsNumberDraftValue
  bot_cut_in_factor: RatesFlagsNumberDraftValue
  typical_height_ft: RatesFlagsNumberDraftValue
  include_walls: RatesFlagsYnDraftValue
  include_ceilings: RatesFlagsYnDraftValue
  include_trim: RatesFlagsYnDraftValue
  include_doors: RatesFlagsYnDraftValue
  include_drywall: RatesFlagsYnDraftValue
  notes: string
}

export type RatesFlagsDraftByCategory = {
  production_rates_walls: ProductionRateDraft
  production_rates_ceilings: ProductionRateDraft
  production_rates_trim: ProductionRateDraft
  unit_rates_doors: DoorUnitRateDraft
  unit_rates_trim: TrimUnitRateDraft
  unit_rates_drywall: DrywallUnitRateDraft
  access_fees_ladders: AccessFeeDraft
  access_fees_scaffolding: AccessFeeDraft
  access_fees_specialty: AccessFeeDraft
  supply_rates_per_color: SupplyRateDraft
  supply_rates_area_based: SupplyRateDraft
  supply_rates_per_job: SupplyRateDraft
  supply_rates_roller_covers: RollerCoverSupplyRateDraft
  wall_complexity: WallComplexityDraft
  height_factors: HeightFactorDraft
  ceiling_types: CeilingTypeDraft
  condition_modifiers: ConditionModifierDraft
  room_types: RoomTypeDraft
  room_templates: RoomTemplateDraft
  scope_defaults: ScopeDefaultDraft
}

export type RatesFlagsRowByCategory = {
  production_rates_walls: ProductionRateRow
  production_rates_ceilings: ProductionRateRow
  production_rates_trim: ProductionRateRow
  unit_rates_doors: UnitRateRow
  unit_rates_trim: UnitRateRow
  unit_rates_drywall: UnitRateRow
  access_fees_ladders: AccessFeeRow
  access_fees_scaffolding: AccessFeeRow
  access_fees_specialty: AccessFeeRow
  supply_rates_per_color: SupplyRateRow
  supply_rates_area_based: SupplyRateRow
  supply_rates_per_job: SupplyRateRow
  supply_rates_roller_covers: SupplyRateRow
  wall_complexity: MultiplierRow
  height_factors: MultiplierRow
  ceiling_types: MultiplierRow
  condition_modifiers: ConditionModifierRow
  room_types: RoomTypeDefaultRow
  room_templates: RoomTemplateRow
  scope_defaults: ScopeDefaultRow
}

export type RatesFlagsRowForCategory<
  TCategory extends RatesFlagsEditableCategoryKey = RatesFlagsEditableCategoryKey,
> = RatesFlagsRowByCategory[TCategory]

export type RatesFlagsDraft<
  TCategory extends RatesFlagsEditableCategoryKey = RatesFlagsEditableCategoryKey,
> = RatesFlagsDraftByCategory[TCategory]

export type RatesFlagsDraftValidationResult =
  | {
      ok: true
    }
  | {
      ok: false
      error: string
      fieldKey?: string
    }
