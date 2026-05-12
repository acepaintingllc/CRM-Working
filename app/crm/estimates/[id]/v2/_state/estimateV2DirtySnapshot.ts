'use client'

import { buildEstimateV2SavePayload } from '@/lib/estimator/v2DraftPayload'
import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2CeilingSegmentDraft,
  EstimateV2AccessFeeDraft,
  EstimateV2DoorScopeDraft,
  EstimateV2DrywallRepairDraft,
  EstimateV2JobSettingsDraft,
  EstimateV2OtherItemDraft,
  EstimateV2PrejobTripDraft,
  EstimateV2RoomDraft,
  EstimateV2RoomFlagDraft,
  EstimateV2RollerDraft,
  EstimateV2SavePayload,
  EstimateV2TrimScopeDraft,
  EstimateV2WallScopeDraft,
  EstimateV2WallSegmentDraft,
} from '@/types/estimator/v2'

export type EstimateV2DirtySnapshot = {
  payload: EstimateV2SavePayload
  comparisonKey: string
}

export function createEstimateV2DirtySnapshot(
  payload: EstimateV2SavePayload
): EstimateV2DirtySnapshot {
  return {
    payload,
    comparisonKey: JSON.stringify(payload),
  }
}

export function buildEstimateV2DirtySnapshot(params: {
  jobSettingsDraft: EstimateV2JobSettingsDraft
  rooms: EstimateV2RoomDraft[]
  scopes: EstimateV2WallScopeDraft[]
  segments: EstimateV2WallSegmentDraft[]
  roomFlags: EstimateV2RoomFlagDraft[]
  ceilingScopes: EstimateV2CeilingScopeDraft[]
  ceilingSegments: EstimateV2CeilingSegmentDraft[]
  trimScopes: EstimateV2TrimScopeDraft[]
  doorScopes?: EstimateV2DoorScopeDraft[]
  drywallRepairs?: EstimateV2DrywallRepairDraft[]
  rollers?: EstimateV2RollerDraft[]
  accessFees?: EstimateV2AccessFeeDraft[]
  prejobTrips?: EstimateV2PrejobTripDraft[]
  otherItems?: EstimateV2OtherItemDraft[]
}): EstimateV2DirtySnapshot {
  const payload = buildEstimateV2SavePayload(
    params.jobSettingsDraft,
    params.rooms,
    params.scopes,
    params.segments,
    params.roomFlags,
    params.ceilingScopes,
    params.ceilingSegments,
    params.trimScopes,
    params.rollers ?? [],
    params.doorScopes ?? [],
    params.drywallRepairs ?? [],
    params.accessFees ?? [],
    params.otherItems ?? [],
    params.prejobTrips ?? []
  )

  return createEstimateV2DirtySnapshot(payload)
}

export function areEstimateV2DirtySnapshotsEqual(
  current: EstimateV2DirtySnapshot | null | undefined,
  saved: EstimateV2DirtySnapshot | null | undefined
) {
  if (!current && !saved) return true
  if (!current || !saved) return false
  return current.comparisonKey === saved.comparisonKey
}
