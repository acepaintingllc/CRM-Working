'use client'

import { useCallback } from 'react'
import type { EstimateV2EditorStoreApi } from '@/lib/estimates/v2/store/estimateV2Store'
import type {
  ConditionLevel,
  EstimateV2AccessFeeDraft,
  EstimateV2ConditionModifier,
} from '@/types/estimator/v2'
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
import {
  emptyConditionSelections,
  resolveAllConditionFactors,
  setConditionSelection,
} from '../_lib/estimateV2DetailsConditions'
import {
  addAccessFeeDraft,
  removeAccessFeeDraft,
  updateAccessFeeDraft,
} from '../_lib/estimateV2DetailsAccessFees'

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

function updatePaintProductByScopeIds<TItem extends { id: string; paintProductId: string }>(
  items: TItem[],
  scopeIds: string[],
  productId: string
) {
  const ids = new Set(scopeIds)
  if (ids.size === 0) return items
  let changed = false
  const next = items.map((item) => {
    if (!ids.has(item.id) || item.paintProductId === productId) return item
    changed = true
    return { ...item, paintProductId: productId }
  })
  return changed ? next : items
}

export function useEstimateV2DetailsMutations(params: {
  store: EstimateV2EditorStoreApi
  rollerOptions: DetailsRollerCoverOption[]
  vm: EstimateV2DetailsVm
  conditionModifiers: EstimateV2ConditionModifier[]
}) {
  const recordDebugDirtySource = useCallback(() => {
    // Debug-only instrumentation; snapshot comparison controls actual dirty state.
    params.store
      .getState()
      .setDebugMeta((prev) => ({ ...prev, dirtySource: 'details-overrides' }))
  }, [params.store])

  const recordAccessFeeDirtySource = useCallback(() => {
    params.store
      .getState()
      .setDebugMeta((prev) => ({ ...prev, dirtySource: 'access-fees' }))
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

  const setWallProduct = useCallback(
    (scopeIds: string[], productId: string) => {
      const changed = applyTrackedDetailsCollectionMutation(
        params.store.getState().setScopes,
        (prev) => updatePaintProductByScopeIds(prev, scopeIds, productId)
      )
      if (changed) recordDebugDirtySource()
    },
    [recordDebugDirtySource, params.store]
  )

  const setCeilingProduct = useCallback(
    (scopeIds: string[], productId: string) => {
      const changed = applyTrackedDetailsCollectionMutation(
        params.store.getState().setCeilingScopes,
        (prev) => updatePaintProductByScopeIds(prev, scopeIds, productId)
      )
      if (changed) recordDebugDirtySource()
    },
    [recordDebugDirtySource, params.store]
  )

  const setTrimProduct = useCallback(
    (scopeIds: string[], productId: string) => {
      const changed = applyTrackedDetailsCollectionMutation(
        params.store.getState().setTrimScopes,
        (prev) => updatePaintProductByScopeIds(prev, scopeIds, productId)
      )
      if (changed) recordDebugDirtySource()
    },
    [recordDebugDirtySource, params.store]
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

  const setRoomCondition = useCallback(
    (
      scope: EstimateV2ConditionModifier['scope'],
      conditionId: string,
      level: ConditionLevel | null
    ) => {
      const current =
        params.store.getState().meta.jobSettingsDraft.conditionSelections ??
        emptyConditionSelections()
      const next = setConditionSelection(current, scope, conditionId, level)
      if (JSON.stringify(current[scope]) === JSON.stringify(next[scope])) return
      const factors = resolveAllConditionFactors(params.conditionModifiers, next)
      params.store.getState().setJobSettingsDraft((prev) => ({
        ...prev,
        conditionSelections: next,
        resolvedConditionFactors: factors,
      }))
      recordDebugDirtySource()
    },
    [params.store, params.conditionModifiers, recordDebugDirtySource]
  )

  const addAccessFee = useCallback(() => {
    params.store.getState().setAccessFees((prev) => addAccessFeeDraft(prev))
    recordAccessFeeDirtySource()
  }, [params.store, recordAccessFeeDirtySource])

  const updateAccessFee = useCallback(
    (rowId: string, patch: Partial<EstimateV2AccessFeeDraft>) => {
      params.store.getState().setAccessFees((prev) => updateAccessFeeDraft(prev, rowId, patch))
      recordAccessFeeDirtySource()
    },
    [params.store, recordAccessFeeDirtySource]
  )

  const removeAccessFee = useCallback(
    (rowId: string) => {
      params.store.getState().setAccessFees((prev) => removeAccessFeeDraft(prev, rowId))
      recordAccessFeeDirtySource()
    },
    [params.store, recordAccessFeeDirtySource]
  )

  return {
    setCrewSize,
    setRollerRow,
    setWallOverride,
    setCeilingOverride,
    setTrimOverride,
    setWallProduct,
    setCeilingProduct,
    setTrimProduct,
    setRoomCondition,
    addAccessFee,
    updateAccessFee,
    removeAccessFee,
  }
}

export type EstimateV2DetailsMutations = ReturnType<typeof useEstimateV2DetailsMutations>
