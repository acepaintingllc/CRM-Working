'use client'

import { useMemo } from 'react'
import { calculateEstimateV2Preview } from '@/lib/estimator/v2PreviewCalculations'
import {
  areEstimateV2DirtySnapshotsEqual,
  buildEstimateV2DirtySnapshot,
} from './estimateV2DirtySnapshot'
import type {
  EstimateV2EditorCollections,
  EstimateV2EditorMetaState,
} from './estimateV2EditorTypes'

export type EstimateV2CalculationContextCollections = Pick<
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
  | 'accessFees'
  | 'otherItems'
> & {
  prejobTrips?: EstimateV2EditorCollections['prejobTrips']
}

export type EstimateV2CalculationContextMeta = Pick<
  EstimateV2EditorMetaState,
  | 'loading'
  | 'estimate'
  | 'lastSavedSnapshot'
  | 'wallCalculations'
  | 'jobSettingsDraft'
  | 'catalogs'
> & {
  orgJobProductDefaults?: EstimateV2EditorMetaState['orgJobProductDefaults']
}

export function selectDisplayedMap<T>(
  useLocalPreviewCalculations: boolean,
  localValue: T,
  serverValue: T
): T {
  return useLocalPreviewCalculations ? localValue : serverValue
}

export function useEstimateV2CalculationContext(params: {
  collections: EstimateV2CalculationContextCollections
  meta: EstimateV2CalculationContextMeta
}) {
  const { collections, meta } = params
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
        prejobTrips: collections.prejobTrips ?? [],
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
      collections.prejobTrips,
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
  const orgDefaults = useMemo(
    () =>
      meta.orgJobProductDefaults
        ? {
            walls_paint_id: meta.orgJobProductDefaults.wallPaintProductId || null,
            walls_primer_id: meta.orgJobProductDefaults.wallPrimerProductId || null,
            ceiling_paint_id: meta.orgJobProductDefaults.ceilingPaintProductId || null,
            ceiling_primer_id: meta.orgJobProductDefaults.ceilingPrimerProductId || null,
            trim_paint_id: meta.orgJobProductDefaults.trimPaintProductId || null,
            trim_primer_id: meta.orgJobProductDefaults.trimPrimerProductId || null,
          }
        : undefined,
    [meta.orgJobProductDefaults]
  )
  const localPreviewCalculations = useMemo(
    () =>
      calculateEstimateV2Preview({
        payload: currentPayload,
        catalogs: meta.catalogs,
        orgDefaults,
      }),
    [currentPayload, meta.catalogs, orgDefaults]
  )
  const calculationsStale = dirty

  return {
    currentSnapshot,
    currentPayload,
    dirty,
    hasServerCalculations,
    useLocalPreviewCalculations,
    localPreviewCalculations,
    calculationsStale,
  }
}
