'use client'

import { useMemo } from 'react'
import {
  buildLocalDrywallRepairEffectiveQuantityById,
  buildTrimScopeMetricById,
} from '../_lib/estimateV2EditorDerived'
import { buildOverrideDrivenTotalById } from './estimateV2OverrideDrivenTotals'
import { selectDisplayedMap } from './useEstimateV2CalculationContext'
import type { EstimateV2EditorMetaState } from './estimateV2EditorTypes'
import type { calculateEstimateV2Preview } from '@/lib/estimator/v2PreviewCalculations'
import type { EstimateV2DrywallRepairDraft } from '@/types/estimator/v2Scopes'
import type { EstimateV2SavePayload } from '@/types/estimator/v2Summary'

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

export function useEstimateV2DrywallCalculationDerived(params: {
  drywallRepairs: EstimateV2DrywallRepairDraft[]
  drywallCalculations: EstimateV2EditorMetaState['drywallCalculations']
  currentDrywallRepairs: EstimateV2SavePayload['drywall_repairs']
  localDrywallCalculations: ReturnType<typeof calculateEstimateV2Preview>['drywall']
  selectedRoomWallDrywallRepairs: EstimateV2DrywallRepairDraft[]
  selectedRoomCeilingDrywallRepairs: EstimateV2DrywallRepairDraft[]
  useLocalPreviewCalculations: boolean
}) {
  const {
    drywallRepairs,
    drywallCalculations,
    currentDrywallRepairs,
    localDrywallCalculations,
    selectedRoomWallDrywallRepairs,
    selectedRoomCeilingDrywallRepairs,
    useLocalPreviewCalculations,
  } = params

  const serverDrywallRepairEffectiveQuantityById = useMemo(
    () => buildTrimScopeMetricById(drywallCalculations, 'effective_quantity'),
    [drywallCalculations]
  )
  const serverDrywallRepairEffectiveTotalById = useMemo(
    () => buildTrimScopeMetricById(drywallCalculations, 'effective_total'),
    [drywallCalculations]
  )
  const localDrywallRepairEffectiveQuantityById = useMemo(
    () => buildLocalDrywallRepairEffectiveQuantityById(drywallRepairs),
    [drywallRepairs]
  )
  const localDrywallRepairEffectiveTotalById = useMemo(
    () =>
      buildOverrideDrivenTotalById({
        rows: currentDrywallRepairs ?? [],
        calculatedTotalById: buildTrimScopeMetricById(localDrywallCalculations, 'effective_total'),
        overrideKeys: ['override_total'],
      }),
    [currentDrywallRepairs, localDrywallCalculations]
  )
  const displayedDrywallRepairEffectiveQuantityById = useMemo(
    () =>
      selectDisplayedMap(
        useLocalPreviewCalculations,
        localDrywallRepairEffectiveQuantityById,
        serverDrywallRepairEffectiveQuantityById
      ),
    [
      localDrywallRepairEffectiveQuantityById,
      serverDrywallRepairEffectiveQuantityById,
      useLocalPreviewCalculations,
    ]
  )
  const displayedDrywallRepairEffectiveTotalById = useMemo(
    () =>
      selectDisplayedMap(
        useLocalPreviewCalculations,
        localDrywallRepairEffectiveTotalById,
        serverDrywallRepairEffectiveTotalById
      ),
    [
      localDrywallRepairEffectiveTotalById,
      serverDrywallRepairEffectiveTotalById,
      useLocalPreviewCalculations,
    ]
  )
  const selectedWallDrywallSubtotal = useMemo(
    () => sumRowsById(selectedRoomWallDrywallRepairs, displayedDrywallRepairEffectiveTotalById),
    [displayedDrywallRepairEffectiveTotalById, selectedRoomWallDrywallRepairs]
  )
  const selectedCeilingDrywallSubtotal = useMemo(
    () => sumRowsById(selectedRoomCeilingDrywallRepairs, displayedDrywallRepairEffectiveTotalById),
    [displayedDrywallRepairEffectiveTotalById, selectedRoomCeilingDrywallRepairs]
  )

  return {
    serverDrywallRepairEffectiveQuantityById,
    serverDrywallRepairEffectiveTotalById,
    localDrywallRepairEffectiveQuantityById,
    localDrywallRepairEffectiveTotalById,
    displayedDrywallRepairEffectiveQuantityById,
    displayedDrywallRepairEffectiveTotalById,
    selectedWallDrywallSubtotal,
    selectedCeilingDrywallSubtotal,
  }
}
