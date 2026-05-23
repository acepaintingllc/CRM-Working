import type { YN } from '@/types/estimator/core'
import type { EstimateV2ConditionSelections as EstimateV2LegacyConditionSelections } from '@/lib/estimator/conditionModifiers'
import type { UnsafeRecord } from './v2Meta'

// Room-level types — room totals, input row shapes, room/roller drafts

export type EstimateV2RoomTotal = {
  room_id: string
  effective_area_sf: number
  effective_total?: number
}

export type EstimateV2WallRoomTotal = EstimateV2RoomTotal

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

export type EstimateV2RollerScope = 'Wall' | 'Ceiling' | 'Trim'

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
