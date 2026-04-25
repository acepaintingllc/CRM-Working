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
  const markDirty = useCallback(() => {
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
      if (changed) markDirty()
    },
    [markDirty, params.rollerOptions, params.store]
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
      if (changed) markDirty()
    },
    [markDirty, params.store, params.vm.wallRows]
  )

  const setCeilingOverride = useCallback(
    (value: string) => {
      const ownerScopeId = params.vm.ceilingRow?.overrideOwnerScopeId ?? null
      const changed = applyTrackedDetailsCollectionMutation(
        params.store.getState().setCeilingScopes,
        (prev) => applyCeilingGallonOverride(prev, value, ownerScopeId)
      )
      if (changed) markDirty()
    },
    [markDirty, params.store, params.vm.ceilingRow]
  )

  const setTrimOverride = useCallback(
    (value: string) => {
      const ownerScopeId = params.vm.trimRow?.overrideOwnerScopeId ?? null
      const changed = applyTrackedDetailsCollectionMutation(
        params.store.getState().setTrimScopes,
        (prev) => applyTrimGallonOverride(prev, value, ownerScopeId)
      )
      if (changed) markDirty()
    },
    [markDirty, params.store, params.vm.trimRow]
  )

  return {
    setRollerRow,
    setWallOverride,
    setCeilingOverride,
    setTrimOverride,
  }
}

export type EstimateV2DetailsMutations = ReturnType<typeof useEstimateV2DetailsMutations>
