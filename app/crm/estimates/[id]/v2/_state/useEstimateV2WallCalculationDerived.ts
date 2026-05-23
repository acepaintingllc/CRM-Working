'use client'

import { useMemo } from 'react'
import {
  buildLocalRoomEffectiveAreaByRoomId,
  buildLocalScopeEffectiveAreaById,
  buildLocalSegmentEffectiveAreaById,
  buildWallRoomEffectiveAreaByRoomId,
  buildWallScopeEffectiveAreaById,
  buildWallScopeEffectiveTotalById,
  buildWallSegmentEffectiveAreaById,
  sumIncludedValues,
} from '../_lib/estimateV2EditorDerived'
import { buildOverrideDrivenTotalById } from './estimateV2OverrideDrivenTotals'
import { selectDisplayedMap } from './useEstimateV2CalculationContext'
import type { EstimateV2EditorMetaState } from './estimateV2EditorTypes'
import type { calculateEstimateV2Preview } from '@/lib/estimator/v2PreviewCalculations'
import type { EstimateV2RoomDraft } from '@/types/estimator/v2Rooms'
import type {
  EstimateV2WallScopeDraft,
  EstimateV2WallSegmentDraft,
} from '@/types/estimator/v2Scopes'
import type { EstimateV2SavePayload } from '@/types/estimator/v2Summary'

export function useEstimateV2WallCalculationDerived(params: {
  rooms: EstimateV2RoomDraft[]
  scopes: EstimateV2WallScopeDraft[]
  segments: EstimateV2WallSegmentDraft[]
  wallCalculations: EstimateV2EditorMetaState['wallCalculations']
  currentWallScopes: EstimateV2SavePayload['room_wall_scopes']
  localWallCalculations: ReturnType<typeof calculateEstimateV2Preview>['walls']
  selectedRoom: EstimateV2RoomDraft | null
  firstScope: { id: string } | null
  selectedRoomScopes: Array<{ id: string; include: 'Y' | 'N' }>
  useLocalPreviewCalculations: boolean
}) {
  const {
    rooms,
    scopes,
    segments,
    wallCalculations,
    currentWallScopes,
    localWallCalculations,
    selectedRoom,
    firstScope,
    selectedRoomScopes,
    useLocalPreviewCalculations,
  } = params
  const scopeEffectiveAreaById = useMemo(
    () => buildWallScopeEffectiveAreaById(wallCalculations),
    [wallCalculations]
  )
  const wallScopeEffectiveTotalById = useMemo(
    () => buildWallScopeEffectiveTotalById(wallCalculations),
    [wallCalculations]
  )
  const segmentEffectiveAreaById = useMemo(
    () => buildWallSegmentEffectiveAreaById(wallCalculations),
    [wallCalculations]
  )
  const roomEffectiveAreaByRoomId = useMemo(
    () => buildWallRoomEffectiveAreaByRoomId(wallCalculations),
    [wallCalculations]
  )
  const localSegmentEffectiveAreaById = useMemo(
    () => buildLocalSegmentEffectiveAreaById(segments),
    [segments]
  )
  const localScopeEffectiveAreaById = useMemo(
    () => buildLocalScopeEffectiveAreaById(scopes, segments),
    [scopes, segments]
  )
  const localRoomEffectiveAreaByRoomId = useMemo(
    () => buildLocalRoomEffectiveAreaByRoomId(rooms, scopes, localScopeEffectiveAreaById),
    [rooms, scopes, localScopeEffectiveAreaById]
  )
  const localWallScopeEffectiveTotalById = useMemo(
    () =>
      buildOverrideDrivenTotalById({
        rows: currentWallScopes,
        calculatedTotalById: buildWallScopeEffectiveTotalById(localWallCalculations),
        overrideKeys: [
          'override_paint_hours',
          'override_primer_hours',
          'override_paint_gallons',
          'override_primer_gallons',
          'override_supply_cost',
          'override_total',
        ],
      }),
    [currentWallScopes, localWallCalculations]
  )
  const displayedSegmentEffectiveAreaById = useMemo(
    () =>
      selectDisplayedMap(
        useLocalPreviewCalculations,
        localSegmentEffectiveAreaById,
        segmentEffectiveAreaById
      ),
    [localSegmentEffectiveAreaById, segmentEffectiveAreaById, useLocalPreviewCalculations]
  )
  const displayedScopeEffectiveAreaById = useMemo(
    () =>
      selectDisplayedMap(
        useLocalPreviewCalculations,
        localScopeEffectiveAreaById,
        scopeEffectiveAreaById
      ),
    [localScopeEffectiveAreaById, scopeEffectiveAreaById, useLocalPreviewCalculations]
  )
  const displayedRoomEffectiveAreaByRoomId = useMemo(
    () =>
      selectDisplayedMap(
        useLocalPreviewCalculations,
        localRoomEffectiveAreaByRoomId,
        roomEffectiveAreaByRoomId
      ),
    [localRoomEffectiveAreaByRoomId, roomEffectiveAreaByRoomId, useLocalPreviewCalculations]
  )
  const displayedWallScopeEffectiveTotalById = useMemo(
    () =>
      selectDisplayedMap(
        useLocalPreviewCalculations,
        localWallScopeEffectiveTotalById,
        wallScopeEffectiveTotalById
      ),
    [localWallScopeEffectiveTotalById, wallScopeEffectiveTotalById, useLocalPreviewCalculations]
  )
  const selectedWallSubtotal = useMemo(
    () => sumIncludedValues(selectedRoomScopes, displayedWallScopeEffectiveTotalById),
    [displayedWallScopeEffectiveTotalById, selectedRoomScopes]
  )
  const totalEffectiveAreaSqFt = useMemo(
    () =>
      rooms.reduce(
        (sum, room) => sum + (displayedRoomEffectiveAreaByRoomId.get(room.roomId) ?? 0),
        0
      ),
    [rooms, displayedRoomEffectiveAreaByRoomId]
  )
  const selectedRoomEffectiveSqFt = useMemo(
    () => (selectedRoom ? displayedRoomEffectiveAreaByRoomId.get(selectedRoom.roomId) ?? null : null),
    [displayedRoomEffectiveAreaByRoomId, selectedRoom]
  )
  const selectedScopeEffectiveSqFt = useMemo(
    () => (firstScope ? displayedScopeEffectiveAreaById.get(firstScope.id) ?? null : null),
    [displayedScopeEffectiveAreaById, firstScope]
  )

  return {
    displayedSegmentEffectiveAreaById,
    displayedScopeEffectiveAreaById,
    displayedRoomEffectiveAreaByRoomId,
    wallScopeEffectiveTotalById: displayedWallScopeEffectiveTotalById,
    selectedWallSubtotal,
    totalEffectiveAreaSqFt,
    selectedRoomEffectiveSqFt,
    selectedScopeEffectiveSqFt,
  }
}
