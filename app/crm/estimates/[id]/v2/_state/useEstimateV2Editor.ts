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
import { useEstimateV2DoorActions } from './useEstimateV2DoorActions'
import { useEstimateV2DrywallActions } from './useEstimateV2DrywallActions'
import { useEstimateV2EditorDerivedSections } from './useEstimateV2EditorDerivedSections'
import { useEstimateV2EditorLoader } from './useEstimateV2EditorLoader'
import { useEstimateV2EditorViewModels } from './useEstimateV2EditorViewModels'
import { useEstimateV2OtherActions } from './useEstimateV2OtherActions'
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

  const derived = useEstimateV2EditorDerivedSections({ store })

  useEstimateV2EditorLoader({
    estimateId,
    routeFamily,
    store,
  })
  useEstimateV2BeforeUnload({ loading, dirty: derived.calculation.dirty })
  useEstimateV2DefaultScopeColorSync({
    store,
    defaultColorCodeId: derived.catalog.defaultColorCodeId,
  })

  const roomActions = useEstimateV2RoomActions({
    store,
    roomModeById: derived.room.roomModeById,
    trimTypeOptions: derived.catalog.trimTypeOptions,
  })
  const wallActions = useEstimateV2WallActions({
    store,
    roomModeById: derived.room.roomModeById,
  })
  const ceilingActions = useEstimateV2CeilingActions({
    store,
    roomModeById: derived.room.roomModeById,
  })
  const trimActions = useEstimateV2TrimActions({
    store,
    trimTypeOptions: derived.catalog.trimTypeOptions,
    roomModeById: derived.room.roomModeById,
    roomHeightFactorByRoomId: derived.room.roomHeightFactorByRoomId,
  })
  const doorActions = useEstimateV2DoorActions({
    store,
    doorTypeOptions: derived.catalog.doorTypeOptions,
  })
  const drywallActions = useEstimateV2DrywallActions({
    store,
    drywallRateOptions: derived.catalog.drywallRateOptions,
  })
  const otherActions = useEstimateV2OtherActions({ store })
  const settingsActions = useEstimateV2SettingsActions({ estimateId, routeFamily, store })
  const saveController = useEstimateV2SaveController({
    estimateId,
    routeFamily,
    store,
    currentSnapshot: derived.calculation.currentSnapshot,
    dirty: derived.calculation.dirty,
    effectiveJobProductDefaults,
  })

  return useEstimateV2EditorViewModels({
    estimateId,
    store,
    derived,
    roomActions,
    wallActions,
    ceilingActions,
    trimActions,
    doorActions,
    drywallActions,
    otherActions,
    settingsActions,
    save: saveController.save,
  })
}
