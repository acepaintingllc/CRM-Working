import type { YN } from '@/types/estimator/core'
import type {
  EstimateV2ConditionModifier as EstimateV2LegacyConditionModifier,
  EstimateV2ConditionSelections as EstimateV2LegacyConditionSelections,
} from '@/lib/estimator/conditionModifiers'

// Condition modifier types — room & scope conditions on the details page

export type ConditionLevel = 'active' | 'minor' | 'moderate' | 'major'

export type ConditionScopeFactors = {
  room: number
  wall: number
  ceiling: number
  trim: number
}

export type EstimateV2ConditionModifier = {
  id: string
  displayName: string
  scope: 'room' | 'wall' | 'ceiling' | 'trim'
  modifierType: 'binary' | 'severity'
  factorField: string
  levels: Partial<Record<ConditionLevel, number>>
}

export type EstimateV2ConditionSelections = {
  room: Record<string, ConditionLevel>
  wall: Record<string, ConditionLevel>
  ceiling: Record<string, ConditionLevel>
  trim: Record<string, ConditionLevel>
}

export type UnsafeRecord = Record<string, unknown>

export type EstimateV2EstimateMeta = {
  id: string
  org_id?: string | null
  job_id: string
  version_name: string | null
  version_state: string | null
  version_kind?: string | null
  updated_at?: string | null
}

export type EstimateV2JobMeta = {
  id: string
  title: string
  status: string | null
  customer_id: string | null
  customer_name: string | null
  customer_address: string | null
  customer_email: string | null
  customer_phone: string | null
}

export type EstimateV2JobResponse = {
  job: EstimateV2JobMeta
}

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
  value: number
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

export type EstimateV2AccessFeeDraft = {
  id: string
  roomId: string
  accessFeeId: string
  qty: string
  actualCostOverride: string
  notes: string
  position: number
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

export type EstimateV2WallScopeTrace = {
  scope_id: string | null
  area: {
    effective_area_sf: number | null
  }
}

export type EstimateV2RoomTotal = {
  room_id: string
  effective_area_sf: number
  effective_total?: number
}

export type EstimateV2WallRoomTotal = EstimateV2RoomTotal

export type EstimateV2WallCalculationsPayload = {
  scopes?: UnsafeRecord[]
  segments?: UnsafeRecord[]
  room_totals?: EstimateV2RoomTotal[]
  scope_traces?: EstimateV2WallScopeTrace[]
}

export type EstimateV2TrimPaint = {
  paint_product_id: string | null
  paint_product_label: string | null
  gallons: number
  quarts: number
  normalized_gallons: number
  paint_cost: number
}

export type EstimateV2PricingSummary = {
  rawLaborHours: number
  rawLaborDays: number
  effectiveLaborDays: number
  effectiveLaborHours: number
  laborCost: number
  wallPaintMaterialCost: number
  ceilingPaintMaterialCost: number
  trimPaintMaterialCost: number
  paintMaterialCost: number
  primerMaterialCost: number
  supplyCost: number
  sharedAccessCost?: number
  accessFeeAllocation?: {
    walls: number
    ceilings: number
    trim: number
    unallocated: number
    warning: string | null
  }
  prePolicyTotal: number
  postLaborPolicyTotal: number
  minimumAdjustmentAmount: number
  finalTotal: number
  rooms: Array<{
    room_id: string
    baseTotal: number
    allocatedMinimumAdjustment: number
    finalTotal: number
  }>
  trimPaint: EstimateV2TrimPaint | null
}

export type EstimateV2JobSettingsInput = {
  labor_day_policy_enabled?: boolean | null
  dayhours?: number | null
  rounding_increment_hours?: number | null
  override_labor_rate?: number | null
  job_minimum_enabled?: boolean | null
  job_minimum_amount?: number | null
  crew_size?: number | null
  wall_paint_id?: string | null
  wall_primer_id?: string | null
  walls_paint_id?: string | null
  walls_primer_id?: string | null
  ceiling_paint_id?: string | null
  ceiling_primer_id?: string | null
  trim_paint_id?: string | null
  trim_primer_id?: string | null
  primer_id?: string | null
  standard_door_deduction_sf?: number | null
  standard_window_deduction_sf?: number | null
  baseboard_opening_deduction_lf?: number | null
  condition_selections?: EstimateV2ConditionSelections | null
}

export type EstimateV2PaintProductRow = {
  id: string
  label?: string | null
  display_name?: string | null
  display_id?: string | null
  name?: string | null
  type?: string | null
  scopes?: string[]
}

export type EstimateV2RoomInputRow = {
  id: string
  room_id: string
  room_name?: string | null
  notes?: string | null
  position?: number | null
  length_in?: number | null
  width_in?: number | null
  wallheight_in?: number | null
  mode?: 'RECT' | 'SEG' | null
  condition_selections?: EstimateV2LegacyConditionSelections | null
}

export type EstimateV2RoomFlagRow = {
  id: string
  room_id: string
  flag_id: string
  position?: number | null
  active?: YN | null
}

export type EstimateV2RollerInputRow = UnsafeRecord & {
  id: string
  scope: EstimateV2RollerScope
  wall_color_id?: string | null
  selected_option_id?: string | null
  roller_size_in?: number | string | null
  covers_qty?: number | string | null
  notes?: string | null
  position?: number | null
  active?: YN | null
}

export type EstimateV2ResponseInputs = {
  jobsettings: EstimateV2JobSettingsInput | null
  org_defaults: EstimateV2JobSettingsInput | null
  paint_products: EstimateV2PaintProductRow[]
  rooms: EstimateV2RoomInputRow[]
  room_wall_scopes: UnsafeRecord[]
  segments: UnsafeRecord[]
  wall_segments: UnsafeRecord[]
  ceiling_segments: UnsafeRecord[]
  room_ceiling_scopes: UnsafeRecord[]
  ceiling_scope_segments: UnsafeRecord[]
  room_trim_scopes: UnsafeRecord[]
  room_door_scopes?: UnsafeRecord[]
  drywall_repairs?: UnsafeRecord[]
  rollers: EstimateV2RollerInputRow[]
  prejob: UnsafeRecord[]
  trim_items: UnsafeRecord[]
  job_colors: UnsafeRecord[]
  room_flags: EstimateV2RoomFlagRow[]
  access_fees: UnsafeRecord[]
  other: UnsafeRecord[]
}

export type EstimateV2GetResponse = {
  estimate: EstimateV2EstimateMeta
  inputs: EstimateV2ResponseInputs
  wall_calculations: EstimateV2WallCalculationsPayload | null
  ceiling_calculations: UnsafeRecord | null
  trim_calculations: UnsafeRecord | null
  door_calculations?: UnsafeRecord | null
  drywall_calculations?: UnsafeRecord | null
  trim_paint: EstimateV2TrimPaint | null
  pricing_summary: EstimateV2PricingSummary | null
}

export type EstimateV2SummaryPageData = {
  estimate: EstimateV2EstimateMeta
  inputs: Partial<EstimateV2ResponseInputs>
  wall_calculations?: {
    scopes?: UnsafeRecord[]
    room_totals?: EstimateV2RoomTotal[]
  }
  ceiling_calculations?: {
    scopes?: UnsafeRecord[]
    room_totals?: EstimateV2RoomTotal[]
  }
  trim_calculations?: {
    scopes?: UnsafeRecord[]
    room_totals?: EstimateV2RoomTotal[]
  }
  door_calculations?: {
    scopes?: UnsafeRecord[]
    room_totals?: EstimateV2RoomTotal[]
  }
  drywall_calculations?: {
    scopes?: UnsafeRecord[]
    room_totals?: EstimateV2RoomTotal[]
  }
  trim_paint?: EstimateV2TrimPaint | null
  pricing_summary?: EstimateV2PricingSummary | null
}

export type EstimateV2JobSettingsDraft = {
  laborDayEnabled: boolean
  dayhours: number
  roundingIncrementHours: number
  laborRate: number
  jobMinEnabled: boolean
  jobMinAmount: number
  crewSize: number
  wallPaintProductId: string
  wallPrimerProductId: string
  ceilingPaintProductId: string
  ceilingPrimerProductId: string
  trimPaintProductId: string
  trimPrimerProductId: string
  standardDoorDeductionSf?: number
  standardWindowDeductionSf?: number
  baseboardOpeningDeductionLf?: number
  conditionSelections?: EstimateV2ConditionSelections
  resolvedConditionFactors?: ConditionScopeFactors
}

export type EstimateV2JobDefaultProducts = {
  wallPaintProductId: string
  wallPrimerProductId: string
  ceilingPaintProductId: string
  ceilingPrimerProductId: string
  trimPaintProductId: string
  trimPrimerProductId: string
}

export type EstimateV2CustomerDraft = {
  customerId: string
  name: string
  email: string
  phone: string
  address: string
}

export type EstimateV2RoomDraft = {
  id: string
  roomId: string
  roomName: string
  roomTypeId: string
  lengthIn: string
  widthIn: string
  heightIn: string
  wallComplexityId: string
  notes: string
  position: number
  conditionSelections?: EstimateV2LegacyConditionSelections
}

export type EstimateV2RoomFlagDraft = {
  id: string
  roomId: string
  flagId: string
  position: number
}

export type EstimateV2RollerScope = 'Wall' | 'Ceiling' | 'Trim'

export type EstimateV2RollerDraft = {
  id: string
  scope: EstimateV2RollerScope
  wallColorId: string
  selectedOptionId?: string
  rollerSizeIn: string
  coversQty: string
  notes: string
  position: number
}

export type EstimateV2WallScopeMode = 'RECT' | 'SEG'
export type EstimateV2WallPrimeMode = 'NONE' | 'SPOT' | 'FULL'
export type EstimateV2WallSegmentShape = 'RECTANGLE' | 'TRIANGLE' | 'MANUAL'

export type EstimateV2WallScopeDraft = {
  id: string
  roomId: string
  position: number
  mode: EstimateV2WallScopeMode
  include: YN
  scopeName: string
  colorId: string
  paintProductId: string
  primerProductId: string
  primeMode: EstimateV2WallPrimeMode
  heightIn: string
  perimeterIn: string
  standardDoorCount: string
  standardWindowCount: string
  heightFactor: string
  complexityFactor: string
  wallFlagFactor: string
  cutInTopFactor: string
  cutInBottomFactor: string
  paintCoats: string
  primerCoats: string
  spotPrimePercent: string
  overrideAreaSqFt: string
  overridePaintHours: string
  overridePrimerHours: string
  overridePaintGallons: string
  overridePrimerGallons: string
  overrideSupplyCost: string
  overrideTotal: string
  notes: string
  conditionSelections?: EstimateV2LegacyConditionSelections
}

export type EstimateV2WallSegmentDraft = {
  id: string
  wallScopeId: string
  roomId: string
  position: number
  segmentName: string
  include: YN
  shapeType: EstimateV2WallSegmentShape
  quantity: string
  widthIn: string
  heightIn: string
  baseIn: string
  manualAreaSqFt: string
  standardDoorCount: string
  standardWindowCount: string
  overrideAreaSqFt: string
  notes: string
}

export type EstimateV2CeilingScopeMode = 'RECT' | 'SEG'
export type EstimateV2CeilingPrimeMode = 'NONE' | 'SPOT' | 'FULL'
export type EstimateV2CeilingSegmentShape = 'RECTANGLE' | 'TRIANGLE' | 'MANUAL'

export type EstimateV2CeilingGeometryMode = 'FLAT' | 'VAULTED' | 'TRAY' | 'COFFERED' | 'MANUAL'

export type EstimateV2CeilingScopeDraft = {
  id: string
  roomId: string
  position: number
  mode: EstimateV2CeilingScopeMode
  include: YN
  scopeName: string
  colorId: string
  paintProductId: string
  primerProductId: string
  primeMode: EstimateV2CeilingPrimeMode
  spotPrimePercent: string
  ceilingTypeId: string
  ceilingGeometryMode?: string
  vaultedAreaFactor?: string
  vaultedRidgeLengthIn?: string
  vaultedSlopeLengthIn?: string
  vaultedPlaneCount?: string
  trayPerimeterIn?: string
  trayStepHeightIn?: string
  trayBandWidthIn?: string
  cofferSectionLengthIn?: string
  cofferSectionWidthIn?: string
  cofferSectionCount?: string
  cofferFaceHeightIn?: string
  cofferBottomWidthIn?: string
  lengthIn: string
  widthIn: string
  areaSf: string
  heightFactor: string
  complexityFactor: string
  ceilingFlagFactor: string
  paintCoats: string
  primerCoats: string
  overrideAreaSqFt: string
  overridePaintHours: string
  overridePrimerHours: string
  overridePaintGallons: string
  overridePrimerGallons: string
  overrideSupplyCost: string
  overrideTotal: string
  notes: string
  conditionSelections?: EstimateV2LegacyConditionSelections
}

export type EstimateV2CeilingSegmentDraft = {
  id: string
  ceilingScopeId: string
  roomId: string
  position: number
  segmentName: string
  include: YN
  shapeType: EstimateV2CeilingSegmentShape
  quantity: string
  widthIn: string
  heightIn: string
  baseIn: string
  manualAreaSqFt: string
  overrideAreaSqFt: string
  notes: string
}

export type EstimateV2TrimUnitType = 'LF' | 'EA' | 'SF'
export type EstimateV2TrimMeasurementMode = 'MANUAL' | 'ROOM_HELPER'

export type EstimateV2TrimScopeDraft = {
  id: string
  roomId: string
  position: number
  include: YN
  scopeName: string
  trimTypeId: string
  trimFamily: string
  unitType: EstimateV2TrimUnitType
  measurementMode: EstimateV2TrimMeasurementMode
  helperSource: 'ROOM_PERIMETER' | ''
  measurementValue: string
  helperValue: string
  baseboardOpeningCount: string
  colorId: string
  paintProductId: string
  primerProductId: string
  paintEnabled: YN
  primeMode: 'NONE' | 'SPOT' | 'FULL'
  spotPrimePercent: string
  productionRateId: string
  prepFactor: string
  heightFactor: string
  profileFactor: string
  roomFlagFactor: string
  maskingFactor: string
  stairFactor: string
  difficultFinishFactor: string
  caulkFillFactor: string
  paintCoats: string
  primerCoats: string
  overrideMeasurement: string
  overrideHours: string
  overrideGallons: string
  overrideSupplyCost: string
  overrideTotal: string
  overrideDescription: string
  notes: string
  conditionSelections?: EstimateV2LegacyConditionSelections
}

export type EstimateV2DoorScopeDraft = {
  id: string
  roomId: string
  position: number
  include: YN
  scopeName: string
  doorTypeId: string
  quantity: string
  sides: string
  colorId: string
  paintProductId: string
  primerProductId: string
  primeMode: 'NONE' | 'SPOT' | 'FULL'
  spotPrimePercent: string
  paintCoats: string
  primerCoats: string
  conditionFactor: string
  laborRate: string
  materialRate: string
  overridePaintHours: string
  overridePrimerHours: string
  overrideMaterialCost: string
  overrideSupplyCost: string
  overrideTotal: string
  notes: string
}

export type EstimateV2DrywallRepairDraft = {
  id: string
  roomId: string
  position: number
  surface: 'wall' | 'ceiling'
  repairType: string
  unit: 'LF' | 'SQFT'
  quantity: string
  overrideTotal: string
}

export type EstimateV2OtherPricingMode = 'fixed' | 'quantity_rate' | 'labor' | 'material_supply'
export type EstimateV2OtherRollupTarget =
  | 'other'
  | 'walls'
  | 'ceilings'
  | 'trim'
  | 'doors'
  | 'drywall'
  | 'room_total'
  | 'job_total'
export type EstimateV2OtherCustomerVisibility = 'standalone' | 'rollup'

export type EstimateV2OtherItemDraft = {
  id: string
  roomId: string
  position: number
  include: YN
  description: string
  customerLabel: string
  pricingMode: EstimateV2OtherPricingMode
  quantity: string
  unitRate: string
  laborHours: string
  laborRate: string
  materialCost: string
  supplyCost: string
  fixedAmount: string
  rollupTarget: EstimateV2OtherRollupTarget
  customerVisibility: EstimateV2OtherCustomerVisibility
  internalNotes: string
}

export type EstimateV2WallSegmentDerived = {
  rawArea: number | null
  deductionArea: number
  deductionAdjustedArea: number | null
  effectiveArea: number | null
}

export type EstimateV2WallScopeDerived = {
  rawArea: number | null
  effectiveArea: number | null
}

export type EstimateV2SavePayload = {
  jobsettings: {
    labor_day_policy_enabled: boolean
    dayhours: number
    rounding_increment_hours: number
    override_labor_rate: number
    job_minimum_enabled: boolean
    job_minimum_amount: number
    crew_size: number
    walls_paint_id: string | null
    walls_primer_id: string | null
    ceiling_paint_id: string | null
    ceiling_primer_id: string | null
    trim_paint_id: string | null
    trim_primer_id: string | null
    standard_door_deduction_sf: number
    standard_window_deduction_sf: number
    baseboard_opening_deduction_lf: number
    condition_selections: EstimateV2ConditionSelections | null
  }
  rooms: Array<{
    id: string
    room_id: string
    room_name: string
    notes: string | null
    position: number
    room_type_id: string | null
    wall_complexity_id: string | null
    length_in: number | null
    width_in: number | null
    wallheight_in: number | null
    condition_selections: EstimateV2LegacyConditionSelections | null
  }>
  room_wall_scopes: UnsafeRecord[]
  wall_segments: UnsafeRecord[]
  room_flags: EstimateV2RoomFlagRow[]
  rollers: Array<{
    id: string
    scope: EstimateV2RollerScope
    wall_color_id: string | null
    selected_option_id: string | null
    roller_size_in: number | null
    covers_qty: number | null
    notes: string | null
    position: number
  }>
  access_fees: Array<{
    id: string
    room_id: string | null
    access_fee_id: string
    qty: number | null
    actual_cost_override: number | null
    notes: string | null
    position: number
    active: 'Y'
  }>
  room_ceiling_scopes: UnsafeRecord[]
  ceiling_scope_segments: UnsafeRecord[]
  room_trim_scopes: UnsafeRecord[]
  room_door_scopes?: UnsafeRecord[]
  drywall_repairs?: UnsafeRecord[]
  other?: UnsafeRecord[]
}
