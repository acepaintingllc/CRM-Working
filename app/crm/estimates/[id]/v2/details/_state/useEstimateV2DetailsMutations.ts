'use client'

import { useCallback } from 'react'
import type { EstimateV2EditorStoreApi } from '@/lib/estimates/v2/store/estimateV2Store'
import {
  applyCeilingGallonOverride,
  applyTrimGallonOverride,
  applyWallGroupGallonOverride,
} from '../_lib/estimateV2DetailsMaterials'
import {
  type DetailsRollerCoverOption,
  type DetailsRollerState,
  type EstimateV2DetailsVm,
} from '../_lib/estimateV2DetailsVm'
import { applyDetailsRollerRowPatch } from '../_lib/estimateV2DetailsRollerDrafts'

type DetailsCollectionSetter<TItem> = (value: TItem[] | ((prev: TItem[]) => TItem[])) => void

function applyTrackedDetailsCollectionMutation<TItem>(
  setCollection: DetailsCollectionSetter<TItem>,
  updateCollection: (prev: TItem[]) => TItem[]
) {
  let changed = false
  setCollection((prev) => {
    const next = updateCollection(prev)
    changed = next !== prev
    return next
  })
  return changed
}

export function useEstimateV2DetailsMutations(params: {
  store: EstimateV2EditorStoreApi
  rollerOptions: DetailsRollerCoverOption[]
  vm: EstimateV2DetailsVm
}) {
  const recordDebugDirtySource = useCallback(() => {
    // Debug-only instrumentation; snapshot comparison controls actual dirty state.
    params.store
      .getState()
      .setDebugMeta((prev) => ({ ...prev, dirtySource: 'details-overrides' }))
  }, [params.store])

  const setRollerRow = useCallback(
    (rowId: string, patch: Partial<DetailsRollerState[string]>) => {
      const changed = applyTrackedDetailsCollectionMutation(
        params.store.getState().setRollers,
        (prev) =>
          applyDetailsRollerRowPatch({
            rollers: prev,
            rowId,
            patch,
            rollerOptions: params.rollerOptions,
          })
      )
      if (changed) recordDebugDirtySource()
    },
    [recordDebugDirtySource, params.rollerOptions, params.store]
  )

  const setWallOverride = useCallback(
    (colorId: string, value: string) => {
      const ownerScopeId =
        params.vm.wallRows.find((row) => (row.colorId ?? row.id) === colorId)
          ?.overrideOwnerScopeId ?? null
      const changed = applyTrackedDetailsCollectionMutation(
        params.store.getState().setScopes,
        (prev) => applyWallGroupGallonOverride(prev, colorId, value, ownerScopeId)
      )
      if (changed) recordDebugDirtySource()
    },
    [recordDebugDirtySource, params.store, params.vm.wallRows]
  )

  const setCeilingOverride = useCallback(
    (value: string) => {
      const ownerScopeId = params.vm.ceilingRow?.overrideOwnerScopeId ?? null
      const changed = applyTrackedDetailsCollectionMutation(
        params.store.getState().setCeilingScopes,
        (prev) => applyCeilingGallonOverride(prev, value, ownerScopeId)
      )
      if (changed) recordDebugDirtySource()
    },
    [recordDebugDirtySource, params.store, params.vm.ceilingRow]
  )

  const setTrimOverride = useCallback(
    (value: string) => {
      const ownerScopeId = params.vm.trimRow?.overrideOwnerScopeId ?? null
      const changed = applyTrackedDetailsCollectionMutation(
        params.store.getState().setTrimScopes,
        (prev) => applyTrimGallonOverride(prev, value, ownerScopeId)
      )
      if (changed) recordDebugDirtySource()
    },
    [recordDebugDirtySource, params.store, params.vm.trimRow]
  )

  const setCrewSize = useCallback(
    (value: number) => {
      const normalized = Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1
      const previous = params.store.getState().meta.jobSettingsDraft.crewSize
      if (previous === normalized) return
      params.store
        .getState()
        .setJobSettingsDraft((prev) => ({ ...prev, crewSize: normalized }))
      recordDebugDirtySource()
    },
    [params.store, recordDebugDirtySource]
  )

  return {
    setCrewSize,
    setRollerRow,
    setWallOverride,
    setCeilingOverride,
    setTrimOverride,
  }
}

export type EstimateV2DetailsMutations = ReturnType<typeof useEstimateV2DetailsMutations>
