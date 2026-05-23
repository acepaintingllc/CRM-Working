import type { EstimateV2ConditionSelections, ConditionScopeFactors } from './v2Conditions'

// Job-level settings — input shapes (DB/API), UI drafts, and product defaults

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
