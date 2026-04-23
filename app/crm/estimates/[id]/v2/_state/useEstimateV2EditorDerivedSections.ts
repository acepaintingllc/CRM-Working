'use client'

import {
  estimateV2StoreSelectors,
  useEstimateV2Store,
  type EstimateV2EditorStoreApi,
} from '@/lib/estimates/v2/store/estimateV2Store'
import { useEstimateV2CalculationDerived } from './useEstimateV2CalculationDerived'
import { useEstimateV2CatalogDerived } from './useEstimateV2CatalogDerived'
import { useEstimateV2ProductLabels } from './useEstimateV2ProductLabels'
import { useEstimateV2RoomDerived } from './useEstimateV2RoomDerived'
import { useEstimateV2SaveDerived } from './useEstimateV2SaveDerived'

export type EstimateV2EditorDerivedSections = {
  catalog: ReturnType<typeof useEstimateV2CatalogDerived>
  room: ReturnType<typeof useEstimateV2RoomDerived>
  calculation: ReturnType<typeof useEstimateV2CalculationDerived>
  productLabels: ReturnType<typeof useEstimateV2ProductLabels>
  save: ReturnType<typeof useEstimateV2SaveDerived>
}

export function useEstimateV2EditorDerivedSections(params: {
  store: EstimateV2EditorStoreApi
}): EstimateV2EditorDerivedSections {
  const { store } = params
  const collections = useEstimateV2Store(store, estimateV2StoreSelectors.collections)
  const meta = useEstimateV2Store(store, estimateV2StoreSelectors.meta)

  const selectedRoom =
    collections.rooms.find((room) => room.roomId === meta.selectedRoomId) ?? null
  const catalog = useEstimateV2CatalogDerived({
    collections,
    meta,
    selectedRoom,
  })
  const room = useEstimateV2RoomDerived({
    collections,
    meta,
    wallProductionRateById: catalog.wallProductionRateById,
    roomFlagById: catalog.roomFlagById,
  })
  const calculation = useEstimateV2CalculationDerived({
    collections,
    meta,
    selectedRoom: room.selectedRoom,
    firstScope: room.firstScope,
    selectedRoomCeilingScopes: room.selectedRoomCeilingScopes,
    selectedRoomTrimScopes: room.selectedRoomTrimScopes,
  })
  const productLabels = useEstimateV2ProductLabels({
    meta,
    productLabelById: catalog.productLabelById,
    firstScope: room.firstScope,
    firstCeilingScope: room.firstCeilingScope,
    firstTrimScope: room.firstTrimScope,
  })
  const save = useEstimateV2SaveDerived({
    meta,
    dirty: calculation.dirty,
  })

  return {
    catalog,
    room,
    calculation,
    productLabels,
    save,
  }
}
