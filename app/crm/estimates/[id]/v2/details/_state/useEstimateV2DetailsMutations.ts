'use client'

import { useCallback } from 'react'
import type { EstimateV2EditorStoreApi } from '@/lib/estimates/v2/store/estimateV2Store'
import {
  applyCeilingGallonOverride,
  applyTrimGallonOverride,
  applyWallGroupGallonOverride,
  type DetailsRollerCoverOption,
  type DetailsRollerState,
} from '../_lib/estimateV2DetailsVm'
import { applyDetailsRollerRowPatch } from '../_lib/estimateV2DetailsRollerDrafts'

export function useEstimateV2DetailsMutations(params: {
  store: EstimateV2EditorStoreApi
  rollerOptions: DetailsRollerCoverOption[]
}) {
  const markDirty = useCallback(() => {
    params.store
      .getState()
      .setDebugMeta((prev) => ({ ...prev, dirtySource: 'details-overrides' }))
  }, [params.store])

  const setRollerRow = useCallback(
    (rowId: string, patch: Partial<DetailsRollerState[string]>) => {
      params.store.getState().setRollers((prev) =>
        applyDetailsRollerRowPatch({
          rollers: prev,
          rowId,
          patch,
          rollerOptions: params.rollerOptions,
        })
      )
      markDirty()
    },
    [markDirty, params.rollerOptions, params.store]
  )

  const setWallOverride = useCallback(
    (colorId: string, value: string) => {
      params.store.getState().setScopes((prev) => {
        return applyWallGroupGallonOverride(prev, colorId, value)
      })
      markDirty()
    },
    [markDirty, params.store]
  )

  const setCeilingOverride = useCallback(
    (value: string) => {
      params.store.getState().setCeilingScopes((prev) => {
        return applyCeilingGallonOverride(prev, value)
      })
      markDirty()
    },
    [markDirty, params.store]
  )

  const setTrimOverride = useCallback(
    (value: string) => {
      params.store.getState().setTrimScopes((prev) => {
        return applyTrimGallonOverride(prev, value)
      })
      markDirty()
    },
    [markDirty, params.store]
  )

  return {
    setRollerRow,
    setWallOverride,
    setCeilingOverride,
    setTrimOverride,
  }
}

export type EstimateV2DetailsMutations = ReturnType<typeof useEstimateV2DetailsMutations>
