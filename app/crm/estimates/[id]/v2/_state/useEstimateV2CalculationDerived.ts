'use client'

import { useMemo } from 'react'
import {
  buildCeilingScopeEffectiveAreaById,
  buildLocalRoomEffectiveAreaByRoomId,
  buildLocalScopeEffectiveAreaById,
  buildLocalSegmentEffectiveAreaById,
  buildTrimScopeMetricById,
  buildWallRoomEffectiveAreaByRoomId,
  buildWallScopeEffectiveAreaById,
  buildWallSegmentEffectiveAreaById,
  sumIncludedValues,
} from '../_lib/estimateV2EditorDerived'
import {
  areEstimateV2DirtySnapshotsEqual,
  buildEstimateV2DirtySnapshot,
} from './estimateV2DirtySnapshot'
import type {
  EstimateV2EditorCollections,
  EstimateV2EditorMetaState,
} from './estimateV2EditorTypes'
import type { EstimateV2RoomDraft } from '@/types/estimator/v2'

export function useEstimateV2CalculationDerived(params: {
  collections: Pick<
    EstimateV2EditorCollections,
    | 'rooms'
    | 'scopes'
    | 'segments'
    | 'roomFlags'
    | 'ceilingScopes'
    | 'ceilingSegments'
    | 'trimScopes'
  >
  meta: Pick<
    EstimateV2EditorMetaState,
    | 'loading'
    | 'lastSavedSnapshot'
    | 'wallCalculations'
    | 'ceilingCalculations'
    | 'trimCalculations'
  >
  selectedRoom: EstimateV2RoomDraft | null
  firstScope: { id: string } | null
  selectedRoomCeilingScopes: Array<{ id: string; include: 'Y' | 'N' }>
  selectedRoomTrimScopes: Array<{ id: string; include: 'Y' | 'N' }>
}) {
  const { collections, meta, selectedRoom, firstScope, selectedRoomCeilingScopes, selectedRoomTrimScopes } =
    params

  const ceilingScopeEffectiveAreaById = useMemo(
    () => buildCeilingScopeEffectiveAreaById(meta.ceilingCalculations),
    [meta.ceilingCalculations]
  )
  const trimScopeEffectiveMeasurementById = useMemo(
    () => buildTrimScopeMetricById(meta.trimCalculations, 'effective_measurement'),
    [meta.trimCalculations]
  )
  const trimScopeEffectiveTotalById = useMemo(
    () => buildTrimScopeMetricById(meta.trimCalculations, 'effective_total'),
    [meta.trimCalculations]
  )
  const scopeEffectiveAreaById = useMemo(
    () => buildWallScopeEffectiveAreaById(meta.wallCalculations),
    [meta.wallCalculations]
  )
  const segmentEffectiveAreaById = useMemo(
    () => buildWallSegmentEffectiveAreaById(meta.wallCalculations),
    [meta.wallCalculations]
  )
  const roomEffectiveAreaByRoomId = useMemo(
    () => buildWallRoomEffectiveAreaByRoomId(meta.wallCalculations),
    [meta.wallCalculations]
  )
  const localSegmentEffectiveAreaById = useMemo(
    () => buildLocalSegmentEffectiveAreaById(collections.segments),
    [collections.segments]
  )
  const localScopeEffectiveAreaById = useMemo(
    () => buildLocalScopeEffectiveAreaById(collections.scopes, collections.segments),
    [collections.scopes, collections.segments]
  )
  const localRoomEffectiveAreaByRoomId = useMemo(
    () =>
      buildLocalRoomEffectiveAreaByRoomId(
        collections.rooms,
        collections.scopes,
        localScopeEffectiveAreaById
      ),
    [collections.rooms, collections.scopes, localScopeEffectiveAreaById]
  )
  const currentSnapshot = useMemo(
    () =>
      buildEstimateV2DirtySnapshot({
        rooms: collections.rooms,
        scopes: collections.scopes,
        segments: collections.segments,
        roomFlags: collections.roomFlags,
        ceilingScopes: collections.ceilingScopes,
        ceilingSegments: collections.ceilingSegments,
        trimScopes: collections.trimScopes,
      }),
    [
      collections.ceilingScopes,
      collections.ceilingSegments,
      collections.roomFlags,
      collections.rooms,
      collections.scopes,
      collections.segments,
      collections.trimScopes,
    ]
  )
  const dirty = !meta.loading && !areEstimateV2DirtySnapshotsEqual(currentSnapshot, meta.lastSavedSnapshot)
  const currentPayload = currentSnapshot.payload
  const hasServerCalculations = (meta.wallCalculations?.room_totals?.length ?? 0) > 0
  const useLocalPreviewCalculations = dirty || !hasServerCalculations
  const displayedSegmentEffectiveAreaById = useMemo(
    () => (useLocalPreviewCalculations ? localSegmentEffectiveAreaById : segmentEffectiveAreaById),
    [localSegmentEffectiveAreaById, segmentEffectiveAreaById, useLocalPreviewCalculations]
  )
  const displayedScopeEffectiveAreaById = useMemo(
    () => (useLocalPreviewCalculations ? localScopeEffectiveAreaById : scopeEffectiveAreaById),
    [localScopeEffectiveAreaById, scopeEffectiveAreaById, useLocalPreviewCalculations]
  )
  const displayedRoomEffectiveAreaByRoomId = useMemo(
    () => (useLocalPreviewCalculations ? localRoomEffectiveAreaByRoomId : roomEffectiveAreaByRoomId),
    [localRoomEffectiveAreaByRoomId, roomEffectiveAreaByRoomId, useLocalPreviewCalculations]
  )
  const selectedCeilingEffectiveSqFt = useMemo(
    () => sumIncludedValues(selectedRoomCeilingScopes, ceilingScopeEffectiveAreaById),
    [ceilingScopeEffectiveAreaById, selectedRoomCeilingScopes]
  )
  const selectedTrimSubtotal = useMemo(
    () => sumIncludedValues(selectedRoomTrimScopes, trimScopeEffectiveTotalById),
    [selectedRoomTrimScopes, trimScopeEffectiveTotalById]
  )
  const selectedTrimMeasurement = useMemo(
    () => sumIncludedValues(selectedRoomTrimScopes, trimScopeEffectiveMeasurementById),
    [selectedRoomTrimScopes, trimScopeEffectiveMeasurementById]
  )
  const totalEffectiveAreaSqFt = useMemo(
    () =>
      collections.rooms.reduce(
        (sum, room) => sum + (displayedRoomEffectiveAreaByRoomId.get(room.roomId) ?? 0),
        0
      ),
    [collections.rooms, displayedRoomEffectiveAreaByRoomId]
  )
  const selectedRoomEffectiveSqFt = useMemo(
    () =>
      selectedRoom ? displayedRoomEffectiveAreaByRoomId.get(selectedRoom.roomId) ?? null : null,
    [displayedRoomEffectiveAreaByRoomId, selectedRoom]
  )
  const selectedScopeEffectiveSqFt = useMemo(
    () => (firstScope ? displayedScopeEffectiveAreaById.get(firstScope.id) ?? null : null),
    [displayedScopeEffectiveAreaById, firstScope]
  )
  const calculationsStale = dirty

  return {
    currentPayload,
    currentSnapshot,
    dirty,
    hasServerCalculations,
    useLocalPreviewCalculations,
    displayedSegmentEffectiveAreaById,
    displayedScopeEffectiveAreaById,
    displayedRoomEffectiveAreaByRoomId,
    selectedCeilingEffectiveSqFt,
    trimScopeEffectiveMeasurementById,
    trimScopeEffectiveTotalById,
    selectedTrimSubtotal,
    selectedTrimMeasurement,
    totalEffectiveAreaSqFt,
    selectedRoomEffectiveSqFt,
    selectedScopeEffectiveSqFt,
    calculationsStale,
  }
}
