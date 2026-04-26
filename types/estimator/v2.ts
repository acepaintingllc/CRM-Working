import type { YN } from '@/types/estimator/core'

export type UnsafeRecord = Record<string, unknown>

export type EstimateV2EstimateMeta = {
  id: string
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

export type EstimateV2PaintProductOption = EstimateV2CatalogOption & {
  type: string
  scopes?: string[]
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
}

export type EstimateV2HeightFactorOption = EstimateV2CatalogOption & {
  min_height_ft: number | null
  max_height_ft: number | null
  labor_multiplier: number | null
}

export type EstimateV2TrimTypeOption = EstimateV2CatalogOption & {
  family: string | null
  category: string | null
  unit_type: 'LF' | 'EA' | 'SF' | null
  helper_allowed: boolean
  default_production_rate_id: string | null
}

export type EstimateV2Catalogs = {
  paint_products: EstimateV2PaintProductOption[]
  color_codes: EstimateV2CatalogOption[]
  production_rates: EstimateV2ProductionRateOption[]
  height_factors: EstimateV2HeightFactorOption[]
  room_types: EstimateV2CatalogOption[]
  room_flags: EstimateV2RoomFlagOption[]
  ceiling_types: EstimateV2CeilingTypeOption[]
  trim_items: EstimateV2TrimTypeOption[]
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
  wall_paint_id?: string | null
  wall_primer_id?: string | null
  walls_paint_id?: string | null
  walls_primer_id?: string | null
  ceiling_paint_id?: string | null
  ceiling_primer_id?: string | null
  trim_paint_id?: string | null
  trim_primer_id?: string | null
  primer_id?: string | null
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
}

export type EstimateV2RoomFlagRow = {
  id: string
  room_id: string
  flag_id: string
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
  rollers: UnsafeRecord[]
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
  wallPaintProductId: string
  wallPrimerProductId: string
  ceilingPaintProductId: string
  ceilingPrimerProductId: string
  trimPaintProductId: string
  trimPrimerProductId: string
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
  rooms: Array<{
    id: string
    room_id: string
    room_name: string
    notes: string | null
    position: number
    length_in: number | null
    width_in: number | null
    wallheight_in: number | null
  }>
  room_wall_scopes: UnsafeRecord[]
  wall_segments: UnsafeRecord[]
  room_flags: EstimateV2RoomFlagRow[]
  room_ceiling_scopes: UnsafeRecord[]
  ceiling_scope_segments: UnsafeRecord[]
  room_trim_scopes: UnsafeRecord[]
  rollers: UnsafeRecord[]
}
