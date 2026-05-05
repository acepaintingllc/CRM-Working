'use client'

import { useMemo } from 'react'
import {
  buildCeilingScopeEffectiveAreaById,
  buildCeilingScopeEffectiveTotalById,
  buildDoorScopeCountById,
  buildLocalCeilingScopeEffectiveAreaById,
  buildLocalCeilingScopePreviewMetricsById,
  buildLocalDoorScopeEffectiveUnitsById,
  buildLocalDrywallRepairEffectiveQuantityById,
  buildLocalRoomEffectiveAreaByRoomId,
  buildLocalScopeEffectiveAreaById,
  buildLocalSegmentEffectiveAreaById,
  buildLocalTrimScopeMetricById,
  buildTrimScopeMetricById,
  buildWallRoomEffectiveAreaByRoomId,
  buildWallScopeEffectiveAreaById,
  buildWallScopeEffectiveTotalById,
  buildWallSegmentEffectiveAreaById,
  sumIncludedValues,
} from '../_lib/estimateV2EditorDerived'
import { resolveRoomModeById } from '../_lib/estimateV2EditorNormalize'
import { calculateEstimateV2Preview } from '@/lib/estimator/v2PreviewCalculations'
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

function sumIncludedRowsById<T extends { id: string; include: 'Y' | 'N' }>(
  rows: T[],
  valueById: Map<string, number | null>
) {
  return sumRowsById(rows.filter((row) => row.include === 'Y'), valueById)
}

function sumIncludedTrimMeasurement<T extends { id: string; include: 'Y' | 'N' }>(
  rows: T[],
  valueById: Map<string, number | null>
) {
  let total = 0
  let hasValues = false
  for (const row of rows) {
    if (row.include !== 'Y') continue
    const value = valueById.get(row.id)
    if (value == null) continue
    hasValues = true
    total += value
  }
  return hasValues ? Math.round(total * 10000) / 10000 : null
}

function summarizeTrimUnits(
  rows: Array<{ id: string; include: 'Y' | 'N'; unitType: string }>,
  valueById: Map<string, number | null>
) {
  const byUnit = new Map<string, number>()
  let hasValues = false
  for (const row of rows) {
    if (row.include !== 'Y') continue
    const value = valueById.get(row.id)
    if (value == null) continue
    hasValues = true
    byUnit.set(row.unitType || 'Measure', (byUnit.get(row.unitType || 'Measure') ?? 0) + value)
  }

  return {
    total: hasValues
      ? Math.round(Array.from(byUnit.values()).reduce((sum, value) => sum + value, 0) * 10000) / 10000
      : null,
    unit:
      byUnit.size === 1
        ? Array.from(byUnit.keys())[0]
        : byUnit.size > 1
          ? 'mixed'
          : null,
    byUnit,
  }
}

function hasNonNegativeNumber(value: unknown) {
  if (value == null || value === '') return false
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0
}

function buildOverrideDrivenTotalById(params: {
  rows: Array<Record<string, unknown>>
  calculatedTotalById: Map<string, number | null>
  overrideKeys: string[]
}) {
  const next = new Map<string, number | null>()
  for (const row of params.rows) {
    const id = typeof row.id === 'string' ? row.id : ''
    if (!id) continue
    const hasTotalDrivingOverride = params.overrideKeys.some((key) => hasNonNegativeNumber(row[key]))
    next.set(id, hasTotalDrivingOverride ? params.calculatedTotalById.get(id) ?? null : null)
  }
  return next
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
    | 'estimate'
    | 'lastSavedSnapshot'
    | 'wallCalculations'
    | 'ceilingCalculations'
    | 'trimCalculations'
    | 'doorCalculations'
    | 'drywallCalculations'
    | 'jobSettingsDraft'
    | 'catalogs'
  >
  selectedRoom: EstimateV2RoomDraft | null
  firstScope: { id: string } | null
  selectedRoomScopes: Array<{ id: string; include: 'Y' | 'N' }>
  selectedRoomCeilingScopes: Array<{ id: string; include: 'Y' | 'N' }>
  selectedRoomTrimScopes: Array<{ id: string; include: 'Y' | 'N' }>
  selectedRoomDoorScopes: Array<{ id: string; include: 'Y' | 'N' }>
  selectedRoomWallDrywallRepairs: EstimateV2DrywallRepairDraft[]
  selectedRoomCeilingDrywallRepairs: EstimateV2DrywallRepairDraft[]
}) {
  const { collections, meta, selectedRoom, firstScope, selectedRoomScopes, selectedRoomCeilingScopes, selectedRoomTrimScopes, selectedRoomDoorScopes, selectedRoomWallDrywallRepairs, selectedRoomCeilingDrywallRepairs } =
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
  const localCeilingScopeEffectiveAreaById = useMemo(
    () =>
      buildLocalCeilingScopeEffectiveAreaById({
        ceilingScopes: collections.ceilingScopes,
        ceilingSegments: collections.ceilingSegments,
        rooms: collections.rooms,
        ceilingTypes: meta.catalogs.ceiling_types,
      }),
    [collections.ceilingScopes, collections.ceilingSegments, collections.rooms, meta.catalogs.ceiling_types]
  )
  const localCeilingScopePreviewMetricsById = useMemo(
    () =>
      buildLocalCeilingScopePreviewMetricsById({
        ceilingScopes: collections.ceilingScopes,
        ceilingSegments: collections.ceilingSegments,
        rooms: collections.rooms,
        ceilingTypes: meta.catalogs.ceiling_types,
      }),
    [collections.ceilingScopes, collections.ceilingSegments, collections.rooms, meta.catalogs.ceiling_types]
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
  const dirty =
    !meta.loading &&
    meta.estimate != null &&
    !areEstimateV2DirtySnapshotsEqual(currentSnapshot, meta.lastSavedSnapshot)
  const currentPayload = currentSnapshot.payload
  const hasServerCalculations = (meta.wallCalculations?.room_totals?.length ?? 0) > 0
  const useLocalPreviewCalculations = dirty || !hasServerCalculations
  const localPreviewCalculations = useMemo(
    () =>
      calculateEstimateV2Preview({
        payload: currentPayload,
        catalogs: meta.catalogs,
      }),
    [currentPayload, meta.catalogs]
  )
  const localWallScopeEffectiveTotalById = useMemo(
    () =>
      buildOverrideDrivenTotalById({
        rows: currentPayload.room_wall_scopes,
        calculatedTotalById: buildWallScopeEffectiveTotalById(localPreviewCalculations.walls),
        overrideKeys: [
          'override_paint_hours',
          'override_primer_hours',
          'override_paint_gallons',
          'override_primer_gallons',
          'override_supply_cost',
          'override_total',
        ],
      }),
    [currentPayload.room_wall_scopes, localPreviewCalculations.walls]
  )
  const localCeilingScopeEffectiveTotalById = useMemo(
    () =>
      buildOverrideDrivenTotalById({
        rows: currentPayload.room_ceiling_scopes,
        calculatedTotalById: buildCeilingScopeEffectiveTotalById(localPreviewCalculations.ceilings),
        overrideKeys: [
          'override_paint_hours',
          'override_primer_hours',
          'override_paint_gallons',
          'override_primer_gallons',
          'override_supply_cost',
          'override_total',
        ],
      }),
    [currentPayload.room_ceiling_scopes, localPreviewCalculations.ceilings]
  )
  const localRoomModeById = useMemo(
    () =>
      resolveRoomModeById({
        rooms: collections.rooms,
        wallScopes: collections.scopes,
        ceilingScopes: collections.ceilingScopes,
      }),
    [collections.ceilingScopes, collections.rooms, collections.scopes]
  )
  const localTrimScopeEffectiveMeasurementById = useMemo(
    () =>
      buildLocalTrimScopeMetricById({
        trimScopes: collections.trimScopes,
        rooms: collections.rooms,
        roomModeById: localRoomModeById,
        key: 'effective_measurement',
      }),
    [collections.rooms, collections.trimScopes, localRoomModeById]
  )
  const localTrimScopeEffectiveTotalById = useMemo(
    () =>
      buildOverrideDrivenTotalById({
        rows: currentPayload.room_trim_scopes,
        calculatedTotalById: buildTrimScopeMetricById(localPreviewCalculations.trim, 'effective_total'),
        overrideKeys: ['override_hours', 'override_gallons', 'override_supply_cost', 'override_total'],
      }),
    [currentPayload.room_trim_scopes, localPreviewCalculations.trim]
  )
  const localDoorScopeEffectiveUnitsById = useMemo(
    () => buildLocalDoorScopeEffectiveUnitsById(collections.doorScopes),
    [collections.doorScopes]
  )
  const localDoorScopeEffectiveTotalById = useMemo(
    () =>
      buildOverrideDrivenTotalById({
        rows: currentPayload.room_door_scopes ?? [],
        calculatedTotalById: buildTrimScopeMetricById(localPreviewCalculations.doors, 'effective_total'),
        overrideKeys: [
          'override_paint_hours',
          'override_primer_hours',
          'override_material_cost',
          'override_supply_cost',
          'override_total',
        ],
      }),
    [currentPayload.room_door_scopes, localPreviewCalculations.doors]
  )
  const doorScopeCountById = useMemo(
    () => buildDoorScopeCountById(collections.doorScopes),
    [collections.doorScopes]
  )
  const localDrywallRepairEffectiveQuantityById = useMemo(
    () => buildLocalDrywallRepairEffectiveQuantityById(collections.drywallRepairs),
    [collections.drywallRepairs]
  )
  const localDrywallRepairEffectiveTotalById = useMemo(
    () =>
      buildOverrideDrivenTotalById({
        rows: currentPayload.drywall_repairs ?? [],
        calculatedTotalById: buildTrimScopeMetricById(localPreviewCalculations.drywall, 'effective_total'),
        overrideKeys: ['override_total'],
      }),
    [currentPayload.drywall_repairs, localPreviewCalculations.drywall]
  )
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
  const displayedWallScopeEffectiveTotalById = useMemo(
    () => (useLocalPreviewCalculations ? localWallScopeEffectiveTotalById : wallScopeEffectiveTotalById),
    [localWallScopeEffectiveTotalById, wallScopeEffectiveTotalById, useLocalPreviewCalculations]
  )
  const displayedCeilingScopeEffectiveAreaById = useMemo(
    () => (useLocalPreviewCalculations ? localCeilingScopeEffectiveAreaById : ceilingScopeEffectiveAreaById),
    [ceilingScopeEffectiveAreaById, localCeilingScopeEffectiveAreaById, useLocalPreviewCalculations]
  )
  const displayedCeilingScopeEffectiveTotalById = useMemo(
    () => (useLocalPreviewCalculations ? localCeilingScopeEffectiveTotalById : ceilingScopeEffectiveTotalById),
    [ceilingScopeEffectiveTotalById, localCeilingScopeEffectiveTotalById, useLocalPreviewCalculations]
  )
  const displayedTrimScopeEffectiveMeasurementById = useMemo(
    () =>
      useLocalPreviewCalculations
        ? localTrimScopeEffectiveMeasurementById
        : trimScopeEffectiveMeasurementById,
    [
      localTrimScopeEffectiveMeasurementById,
      trimScopeEffectiveMeasurementById,
      useLocalPreviewCalculations,
    ]
  )
  const displayedTrimScopeEffectiveTotalById = useMemo(
    () =>
      useLocalPreviewCalculations
        ? localTrimScopeEffectiveTotalById
        : trimScopeEffectiveTotalById,
    [localTrimScopeEffectiveTotalById, trimScopeEffectiveTotalById, useLocalPreviewCalculations]
  )
  const displayedDoorScopeEffectiveUnitsById = useMemo(
    () =>
      useLocalPreviewCalculations
        ? localDoorScopeEffectiveUnitsById
        : doorScopeEffectiveUnitsById,
    [doorScopeEffectiveUnitsById, localDoorScopeEffectiveUnitsById, useLocalPreviewCalculations]
  )
  const displayedDoorScopeEffectiveTotalById = useMemo(
    () =>
      useLocalPreviewCalculations
        ? localDoorScopeEffectiveTotalById
        : doorScopeEffectiveTotalById,
    [doorScopeEffectiveTotalById, localDoorScopeEffectiveTotalById, useLocalPreviewCalculations]
  )
  const displayedDrywallRepairEffectiveQuantityById = useMemo(
    () =>
      useLocalPreviewCalculations
        ? localDrywallRepairEffectiveQuantityById
        : drywallRepairEffectiveQuantityById,
    [
      drywallRepairEffectiveQuantityById,
      localDrywallRepairEffectiveQuantityById,
      useLocalPreviewCalculations,
    ]
  )
  const displayedDrywallRepairEffectiveTotalById = useMemo(
    () =>
      useLocalPreviewCalculations
        ? localDrywallRepairEffectiveTotalById
        : drywallRepairEffectiveTotalById,
    [
      drywallRepairEffectiveTotalById,
      localDrywallRepairEffectiveTotalById,
      useLocalPreviewCalculations,
    ]
  )
  const selectedCeilingEffectiveSqFt = useMemo(
    () => sumIncludedValues(selectedRoomCeilingScopes, displayedCeilingScopeEffectiveAreaById),
    [displayedCeilingScopeEffectiveAreaById, selectedRoomCeilingScopes]
  )
  const selectedWallSubtotal = useMemo(
    () => sumIncludedValues(selectedRoomScopes, displayedWallScopeEffectiveTotalById),
    [displayedWallScopeEffectiveTotalById, selectedRoomScopes]
  )
  const selectedCeilingSubtotal = useMemo(
    () => sumIncludedValues(selectedRoomCeilingScopes, displayedCeilingScopeEffectiveTotalById),
    [displayedCeilingScopeEffectiveTotalById, selectedRoomCeilingScopes]
  )
  const selectedTrimSubtotal = useMemo(
    () => sumIncludedValues(selectedRoomTrimScopes, displayedTrimScopeEffectiveTotalById),
    [selectedRoomTrimScopes, displayedTrimScopeEffectiveTotalById]
  )
  const selectedTrimMeasurement = useMemo(
    () => sumIncludedTrimMeasurement(selectedRoomTrimScopes, displayedTrimScopeEffectiveMeasurementById),
    [selectedRoomTrimScopes, displayedTrimScopeEffectiveMeasurementById]
  )
  const selectedDoorSubtotal = useMemo(
    () => sumIncludedValues(selectedRoomDoorScopes, displayedDoorScopeEffectiveTotalById),
    [displayedDoorScopeEffectiveTotalById, selectedRoomDoorScopes]
  )
  const selectedDoorUnits = useMemo(
    () => sumIncludedValues(selectedRoomDoorScopes, displayedDoorScopeEffectiveUnitsById),
    [displayedDoorScopeEffectiveUnitsById, selectedRoomDoorScopes]
  )
  const selectedWallDrywallSubtotal = useMemo(
    () => sumRowsById(selectedRoomWallDrywallRepairs, displayedDrywallRepairEffectiveTotalById),
    [displayedDrywallRepairEffectiveTotalById, selectedRoomWallDrywallRepairs]
  )
  const selectedCeilingDrywallSubtotal = useMemo(
    () => sumRowsById(selectedRoomCeilingDrywallRepairs, displayedDrywallRepairEffectiveTotalById),
    [displayedDrywallRepairEffectiveTotalById, selectedRoomCeilingDrywallRepairs]
  )
  const totalEffectiveAreaSqFt = useMemo(
    () =>
      collections.rooms.reduce(
        (sum, room) => sum + (displayedRoomEffectiveAreaByRoomId.get(room.roomId) ?? 0),
        0
      ),
    [collections.rooms, displayedRoomEffectiveAreaByRoomId]
  )
  const activeScopeTotals = useMemo(
    () => {
      const wallsSqFt = sumIncludedRowsById(collections.scopes, displayedScopeEffectiveAreaById) ?? 0
      const ceilingsSqFt =
        sumIncludedRowsById(collections.ceilingScopes, displayedCeilingScopeEffectiveAreaById) ?? 0
      const trim = summarizeTrimUnits(collections.trimScopes, displayedTrimScopeEffectiveMeasurementById)
      const doorSides =
        sumIncludedRowsById(collections.doorScopes, displayedDoorScopeEffectiveUnitsById) ?? 0
      const doorCount = sumIncludedRowsById(collections.doorScopes, doorScopeCountById) ?? 0
      const doorsActive = collections.doorScopes.some((scope) => scope.include === 'Y')

      return {
        wallsSqFt,
        ceilingsSqFt,
        trimMeasurement: trim.total ?? 0,
        trimUnit: trim.unit,
        trimMeasurementByUnit: trim.byUnit,
        doorSides,
        doorCount,
        doorsActive,
      }
    },
    [
      collections.ceilingScopes,
      collections.doorScopes,
      collections.scopes,
      collections.trimScopes,
      displayedCeilingScopeEffectiveAreaById,
      displayedDoorScopeEffectiveUnitsById,
      displayedScopeEffectiveAreaById,
      displayedTrimScopeEffectiveMeasurementById,
      doorScopeCountById,
    ]
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
    wallScopeEffectiveTotalById: displayedWallScopeEffectiveTotalById,
    selectedCeilingEffectiveSqFt,
    ceilingScopePreviewMetricsById: localCeilingScopePreviewMetricsById,
    ceilingScopeEffectiveTotalById: displayedCeilingScopeEffectiveTotalById,
    trimScopeEffectiveMeasurementById: displayedTrimScopeEffectiveMeasurementById,
    trimScopeEffectiveTotalById: displayedTrimScopeEffectiveTotalById,
    doorScopeEffectiveUnitsById: displayedDoorScopeEffectiveUnitsById,
    doorScopeEffectiveTotalById: displayedDoorScopeEffectiveTotalById,
    drywallRepairEffectiveQuantityById: displayedDrywallRepairEffectiveQuantityById,
    drywallRepairEffectiveTotalById: displayedDrywallRepairEffectiveTotalById,
    selectedWallSubtotal,
    selectedCeilingSubtotal,
    selectedTrimSubtotal,
    selectedTrimMeasurement,
    selectedDoorSubtotal,
    selectedDoorUnits,
    selectedWallDrywallSubtotal,
    selectedCeilingDrywallSubtotal,
    totalEffectiveAreaSqFt,
    activeScopeTotals,
    selectedRoomEffectiveSqFt,
    selectedScopeEffectiveSqFt,
    calculationsStale,
  }
}
