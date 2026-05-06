import type {
  V2CeilingScopeSaveRow,
  V2CeilingSegmentSaveRow,
  V2DoorScopeSaveRow,
  V2DrywallRepairSaveRow,
  V2RoomRosterRow,
  V2TrimScopeSaveRow,
  V2WallScopeSaveRow,
  V2WallSegmentSaveRow,
} from '../estimateV2RoutePayload.ts'

type EstimatePersistenceIdentity = {
  id?: string
  org_id: string
  estimate_id: string
  job_id: string
}

export type EstimateJobSettingsPersistenceRow = EstimatePersistenceIdentity & {
  walls_paint_id: string | null
  ceiling_paint_id: string | null
  trim_paint_id: string | null
  primer_id: string | null
  walls_primer_id: string | null
  ceiling_primer_id: string | null
  trim_primer_id: string | null
  override_labor_rate: number | null
  override_markup: number | null
  rounding_increment_hours: number | null
  dayhours: number | null
  default_walls_prep_level: string | null
  default_ceiling_prep_level: string | null
  default_trim_prep_level: string | null
  notes: string | null
  walls_paint_gal_override: number | null
  ceiling_paint_gal_override: number | null
  primer_gal_override: number | null
  extra_supplies_walls: number | null
  extra_supplies_ceilings: number | null
  extra_supplies_trim: number | null
  trim_paint_gallons: number | null
  trim_paint_quarts: number | null
  trim_paint_qty: number | null
  trim_paint_uom: string | null
  trim_primer_qty: number | null
  trim_primer_uom: string | null
  paint_supplied_by: string | null
  crew_size: number | null
  standard_door_deduction_sf: number | null
  standard_window_deduction_sf: number | null
  baseboard_opening_deduction_lf: number | null
  labor_day_policy_enabled: boolean | undefined
  job_minimum_enabled: boolean | undefined
  job_minimum_amount: number | null
}

export type EstimateRoomPersistenceRow = EstimatePersistenceIdentity &
  Omit<V2RoomRosterRow, 'id'> & {
    mode?: 'RECT'
    walls_include?: 'N'
    ceiling_include?: 'N'
    trim_include?: 'N'
    doors_include?: 'N'
    drywall_include?: 'N'
  }

export type EstimateRoomWallScopePersistenceRow = EstimatePersistenceIdentity &
  V2WallScopeSaveRow

export type EstimateWallScopeSegmentPersistenceRow = EstimatePersistenceIdentity &
  V2WallSegmentSaveRow & {
    seg_no: number
  }

export type EstimateRoomCeilingScopePersistenceRow = EstimatePersistenceIdentity &
  V2CeilingScopeSaveRow

export type EstimateCeilingScopeSegmentPersistenceRow = EstimatePersistenceIdentity &
  V2CeilingSegmentSaveRow

export type EstimateRoomTrimScopePersistenceRow = EstimatePersistenceIdentity &
  V2TrimScopeSaveRow

export type EstimateRoomDoorScopePersistenceRow = EstimatePersistenceIdentity &
  V2DoorScopeSaveRow

export type EstimateDrywallRepairPersistenceRow = EstimatePersistenceIdentity &
  V2DrywallRepairSaveRow

export type EstimateAccessFeePersistenceRow = EstimatePersistenceIdentity & {
  position: number
  room_id: string | null
  segment_num: number | null
  access_fee_id: string
  qty: number
  active: 'Y' | 'N'
  notes: string | null
  actual_cost_override: number | null
}

export type EstimateOtherPersistenceRow = EstimatePersistenceIdentity & {
  position: number
  rollup_scope: 'Walls' | 'Ceilings' | 'Trim' | 'Other'
  location: string | null
  client_description: string
  qty: number
  uom: string | null
  labor_hrs_each: number
  materials_each: number
  notes: string | null
  active: 'Y' | 'N'
  room_id: string | null
  description: string | null
  customer_label: string | null
  pricing_mode: string | null
  quantity: number | null
  unit_rate: number | null
  labor_hours: number | null
  labor_rate: number | null
  material_cost: number | null
  supply_cost: number | null
  fixed_amount: number | null
  rollup_target: string
  customer_visibility: string
  internal_notes: string | null
}
