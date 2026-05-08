import { supabaseAdmin } from '../org.ts'
import { asText } from '../../estimator/parsing.ts'
import type {
  EstimateAccessFeePersistenceRow,
  EstimateCeilingScopeSegmentPersistenceRow,
  EstimateDrywallRepairPersistenceRow,
  EstimateJobColorPersistenceRow,
  EstimateJobSettingsPersistenceRow,
  EstimateOtherPersistenceRow,
  EstimatePrejobPersistenceRow,
  EstimateRollerPersistenceRow,
  EstimateRoomCeilingScopePersistenceRow,
  EstimateRoomDoorScopePersistenceRow,
  EstimateRoomFlagPersistenceRow,
  EstimateRoomPersistenceRow,
  EstimateRoomTrimScopePersistenceRow,
  EstimateRoomWallScopePersistenceRow,
  EstimateTrimItemPersistenceRow,
  EstimateWallScopeSegmentPersistenceRow,
} from './persistenceTypes.ts'

export type EstimateFullPersistencePayload = {
  jobsettings?: EstimateJobSettingsPersistenceRow
  room_save_mode?: 'v2_roster'
  rooms?: EstimateRoomPersistenceRow[]
  room_wall_scopes?: EstimateRoomWallScopePersistenceRow[]
  wall_segments?: EstimateWallScopeSegmentPersistenceRow[]
  room_ceiling_scopes?: EstimateRoomCeilingScopePersistenceRow[]
  ceiling_scope_segments?: EstimateCeilingScopeSegmentPersistenceRow[]
  room_trim_scopes?: EstimateRoomTrimScopePersistenceRow[]
  room_door_scopes?: EstimateRoomDoorScopePersistenceRow[]
  drywall_repairs?: EstimateDrywallRepairPersistenceRow[]
  rollers?: EstimateRollerPersistenceRow[]
  job_colors?: EstimateJobColorPersistenceRow[]
  room_flags?: EstimateRoomFlagPersistenceRow[]
  access_fees?: EstimateAccessFeePersistenceRow[]
  prejob?: EstimatePrejobPersistenceRow[]
  trim_items?: EstimateTrimItemPersistenceRow[]
  other?: EstimateOtherPersistenceRow[]
}

export async function saveEstimateFullPersistenceTransactional(params: {
  orgId: string
  estimateId: string
  jobId: string
  payload: EstimateFullPersistencePayload
}) {
  const rpc = await supabaseAdmin.rpc('save_estimate_v2_full_persistence', {
    p_org_id: params.orgId,
    p_estimate_id: params.estimateId,
    p_job_id: params.jobId,
    p_payload: params.payload,
  })
  if (rpc.error) throw new Error(rpc.error.message)
  return rpc.data ?? null
}

export function isMissingFullEstimateSaveRpc(message: string) {
  const lowered = asText(message).toLowerCase()
  if (
    !lowered.includes('save_estimate_v2_full_persistence') &&
    !lowered.includes('function public.save_estimate_v2_full_persistence')
  ) {
    return false
  }
  return (
    lowered.includes('does not exist') ||
    lowered.includes('could not find the function') ||
    lowered.includes('function public.save_estimate_v2_full_persistence')
  )
}
