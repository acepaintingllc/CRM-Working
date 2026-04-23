'use client'

import { useState } from 'react'
import {
  createEstimateV2Store,
  estimateV2StoreSelectors,
  useEstimateV2Store,
} from '@/lib/estimates/v2/store/estimateV2Store'
import {
  estimateRouteFamily,
  type EstimateRouteFamily,
} from '../../estimateRouteFamily'
import { useEstimateV2BeforeUnload } from './useEstimateV2BeforeUnload'
import { useEstimateV2CeilingActions } from './useEstimateV2CeilingActions'
import { useEstimateV2DefaultScopeColorSync } from './useEstimateV2DefaultScopeColorSync'
import { useEstimateV2DerivedState } from './useEstimateV2DerivedState'
import { useEstimateV2EditorLoader } from './useEstimateV2EditorLoader'
import { useEstimateV2EditorViewModels } from './useEstimateV2EditorViewModels'
import { useEstimateV2RoomActions } from './useEstimateV2RoomActions'
import { useEstimateV2SaveController } from './useEstimateV2SaveController'
import { useEstimateV2SettingsActions } from './useEstimateV2SettingsActions'
import { useEstimateV2TrimActions } from './useEstimateV2TrimActions'
import { useEstimateV2WallActions } from './useEstimateV2WallActions'

export function useEstimateV2Editor({
  estimateId,
  routeFamily = estimateRouteFamily,
}: {
  estimateId?: string
  routeFamily?: EstimateRouteFamily
}) {
  const [store] = useState(() => createEstimateV2Store())
  const loading = useEstimateV2Store(store, estimateV2StoreSelectors.loading)
  const effectiveJobProductDefaults = useEstimateV2Store(
    store,
    estimateV2StoreSelectors.effectiveJobProductDefaults
  )

  const derived = useEstimateV2DerivedState({ store })
  const derivedSections = derived.sections

  useEstimateV2EditorLoader({
    estimateId,
    routeFamily,
    store,
  })
  useEstimateV2BeforeUnload({ loading, dirty: derived.dirty })
  useEstimateV2DefaultScopeColorSync({
    store,
    defaultColorCodeId: derivedSections.catalog.defaultColorCodeId,
  })

  const roomActions = useEstimateV2RoomActions({
    store,
    roomModeById: derivedSections.room.roomModeById,
    trimTypeOptions: derivedSections.catalog.trimTypeOptions,
  })
  const wallActions = useEstimateV2WallActions({
    store,
    roomModeById: derivedSections.room.roomModeById,
  })
  const ceilingActions = useEstimateV2CeilingActions({
    store,
    roomModeById: derivedSections.room.roomModeById,
  })
  const trimActions = useEstimateV2TrimActions({
    store,
    trimTypeOptions: derivedSections.catalog.trimTypeOptions,
    roomModeById: derivedSections.room.roomModeById,
    roomHeightFactorByRoomId: derivedSections.room.roomHeightFactorByRoomId,
  })
  const settingsActions = useEstimateV2SettingsActions({ estimateId, routeFamily, store })
  const saveController = useEstimateV2SaveController({
    estimateId,
    routeFamily,
    store,
    currentSnapshot: derivedSections.calculation.currentSnapshot,
    dirty: derivedSections.calculation.dirty,
    effectiveJobProductDefaults,
  })

  return useEstimateV2EditorViewModels({
    estimateId,
    store,
    derived: derivedSections,
    roomActions,
    wallActions,
    ceilingActions,
    trimActions,
    settingsActions,
    save: saveController.save,
  })
}
