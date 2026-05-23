'use client'

import { useMemo } from 'react'
import {
  buildCeilingScopeEffectiveAreaById,
  buildCeilingScopeEffectiveTotalById,
  buildLocalCeilingScopeEffectiveAreaById,
  buildLocalCeilingScopePreviewMetricsById,
  sumIncludedValues,
} from '../_lib/estimateV2EditorDerived'
import { buildOverrideDrivenTotalById } from './estimateV2OverrideDrivenTotals'
import { selectDisplayedMap } from './useEstimateV2CalculationContext'
import type { EstimateV2EditorMetaState } from './estimateV2EditorTypes'
import type { calculateEstimateV2Preview } from '@/lib/estimator/v2PreviewCalculations'
import type { EstimateV2CeilingTypeOption } from '@/types/estimator/v2Catalogs'
import type { EstimateV2RoomDraft } from '@/types/estimator/v2Rooms'
import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2CeilingSegmentDraft,
} from '@/types/estimator/v2Scopes'
import type { EstimateV2SavePayload } from '@/types/estimator/v2Summary'

export function useEstimateV2CeilingCalculationDerived(params: {
  ceilingScopes: EstimateV2CeilingScopeDraft[]
  ceilingSegments: EstimateV2CeilingSegmentDraft[]
  rooms: EstimateV2RoomDraft[]
  ceilingCalculations: EstimateV2EditorMetaState['ceilingCalculations']
  ceilingTypes: EstimateV2CeilingTypeOption[]
  currentCeilingScopes: EstimateV2SavePayload['room_ceiling_scopes']
  localCeilingCalculations: ReturnType<typeof calculateEstimateV2Preview>['ceilings']
  selectedRoomCeilingScopes: Array<{ id: string; include: 'Y' | 'N' }>
  useLocalPreviewCalculations: boolean
}) {
  const {
    ceilingScopes,
    ceilingSegments,
    rooms,
    ceilingCalculations,
    ceilingTypes,
    currentCeilingScopes,
    localCeilingCalculations,
    selectedRoomCeilingScopes,
    useLocalPreviewCalculations,
  } = params

  const serverCeilingScopeEffectiveAreaById = useMemo(
    () => buildCeilingScopeEffectiveAreaById(ceilingCalculations),
    [ceilingCalculations]
  )
  const serverCeilingScopeEffectiveTotalById = useMemo(
    () => buildCeilingScopeEffectiveTotalById(ceilingCalculations),
    [ceilingCalculations]
  )
  const localCeilingScopeEffectiveAreaById = useMemo(
    () =>
      buildLocalCeilingScopeEffectiveAreaById({
        ceilingScopes,
        ceilingSegments,
        rooms,
        ceilingTypes,
      }),
    [ceilingScopes, ceilingSegments, rooms, ceilingTypes]
  )
  const localCeilingScopePreviewMetricsById = useMemo(
    () =>
      buildLocalCeilingScopePreviewMetricsById({
        ceilingScopes,
        ceilingSegments,
        rooms,
        ceilingTypes,
      }),
    [ceilingScopes, ceilingSegments, rooms, ceilingTypes]
  )
  const localCeilingScopeEffectiveTotalById = useMemo(
    () =>
      buildOverrideDrivenTotalById({
        rows: currentCeilingScopes,
        calculatedTotalById: buildCeilingScopeEffectiveTotalById(localCeilingCalculations),
        overrideKeys: [
          'override_paint_hours',
          'override_primer_hours',
          'override_paint_gallons',
          'override_primer_gallons',
          'override_supply_cost',
          'override_total',
        ],
      }),
    [currentCeilingScopes, localCeilingCalculations]
  )
  const displayedCeilingScopeEffectiveAreaById = useMemo(
    () =>
      selectDisplayedMap(
        useLocalPreviewCalculations,
        localCeilingScopeEffectiveAreaById,
        serverCeilingScopeEffectiveAreaById
      ),
    [
      localCeilingScopeEffectiveAreaById,
      serverCeilingScopeEffectiveAreaById,
      useLocalPreviewCalculations,
    ]
  )
  const displayedCeilingScopeEffectiveTotalById = useMemo(
    () =>
      selectDisplayedMap(
        useLocalPreviewCalculations,
        localCeilingScopeEffectiveTotalById,
        serverCeilingScopeEffectiveTotalById
      ),
    [
      localCeilingScopeEffectiveTotalById,
      serverCeilingScopeEffectiveTotalById,
      useLocalPreviewCalculations,
    ]
  )
  const selectedCeilingEffectiveSqFt = useMemo(
    () => sumIncludedValues(selectedRoomCeilingScopes, displayedCeilingScopeEffectiveAreaById),
    [displayedCeilingScopeEffectiveAreaById, selectedRoomCeilingScopes]
  )
  const selectedCeilingSubtotal = useMemo(
    () => sumIncludedValues(selectedRoomCeilingScopes, displayedCeilingScopeEffectiveTotalById),
    [displayedCeilingScopeEffectiveTotalById, selectedRoomCeilingScopes]
  )

  return {
    selectedCeilingEffectiveSqFt,
    selectedCeilingSubtotal,
    ceilingScopePreviewMetricsById: localCeilingScopePreviewMetricsById,
    ceilingScopeEffectiveTotalById: displayedCeilingScopeEffectiveTotalById,
    displayedCeilingScopeEffectiveAreaById,
    displayedCeilingScopeEffectiveTotalById,
  }
}
