'use client'

import { useMemo } from 'react'
import {
  buildDoorScopeCountById,
  buildLocalDoorScopeEffectiveUnitsById,
  buildTrimScopeMetricById,
  sumIncludedValues,
} from '../_lib/estimateV2EditorDerived'
import { buildOverrideDrivenTotalById } from './estimateV2OverrideDrivenTotals'
import { selectDisplayedMap } from './useEstimateV2CalculationContext'
import type { EstimateV2EditorMetaState } from './estimateV2EditorTypes'
import type { calculateEstimateV2Preview } from '@/lib/estimator/v2PreviewCalculations'
import type { EstimateV2DoorScopeDraft } from '@/types/estimator/v2Scopes'
import type { EstimateV2SavePayload } from '@/types/estimator/v2Summary'

export function useEstimateV2DoorCalculationDerived(params: {
  doorScopes: EstimateV2DoorScopeDraft[]
  doorCalculations: EstimateV2EditorMetaState['doorCalculations']
  currentDoorScopes: EstimateV2SavePayload['room_door_scopes']
  localDoorCalculations: ReturnType<typeof calculateEstimateV2Preview>['doors']
  selectedRoomDoorScopes: Array<{ id: string; include: 'Y' | 'N' }>
  useLocalPreviewCalculations: boolean
}) {
  const {
    doorScopes,
    doorCalculations,
    currentDoorScopes,
    localDoorCalculations,
    selectedRoomDoorScopes,
    useLocalPreviewCalculations,
  } = params

  const serverDoorScopeEffectiveUnitsById = useMemo(
    () => buildTrimScopeMetricById(doorCalculations, 'effective_units'),
    [doorCalculations]
  )
  const serverDoorScopeEffectiveTotalById = useMemo(
    () => buildTrimScopeMetricById(doorCalculations, 'effective_total'),
    [doorCalculations]
  )
  const localDoorScopeEffectiveUnitsById = useMemo(
    () => buildLocalDoorScopeEffectiveUnitsById(doorScopes),
    [doorScopes]
  )
  const localDoorScopeEffectiveTotalById = useMemo(
    () =>
      buildOverrideDrivenTotalById({
        rows: currentDoorScopes ?? [],
        calculatedTotalById: buildTrimScopeMetricById(localDoorCalculations, 'effective_total'),
        overrideKeys: [
          'override_paint_hours',
          'override_primer_hours',
          'override_material_cost',
          'override_supply_cost',
          'override_total',
        ],
      }),
    [currentDoorScopes, localDoorCalculations]
  )
  const doorScopeCountById = useMemo(
    () => buildDoorScopeCountById(doorScopes),
    [doorScopes]
  )
  const displayedDoorScopeEffectiveUnitsById = useMemo(
    () =>
      selectDisplayedMap(
        useLocalPreviewCalculations,
        localDoorScopeEffectiveUnitsById,
        serverDoorScopeEffectiveUnitsById
      ),
    [
      localDoorScopeEffectiveUnitsById,
      serverDoorScopeEffectiveUnitsById,
      useLocalPreviewCalculations,
    ]
  )
  const displayedDoorScopeEffectiveTotalById = useMemo(
    () =>
      selectDisplayedMap(
        useLocalPreviewCalculations,
        localDoorScopeEffectiveTotalById,
        serverDoorScopeEffectiveTotalById
      ),
    [
      localDoorScopeEffectiveTotalById,
      serverDoorScopeEffectiveTotalById,
      useLocalPreviewCalculations,
    ]
  )
  const selectedDoorSubtotal = useMemo(
    () => sumIncludedValues(selectedRoomDoorScopes, displayedDoorScopeEffectiveTotalById),
    [displayedDoorScopeEffectiveTotalById, selectedRoomDoorScopes]
  )
  const selectedDoorUnits = useMemo(
    () => sumIncludedValues(selectedRoomDoorScopes, displayedDoorScopeEffectiveUnitsById),
    [displayedDoorScopeEffectiveUnitsById, selectedRoomDoorScopes]
  )

  return {
    serverDoorScopeEffectiveUnitsById,
    serverDoorScopeEffectiveTotalById,
    localDoorScopeEffectiveUnitsById,
    localDoorScopeEffectiveTotalById,
    doorScopeCountById,
    displayedDoorScopeEffectiveUnitsById,
    displayedDoorScopeEffectiveTotalById,
    selectedDoorSubtotal,
    selectedDoorUnits,
  }
}
