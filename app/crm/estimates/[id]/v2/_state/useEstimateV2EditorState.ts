'use client'

import { useEffect } from 'react'
import {
  estimateRouteFamily,
  type EstimateRouteFamily,
} from '../../estimateRouteFamily'
import { useEstimateV2CeilingActions } from './useEstimateV2CeilingActions'
import { useEstimateV2DerivedState } from './useEstimateV2DerivedState'
import { useEstimateV2EditorLoader } from './useEstimateV2EditorLoader'
import { useEstimateV2EditorStore } from './useEstimateV2EditorStore'
import { useEstimateV2EditorViewModels } from './useEstimateV2EditorViewModels'
import { useEstimateV2RoomActions } from './useEstimateV2RoomActions'
import { useEstimateV2SaveController } from './useEstimateV2SaveController'
import { useEstimateV2SettingsActions } from './useEstimateV2SettingsActions'
import { useEstimateV2TrimActions } from './useEstimateV2TrimActions'
import { useEstimateV2WallActions } from './useEstimateV2WallActions'

export function useEstimateV2EditorState({
  estimateId,
  routeFamily = estimateRouteFamily,
}: {
  estimateId?: string
  routeFamily?: EstimateRouteFamily
}) {
  const store = useEstimateV2EditorStore()
  const { collections, meta, state } = store
  const { setScopes } = collections

  const derived = useEstimateV2DerivedState({ collections, meta })

  useEstimateV2EditorLoader({
    estimateId,
    routeFamily,
    collections,
    meta,
  })

  useEffect(() => {
    if (!derived.defaultColorCodeId) return
    setScopes((prev) => {
      let changed = false
      const next = prev.map((scope) => {
        if (scope.colorId) return scope
        changed = true
        return { ...scope, colorId: derived.defaultColorCodeId }
      })
      return changed ? next : prev
    })
  }, [derived.defaultColorCodeId, setScopes])

  const roomActions = useEstimateV2RoomActions({
    collections,
    meta,
    roomModeById: derived.roomModeById,
    trimTypeOptions: derived.trimTypeOptions,
  })
  const wallActions = useEstimateV2WallActions({
    collections,
    meta,
    roomModeById: derived.roomModeById,
  })
  const ceilingActions = useEstimateV2CeilingActions({
    collections,
    meta,
    roomModeById: derived.roomModeById,
  })
  const trimActions = useEstimateV2TrimActions({
    collections,
    meta,
    trimTypeOptions: derived.trimTypeOptions,
    roomModeById: derived.roomModeById,
    roomHeightFactorByRoomId: derived.roomHeightFactorByRoomId,
  })
  const settingsActions = useEstimateV2SettingsActions({ estimateId, routeFamily, meta })
  const saveController = useEstimateV2SaveController({
    estimateId,
    routeFamily,
    collections,
    meta,
    currentSnapshot: derived.currentSnapshot,
    dirty: derived.dirty,
    effectiveJobProductDefaults: {
      wallPaintProductId:
        state.jobSettingsDraft.wallPaintProductId ||
        state.orgJobProductDefaults.wallPaintProductId,
      wallPrimerProductId:
        state.jobSettingsDraft.wallPrimerProductId ||
        state.orgJobProductDefaults.wallPrimerProductId,
      ceilingPaintProductId:
        state.jobSettingsDraft.ceilingPaintProductId ||
        state.orgJobProductDefaults.ceilingPaintProductId,
      ceilingPrimerProductId:
        state.jobSettingsDraft.ceilingPrimerProductId ||
        state.orgJobProductDefaults.ceilingPrimerProductId,
      trimPaintProductId:
        state.jobSettingsDraft.trimPaintProductId ||
        state.orgJobProductDefaults.trimPaintProductId,
      trimPrimerProductId:
        state.jobSettingsDraft.trimPrimerProductId ||
        state.orgJobProductDefaults.trimPrimerProductId,
    },
  })

  return useEstimateV2EditorViewModels({
    estimateId,
    state,
    meta,
    derived,
    roomActions,
    wallActions,
    ceilingActions,
    trimActions,
    settingsActions,
    save: saveController.save,
  })
}
