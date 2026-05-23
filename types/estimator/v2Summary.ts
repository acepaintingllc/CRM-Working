import type { EstimateV2ConditionSelections } from './v2Conditions'
import type { UnsafeRecord, EstimateV2EstimateMeta } from './v2Meta'
import type {
  EstimateV2RoomTotal,
  EstimateV2PaintProductRow,
  EstimateV2RoomInputRow,
  EstimateV2RoomFlagRow,
  EstimateV2RollerInputRow,
  EstimateV2RollerScope,
} from './v2Rooms'
import type { EstimateV2WallCalculationsPayload } from './v2Scopes'
import type { EstimateV2JobSettingsInput } from './v2Settings'
import type { EstimateV2ConditionSelections as EstimateV2LegacyConditionSelections } from '@/lib/estimator/conditionModifiers'
import type {
  EstimateV2CeilingScopeSaveRow,
  EstimateV2CeilingSegmentSaveRow,
  EstimateV2DoorScopeSaveRow,
  EstimateV2DrywallRepairSaveRow,
  EstimateV2TrimScopeSaveRow,
  EstimateV2WallScopeSaveRow,
  EstimateV2WallSegmentSaveRow,
} from './v2Boundary'

// Summary and API payload types — pricing output, full response shapes, and save payload

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
  prepTripCost?: number
  access_fee_total?: number
  accessFeeAllocation?: {
    walls: number
    ceilings: number
    trim: number
    doors: number
    drywall: number
    other: number
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

export type EstimateV2ResponseInputs = {
  jobsettings: EstimateV2JobSettingsInput | null
  org_defaults: EstimateV2JobSettingsInput | null
  paint_products: EstimateV2PaintProductRow[]
  rooms: EstimateV2RoomInputRow[]
  room_wall_scopes: EstimateV2WallScopeSaveRow[]
  wall_segments: EstimateV2WallSegmentSaveRow[]
  room_ceiling_scopes: EstimateV2CeilingScopeSaveRow[]
  ceiling_scope_segments: EstimateV2CeilingSegmentSaveRow[]
  room_trim_scopes: EstimateV2TrimScopeSaveRow[]
  room_door_scopes?: EstimateV2DoorScopeSaveRow[]
  drywall_repairs?: EstimateV2DrywallRepairSaveRow[]
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

export type EstimateV2SavePayload = {
  jobsettings: {
    labor_day_policy_enabled: boolean | null
    dayhours: number | null
    rounding_increment_hours: number | null
    override_labor_rate: number | null
    job_minimum_enabled: boolean | null
    job_minimum_amount: number | null
    crew_size: number | null
    walls_paint_id: string | null
    walls_primer_id: string | null
    ceiling_paint_id: string | null
    ceiling_primer_id: string | null
    trim_paint_id: string | null
    trim_primer_id: string | null
    trim_paint_gallons?: number | null
    trim_paint_quarts?: number | null
    trim_paint_qty?: number | null
    trim_paint_uom?: string | null
    paint_supplied_by?: string | null
    standard_door_deduction_sf: number | null
    standard_window_deduction_sf: number | null
    baseboard_opening_deduction_lf: number | null
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
  room_wall_scopes: EstimateV2WallScopeSaveRow[]
  wall_segments: EstimateV2WallSegmentSaveRow[]
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
  prejob?: Array<{
    id: string
    room_id: string | null
    position: number
    active: 'Y' | 'N'
    trip_name: string | null
    trip_num: number | null
    trip_rate: number | null
    manual_adjustment: number | null
    notes: string | null
  }>
  room_ceiling_scopes: EstimateV2CeilingScopeSaveRow[]
  ceiling_scope_segments: EstimateV2CeilingSegmentSaveRow[]
  room_trim_scopes: EstimateV2TrimScopeSaveRow[]
  room_door_scopes?: EstimateV2DoorScopeSaveRow[]
  drywall_repairs?: EstimateV2DrywallRepairSaveRow[]
  other?: UnsafeRecord[]
}
