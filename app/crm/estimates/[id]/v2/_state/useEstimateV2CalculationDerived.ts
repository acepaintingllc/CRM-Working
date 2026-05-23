'use client'

import { useMemo } from 'react'
import {
  useEstimateV2CalculationContext,
  type EstimateV2CalculationContextCollections,
  type EstimateV2CalculationContextMeta,
} from './useEstimateV2CalculationContext'
import { useEstimateV2CeilingCalculationDerived } from './useEstimateV2CeilingCalculationDerived'
import { useEstimateV2DoorCalculationDerived } from './useEstimateV2DoorCalculationDerived'
import { useEstimateV2DrywallCalculationDerived } from './useEstimateV2DrywallCalculationDerived'
import { useEstimateV2TrimCalculationDerived } from './useEstimateV2TrimCalculationDerived'
import { useEstimateV2WallCalculationDerived } from './useEstimateV2WallCalculationDerived'
import type { EstimateV2EditorMetaState } from './estimateV2EditorTypes'
import type { EstimateV2RoomDraft } from '@/types/estimator/v2Rooms'
import type { EstimateV2DrywallRepairDraft } from '@/types/estimator/v2Scopes'

function sumIncludedRowsById<T extends { id: string; include: 'Y' | 'N' }>(
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
  return hasValues ? Math.round(total * 100) / 100 : null
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

function buildActiveScopeTotals(params: {
  wallScopes: Array<{ id: string; include: 'Y' | 'N' }>
  ceilingScopes: Array<{ id: string; include: 'Y' | 'N' }>
  trimScopes: Array<{ id: string; include: 'Y' | 'N'; unitType: string }>
  doorScopes: Array<{ id: string; include: 'Y' | 'N' }>
  wallEffectiveAreaById: Map<string, number | null>
  ceilingEffectiveAreaById: Map<string, number | null>
  trimEffectiveMeasurementById: Map<string, number | null>
  doorEffectiveUnitsById: Map<string, number | null>
  doorCountById: Map<string, number | null>
}) {
  const {
    wallScopes,
    ceilingScopes,
    trimScopes,
    doorScopes,
    wallEffectiveAreaById,
    ceilingEffectiveAreaById,
    trimEffectiveMeasurementById,
    doorEffectiveUnitsById,
    doorCountById,
  } = params
  const wallsSqFt = sumIncludedRowsById(wallScopes, wallEffectiveAreaById) ?? 0
  const ceilingsSqFt = sumIncludedRowsById(ceilingScopes, ceilingEffectiveAreaById) ?? 0
  const trim = summarizeTrimUnits(trimScopes, trimEffectiveMeasurementById)
  const doorSides = sumIncludedRowsById(doorScopes, doorEffectiveUnitsById) ?? 0
  const doorCount = sumIncludedRowsById(doorScopes, doorCountById) ?? 0
  const doorsActive = doorScopes.some((scope) => scope.include === 'Y')

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
}

export function useEstimateV2CalculationDerived(params: {
  collections: EstimateV2CalculationContextCollections
  meta: EstimateV2CalculationContextMeta & {
    ceilingCalculations: EstimateV2EditorMetaState['ceilingCalculations']
    trimCalculations: EstimateV2EditorMetaState['trimCalculations']
    doorCalculations: EstimateV2EditorMetaState['doorCalculations']
    drywallCalculations: EstimateV2EditorMetaState['drywallCalculations']
  }
  selectedRoom: EstimateV2RoomDraft | null
  firstScope: { id: string } | null
  selectedRoomScopes: Array<{ id: string; include: 'Y' | 'N' }>
  selectedRoomCeilingScopes: Array<{ id: string; include: 'Y' | 'N' }>
  selectedRoomTrimScopes: Array<{ id: string; include: 'Y' | 'N' }>
  selectedRoomDoorScopes: Array<{ id: string; include: 'Y' | 'N' }>
  selectedRoomWallDrywallRepairs: EstimateV2DrywallRepairDraft[]
  selectedRoomCeilingDrywallRepairs: EstimateV2DrywallRepairDraft[]
}) {
  const {
    collections,
    meta,
    selectedRoom,
    firstScope,
    selectedRoomScopes,
    selectedRoomCeilingScopes,
    selectedRoomTrimScopes,
    selectedRoomDoorScopes,
    selectedRoomWallDrywallRepairs,
    selectedRoomCeilingDrywallRepairs,
  } = params

  const calculationContext = useEstimateV2CalculationContext({ collections, meta })
  const wallCalculation = useEstimateV2WallCalculationDerived({
    rooms: collections.rooms,
    scopes: collections.scopes,
    segments: collections.segments,
    wallCalculations: meta.wallCalculations,
    currentWallScopes: calculationContext.currentPayload.room_wall_scopes,
    localWallCalculations: calculationContext.localPreviewCalculations.walls,
    selectedRoom,
    firstScope,
    selectedRoomScopes,
    useLocalPreviewCalculations: calculationContext.useLocalPreviewCalculations,
  })
  const ceilingCalculation = useEstimateV2CeilingCalculationDerived({
    ceilingScopes: collections.ceilingScopes,
    ceilingSegments: collections.ceilingSegments,
    rooms: collections.rooms,
    ceilingCalculations: meta.ceilingCalculations,
    ceilingTypes: meta.catalogs.ceiling_types,
    currentCeilingScopes: calculationContext.currentPayload.room_ceiling_scopes,
    localCeilingCalculations: calculationContext.localPreviewCalculations.ceilings,
    selectedRoomCeilingScopes,
    useLocalPreviewCalculations: calculationContext.useLocalPreviewCalculations,
  })
  const trimCalculation = useEstimateV2TrimCalculationDerived({
    trimScopes: collections.trimScopes,
    rooms: collections.rooms,
    wallScopes: collections.scopes,
    ceilingScopes: collections.ceilingScopes,
    trimCalculations: meta.trimCalculations,
    currentTrimScopes: calculationContext.currentPayload.room_trim_scopes,
    localTrimCalculations: calculationContext.localPreviewCalculations.trim,
    selectedRoomTrimScopes,
    useLocalPreviewCalculations: calculationContext.useLocalPreviewCalculations,
  })
  const doorCalculation = useEstimateV2DoorCalculationDerived({
    doorScopes: collections.doorScopes,
    doorCalculations: meta.doorCalculations,
    currentDoorScopes: calculationContext.currentPayload.room_door_scopes,
    localDoorCalculations: calculationContext.localPreviewCalculations.doors,
    selectedRoomDoorScopes,
    useLocalPreviewCalculations: calculationContext.useLocalPreviewCalculations,
  })
  const drywallCalculation = useEstimateV2DrywallCalculationDerived({
    drywallRepairs: collections.drywallRepairs,
    drywallCalculations: meta.drywallCalculations,
    currentDrywallRepairs: calculationContext.currentPayload.drywall_repairs,
    localDrywallCalculations: calculationContext.localPreviewCalculations.drywall,
    selectedRoomWallDrywallRepairs,
    selectedRoomCeilingDrywallRepairs,
    useLocalPreviewCalculations: calculationContext.useLocalPreviewCalculations,
  })
  const activeScopeTotals = useMemo(
    () =>
      buildActiveScopeTotals({
        wallScopes: collections.scopes,
        ceilingScopes: collections.ceilingScopes,
        trimScopes: collections.trimScopes,
        doorScopes: collections.doorScopes,
        wallEffectiveAreaById: wallCalculation.displayedScopeEffectiveAreaById,
        ceilingEffectiveAreaById: ceilingCalculation.displayedCeilingScopeEffectiveAreaById,
        trimEffectiveMeasurementById: trimCalculation.trimScopeEffectiveMeasurementById,
        doorEffectiveUnitsById: doorCalculation.displayedDoorScopeEffectiveUnitsById,
        doorCountById: doorCalculation.doorScopeCountById,
      }),
    [
      collections.ceilingScopes,
      collections.doorScopes,
      collections.scopes,
      collections.trimScopes,
      ceilingCalculation.displayedCeilingScopeEffectiveAreaById,
      doorCalculation.displayedDoorScopeEffectiveUnitsById,
      trimCalculation.trimScopeEffectiveMeasurementById,
      doorCalculation.doorScopeCountById,
      wallCalculation.displayedScopeEffectiveAreaById,
    ]
  )

  return {
    currentPayload: calculationContext.currentPayload,
    currentSnapshot: calculationContext.currentSnapshot,
    dirty: calculationContext.dirty,
    hasServerCalculations: calculationContext.hasServerCalculations,
    useLocalPreviewCalculations: calculationContext.useLocalPreviewCalculations,
    displayedSegmentEffectiveAreaById: wallCalculation.displayedSegmentEffectiveAreaById,
    displayedScopeEffectiveAreaById: wallCalculation.displayedScopeEffectiveAreaById,
    displayedRoomEffectiveAreaByRoomId: wallCalculation.displayedRoomEffectiveAreaByRoomId,
    wallScopeEffectiveTotalById: wallCalculation.wallScopeEffectiveTotalById,
    selectedCeilingEffectiveSqFt: ceilingCalculation.selectedCeilingEffectiveSqFt,
    ceilingScopePreviewMetricsById: ceilingCalculation.ceilingScopePreviewMetricsById,
    ceilingScopeEffectiveTotalById: ceilingCalculation.ceilingScopeEffectiveTotalById,
    trimScopeEffectiveMeasurementById: trimCalculation.trimScopeEffectiveMeasurementById,
    trimScopeEffectiveTotalById: trimCalculation.trimScopeEffectiveTotalById,
    doorScopeEffectiveUnitsById: doorCalculation.displayedDoorScopeEffectiveUnitsById,
    doorScopeEffectiveTotalById: doorCalculation.displayedDoorScopeEffectiveTotalById,
    drywallRepairEffectiveQuantityById: drywallCalculation.displayedDrywallRepairEffectiveQuantityById,
    drywallRepairEffectiveTotalById: drywallCalculation.displayedDrywallRepairEffectiveTotalById,
    selectedWallSubtotal: wallCalculation.selectedWallSubtotal,
    selectedCeilingSubtotal: ceilingCalculation.selectedCeilingSubtotal,
    selectedTrimSubtotal: trimCalculation.selectedTrimSubtotal,
    selectedTrimMeasurement: trimCalculation.selectedTrimMeasurement,
    selectedDoorSubtotal: doorCalculation.selectedDoorSubtotal,
    selectedDoorUnits: doorCalculation.selectedDoorUnits,
    selectedWallDrywallSubtotal: drywallCalculation.selectedWallDrywallSubtotal,
    selectedCeilingDrywallSubtotal: drywallCalculation.selectedCeilingDrywallSubtotal,
    totalEffectiveAreaSqFt: wallCalculation.totalEffectiveAreaSqFt,
    activeScopeTotals,
    selectedRoomEffectiveSqFt: wallCalculation.selectedRoomEffectiveSqFt,
    selectedScopeEffectiveSqFt: wallCalculation.selectedScopeEffectiveSqFt,
    calculationsStale: calculationContext.calculationsStale,
  }
}
