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

export function useEstimateV2DerivedState(params: { store: EstimateV2EditorStoreApi }) {
  const { store } = params
  const collections = useEstimateV2Store(store, estimateV2StoreSelectors.collections)
  const meta = useEstimateV2Store(store, estimateV2StoreSelectors.meta)

  const initialSelectedRoom =
    collections.rooms.find((room) => room.roomId === meta.selectedRoomId) ?? null
  const catalog = useEstimateV2CatalogDerived({
    collections,
    meta,
    selectedRoom: initialSelectedRoom,
  })
  const rooms = useEstimateV2RoomDerived({
    collections,
    meta,
    wallProductionRateById: catalog.wallProductionRateById,
    roomFlagById: catalog.roomFlagById,
  })
  const calculations = useEstimateV2CalculationDerived({
    collections,
    meta,
    selectedRoom: rooms.selectedRoom,
    firstScope: rooms.firstScope,
    selectedRoomCeilingScopes: rooms.selectedRoomCeilingScopes,
    selectedRoomTrimScopes: rooms.selectedRoomTrimScopes,
  })
  const productLabels = useEstimateV2ProductLabels({
    meta,
    productLabelById: catalog.productLabelById,
    firstScope: rooms.firstScope,
    firstCeilingScope: rooms.firstCeilingScope,
    firstTrimScope: rooms.firstTrimScope,
  })
  const save = useEstimateV2SaveDerived({
    meta,
    dirty: calculations.dirty,
  })

  return {
    wallProductionRates: catalog.wallProductionRates,
    trimProductionRates: catalog.trimProductionRates,
    wallProductionRateById: catalog.wallProductionRateById,
    trimTypeOptions: catalog.trimTypeOptions,
    roomFlagById: catalog.roomFlagById,
    roomModeById: rooms.roomModeById,
    selectedRoom: rooms.selectedRoom,
    roomScopeByRoomId: rooms.roomScopeByRoomId,
    roomCeilingScopeByRoomId: rooms.roomCeilingScopeByRoomId,
    roomTrimScopeByRoomId: rooms.roomTrimScopeByRoomId,
    selectedRoomScopes: rooms.selectedRoomScopes,
    selectedRoomCeilingScopes: rooms.selectedRoomCeilingScopes,
    selectedRoomTrimScopes: rooms.selectedRoomTrimScopes,
    firstScope: rooms.firstScope,
    firstCeilingScope: rooms.firstCeilingScope,
    firstTrimScope: rooms.firstTrimScope,
    wallsIncluded: rooms.wallsIncluded,
    ceilingsIncluded: rooms.ceilingsIncluded,
    trimsIncluded: rooms.trimsIncluded,
    jobTrimsIncluded: rooms.jobTrimsIncluded,
    selectedRoomResolvedMode: rooms.selectedRoomResolvedMode,
    selectedRoomGeometryMode: rooms.selectedRoomGeometryMode,
    roomComplexityFactorByRoomId: rooms.roomComplexityFactorByRoomId,
    roomWallFlagFactorByRoomId: rooms.roomWallFlagFactorByRoomId,
    roomCeilingFlagFactorByRoomId: rooms.roomCeilingFlagFactorByRoomId,
    roomTrimFlagFactorByRoomId: rooms.roomTrimFlagFactorByRoomId,
    roomHeightFactorByRoomId: rooms.roomHeightFactorByRoomId,
    displayedSegmentEffectiveAreaById: calculations.displayedSegmentEffectiveAreaById,
    displayedScopeEffectiveAreaById: calculations.displayedScopeEffectiveAreaById,
    displayedRoomEffectiveAreaByRoomId: calculations.displayedRoomEffectiveAreaByRoomId,
    selectedCeilingEffectiveSqFt: calculations.selectedCeilingEffectiveSqFt,
    trimScopeEffectiveMeasurementById: calculations.trimScopeEffectiveMeasurementById,
    trimScopeEffectiveTotalById: calculations.trimScopeEffectiveTotalById,
    totalEffectiveAreaSqFt: calculations.totalEffectiveAreaSqFt,
    selectedRoomEffectiveSqFt: calculations.selectedRoomEffectiveSqFt,
    selectedScopeEffectiveSqFt: calculations.selectedScopeEffectiveSqFt,
    activeRoomFlagCount: rooms.activeRoomFlagCount,
    selectedRoomIssueCount: rooms.selectedRoomIssueCount,
    colorCodeOptions: catalog.colorCodeOptions,
    defaultColorCodeId: catalog.defaultColorCodeId,
    productLabelById: catalog.productLabelById,
    allPaintProducts: catalog.allPaintProducts,
    allPrimerProducts: catalog.allPrimerProducts,
    paintOptions: catalog.paintOptions,
    wallPaintOptions: catalog.wallPaintOptions,
    ceilingPaintOptions: catalog.ceilingPaintOptions,
    trimPaintOptions: catalog.trimPaintOptions,
    wallPrimerOptions: catalog.wallPrimerOptions,
    ceilingPrimerOptions: catalog.ceilingPrimerOptions,
    trimPrimerOptions: catalog.trimPrimerOptions,
    roomTypeOptions: catalog.roomTypeOptions,
    calculationsStale: calculations.calculationsStale,
    wallPaintLabel: productLabels.wallPaintLabel,
    wallPrimerLabel: productLabels.wallPrimerLabel,
    ceilingPaintLabel: productLabels.ceilingPaintLabel,
    ceilingPrimerLabel: productLabels.ceilingPrimerLabel,
    trimPaintLabel: productLabels.trimPaintLabel,
    trimPrimerLabel: productLabels.trimPrimerLabel,
    selectedTrimSubtotal: calculations.selectedTrimSubtotal,
    selectedTrimMeasurement: calculations.selectedTrimMeasurement,
    saveStatusText: save.saveStatusText,
    saveStatusColor: save.saveStatusColor,
    orgWallPaintLabel: productLabels.orgWallPaintLabel,
    orgWallPrimerLabel: productLabels.orgWallPrimerLabel,
    orgCeilingPaintLabel: productLabels.orgCeilingPaintLabel,
    orgCeilingPrimerLabel: productLabels.orgCeilingPrimerLabel,
    orgTrimPaintLabel: productLabels.orgTrimPaintLabel,
    orgTrimPrimerLabel: productLabels.orgTrimPrimerLabel,
    effectiveWallPaintLabel: productLabels.effectiveWallPaintLabel,
    effectiveWallPrimerLabel: productLabels.effectiveWallPrimerLabel,
    effectiveCeilingPaintLabel: productLabels.effectiveCeilingPaintLabel,
    effectiveCeilingPrimerLabel: productLabels.effectiveCeilingPrimerLabel,
    effectiveTrimPaintLabel: productLabels.effectiveTrimPaintLabel,
    effectiveTrimPrimerLabel: productLabels.effectiveTrimPrimerLabel,
    dirty: calculations.dirty,
    currentSnapshot: calculations.currentSnapshot,
    currentPayload: calculations.currentPayload,
    useLocalPreviewCalculations: calculations.useLocalPreviewCalculations,
  }
}
