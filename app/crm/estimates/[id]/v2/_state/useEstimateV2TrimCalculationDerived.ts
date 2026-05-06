'use client'

import { useMemo } from 'react'
import {
  buildLocalTrimScopeMetricById,
  buildTrimScopeMetricById,
  sumIncludedValues,
} from '../_lib/estimateV2EditorDerived'
import { resolveRoomModeById } from '../_lib/estimateV2EditorNormalize'
import { buildOverrideDrivenTotalById } from './estimateV2OverrideDrivenTotals'
import { selectDisplayedMap } from './useEstimateV2CalculationContext'
import type { EstimateV2EditorMetaState } from './estimateV2EditorTypes'
import type { calculateEstimateV2Preview } from '@/lib/estimator/v2PreviewCalculations'
import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2RoomDraft,
  EstimateV2SavePayload,
  EstimateV2TrimScopeDraft,
  EstimateV2WallScopeDraft,
} from '@/types/estimator/v2'

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

export function useEstimateV2TrimCalculationDerived(params: {
  trimScopes: EstimateV2TrimScopeDraft[]
  rooms: EstimateV2RoomDraft[]
  wallScopes: EstimateV2WallScopeDraft[]
  ceilingScopes: EstimateV2CeilingScopeDraft[]
  trimCalculations: EstimateV2EditorMetaState['trimCalculations']
  currentTrimScopes: EstimateV2SavePayload['room_trim_scopes']
  localTrimCalculations: ReturnType<typeof calculateEstimateV2Preview>['trim']
  selectedRoomTrimScopes: Array<{ id: string; include: 'Y' | 'N' }>
  useLocalPreviewCalculations: boolean
}) {
  const {
    trimScopes,
    rooms,
    wallScopes,
    ceilingScopes,
    trimCalculations,
    currentTrimScopes,
    localTrimCalculations,
    selectedRoomTrimScopes,
    useLocalPreviewCalculations,
  } = params

  const serverTrimScopeEffectiveMeasurementById = useMemo(
    () => buildTrimScopeMetricById(trimCalculations, 'effective_measurement'),
    [trimCalculations]
  )
  const serverTrimScopeEffectiveTotalById = useMemo(
    () => buildTrimScopeMetricById(trimCalculations, 'effective_total'),
    [trimCalculations]
  )
  const localRoomModeById = useMemo(
    () =>
      resolveRoomModeById({
        rooms,
        wallScopes,
        ceilingScopes,
      }),
    [ceilingScopes, rooms, wallScopes]
  )
  const localTrimScopeEffectiveMeasurementById = useMemo(
    () =>
      buildLocalTrimScopeMetricById({
        trimScopes,
        rooms,
        roomModeById: localRoomModeById,
        key: 'effective_measurement',
      }),
    [rooms, trimScopes, localRoomModeById]
  )
  const localTrimScopeEffectiveTotalById = useMemo(
    () =>
      buildOverrideDrivenTotalById({
        rows: currentTrimScopes,
        calculatedTotalById: buildTrimScopeMetricById(localTrimCalculations, 'effective_total'),
        overrideKeys: ['override_hours', 'override_gallons', 'override_supply_cost', 'override_total'],
      }),
    [currentTrimScopes, localTrimCalculations]
  )
  const displayedTrimScopeEffectiveMeasurementById = useMemo(
    () =>
      selectDisplayedMap(
        useLocalPreviewCalculations,
        localTrimScopeEffectiveMeasurementById,
        serverTrimScopeEffectiveMeasurementById
      ),
    [
      localTrimScopeEffectiveMeasurementById,
      serverTrimScopeEffectiveMeasurementById,
      useLocalPreviewCalculations,
    ]
  )
  const displayedTrimScopeEffectiveTotalById = useMemo(
    () =>
      selectDisplayedMap(
        useLocalPreviewCalculations,
        localTrimScopeEffectiveTotalById,
        serverTrimScopeEffectiveTotalById
      ),
    [
      localTrimScopeEffectiveTotalById,
      serverTrimScopeEffectiveTotalById,
      useLocalPreviewCalculations,
    ]
  )
  const selectedTrimSubtotal = useMemo(
    () => sumIncludedValues(selectedRoomTrimScopes, displayedTrimScopeEffectiveTotalById),
    [selectedRoomTrimScopes, displayedTrimScopeEffectiveTotalById]
  )
  const selectedTrimMeasurement = useMemo(
    () => sumIncludedTrimMeasurement(selectedRoomTrimScopes, displayedTrimScopeEffectiveMeasurementById),
    [selectedRoomTrimScopes, displayedTrimScopeEffectiveMeasurementById]
  )

  return {
    trimScopeEffectiveMeasurementById: displayedTrimScopeEffectiveMeasurementById,
    trimScopeEffectiveTotalById: displayedTrimScopeEffectiveTotalById,
    selectedTrimSubtotal,
    selectedTrimMeasurement,
  }
}
