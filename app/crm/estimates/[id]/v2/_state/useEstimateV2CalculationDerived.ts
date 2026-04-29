'use client'

import { useMemo } from 'react'
import {
  buildCeilingScopeEffectiveAreaById,
  buildCeilingScopeEffectiveTotalById,
  buildLocalRoomEffectiveAreaByRoomId,
  buildLocalScopeEffectiveAreaById,
  buildLocalSegmentEffectiveAreaById,
  buildTrimScopeMetricById,
  buildWallRoomEffectiveAreaByRoomId,
  buildWallScopeEffectiveAreaById,
  buildWallScopeEffectiveTotalById,
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
import type { EstimateV2DrywallRepairDraft, EstimateV2RoomDraft } from '@/types/estimator/v2'

function sumRowsById<T extends { id: string }>(rows: T[], valueById: Map<string, number | null>) {
  let total = 0
  let hasValues = false
  for (const row of rows) {
    const value = valueById.get(row.id)
    if (value == null) continue
    hasValues = true
    total += value
  }
  return hasValues ? Math.round(total * 100) / 100 : null
}

export function useEstimateV2CalculationDerived(params: {
  collections: Pick<
    EstimateV2EditorCollections,
    | 'rooms'
    | 'scopes'
    | 'segments'
    | 'roomFlags'
    | 'rollers'
    | 'ceilingScopes'
    | 'ceilingSegments'
    | 'trimScopes'
    | 'doorScopes'
    | 'drywallRepairs'
    | 'rollers'
    | 'accessFees'
    | 'otherItems'
  >
  meta: Pick<
    EstimateV2EditorMetaState,
    | 'loading'
    | 'lastSavedSnapshot'
    | 'wallCalculations'
    | 'ceilingCalculations'
    | 'trimCalculations'
    | 'doorCalculations'
    | 'drywallCalculations'
    | 'jobSettingsDraft'
  >
  selectedRoom: EstimateV2RoomDraft | null
  firstScope: { id: string } | null
  selectedRoomCeilingScopes: Array<{ id: string; include: 'Y' | 'N' }>
  selectedRoomTrimScopes: Array<{ id: string; include: 'Y' | 'N' }>
  selectedRoomDoorScopes: Array<{ id: string; include: 'Y' | 'N' }>
  selectedRoomWallDrywallRepairs: EstimateV2DrywallRepairDraft[]
  selectedRoomCeilingDrywallRepairs: EstimateV2DrywallRepairDraft[]
}) {
  const { collections, meta, selectedRoom, firstScope, selectedRoomCeilingScopes, selectedRoomTrimScopes, selectedRoomDoorScopes, selectedRoomWallDrywallRepairs, selectedRoomCeilingDrywallRepairs } =
    params

  const ceilingScopeEffectiveAreaById = useMemo(
    () => buildCeilingScopeEffectiveAreaById(meta.ceilingCalculations),
    [meta.ceilingCalculations]
  )
  const ceilingScopeEffectiveTotalById = useMemo(
    () => buildCeilingScopeEffectiveTotalById(meta.ceilingCalculations),
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
  const doorScopeEffectiveUnitsById = useMemo(
    () => buildTrimScopeMetricById(meta.doorCalculations, 'effective_units'),
    [meta.doorCalculations]
  )
  const doorScopeEffectiveTotalById = useMemo(
    () => buildTrimScopeMetricById(meta.doorCalculations, 'effective_total'),
    [meta.doorCalculations]
  )
  const drywallRepairEffectiveQuantityById = useMemo(
    () => buildTrimScopeMetricById(meta.drywallCalculations, 'effective_quantity'),
    [meta.drywallCalculations]
  )
  const drywallRepairEffectiveTotalById = useMemo(
    () => buildTrimScopeMetricById(meta.drywallCalculations, 'effective_total'),
    [meta.drywallCalculations]
  )
  const scopeEffectiveAreaById = useMemo(
    () => buildWallScopeEffectiveAreaById(meta.wallCalculations),
    [meta.wallCalculations]
  )
  const wallScopeEffectiveTotalById = useMemo(
    () => buildWallScopeEffectiveTotalById(meta.wallCalculations),
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
        jobSettingsDraft: meta.jobSettingsDraft,
        scopes: collections.scopes,
        segments: collections.segments,
        roomFlags: collections.roomFlags,
        ceilingScopes: collections.ceilingScopes,
        ceilingSegments: collections.ceilingSegments,
        trimScopes: collections.trimScopes,
        doorScopes: collections.doorScopes,
        drywallRepairs: collections.drywallRepairs,
        rollers: collections.rollers,
        accessFees: collections.accessFees,
        otherItems: collections.otherItems,
      }),
    [
      collections.ceilingScopes,
      collections.ceilingSegments,
      collections.doorScopes,
      collections.drywallRepairs,
      collections.roomFlags,
      collections.rooms,
      collections.rollers,
      collections.accessFees,
      collections.otherItems,
      collections.scopes,
      collections.segments,
      collections.trimScopes,
      meta.jobSettingsDraft,
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
  const selectedDoorSubtotal = useMemo(
    () => sumIncludedValues(selectedRoomDoorScopes, doorScopeEffectiveTotalById),
    [doorScopeEffectiveTotalById, selectedRoomDoorScopes]
  )
  const selectedDoorUnits = useMemo(
    () => sumIncludedValues(selectedRoomDoorScopes, doorScopeEffectiveUnitsById),
    [doorScopeEffectiveUnitsById, selectedRoomDoorScopes]
  )
  const selectedWallDrywallSubtotal = useMemo(
    () => sumRowsById(selectedRoomWallDrywallRepairs, drywallRepairEffectiveTotalById),
    [drywallRepairEffectiveTotalById, selectedRoomWallDrywallRepairs]
  )
  const selectedCeilingDrywallSubtotal = useMemo(
    () => sumRowsById(selectedRoomCeilingDrywallRepairs, drywallRepairEffectiveTotalById),
    [drywallRepairEffectiveTotalById, selectedRoomCeilingDrywallRepairs]
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
    wallScopeEffectiveTotalById,
    selectedCeilingEffectiveSqFt,
    ceilingScopeEffectiveTotalById,
    trimScopeEffectiveMeasurementById,
    trimScopeEffectiveTotalById,
    doorScopeEffectiveUnitsById,
    doorScopeEffectiveTotalById,
    drywallRepairEffectiveQuantityById,
    drywallRepairEffectiveTotalById,
    selectedTrimSubtotal,
    selectedTrimMeasurement,
    selectedDoorSubtotal,
    selectedDoorUnits,
    selectedWallDrywallSubtotal,
    selectedCeilingDrywallSubtotal,
    totalEffectiveAreaSqFt,
    selectedRoomEffectiveSqFt,
    selectedScopeEffectiveSqFt,
    calculationsStale,
  }
}
