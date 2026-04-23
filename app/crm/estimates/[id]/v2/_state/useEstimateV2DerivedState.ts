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

  // Catalog room-type fallback depends on the currently selected room draft.
  const initialSelectedRoom =
    collections.rooms.find((room) => room.roomId === meta.selectedRoomId) ?? null
  const catalogDerived = useEstimateV2CatalogDerived({
    collections,
    meta,
    selectedRoom: initialSelectedRoom,
  })
  const roomDerived = useEstimateV2RoomDerived({
    collections,
    meta,
    wallProductionRateById: catalogDerived.wallProductionRateById,
    roomFlagById: catalogDerived.roomFlagById,
  })
  const calculationDerived = useEstimateV2CalculationDerived({
    collections,
    meta,
    selectedRoom: roomDerived.selectedRoom,
    firstScope: roomDerived.firstScope,
    selectedRoomCeilingScopes: roomDerived.selectedRoomCeilingScopes,
    selectedRoomTrimScopes: roomDerived.selectedRoomTrimScopes,
  })
  const productLabelDerived = useEstimateV2ProductLabels({
    meta,
    productLabelById: catalogDerived.productLabelById,
    firstScope: roomDerived.firstScope,
    firstCeilingScope: roomDerived.firstCeilingScope,
    firstTrimScope: roomDerived.firstTrimScope,
  })
  const saveDerived = useEstimateV2SaveDerived({
    meta,
    dirty: calculationDerived.dirty,
  })

  const derivedSections = {
    catalog: catalogDerived,
    room: roomDerived,
    calculation: calculationDerived,
    productLabels: productLabelDerived,
    save: saveDerived,
  }

  return {
    wallProductionRates: derivedSections.catalog.wallProductionRates,
    trimProductionRates: derivedSections.catalog.trimProductionRates,
    wallProductionRateById: derivedSections.catalog.wallProductionRateById,
    trimTypeOptions: derivedSections.catalog.trimTypeOptions,
    roomFlagById: derivedSections.catalog.roomFlagById,
    roomModeById: derivedSections.room.roomModeById,
    selectedRoom: derivedSections.room.selectedRoom,
    roomScopeByRoomId: derivedSections.room.roomScopeByRoomId,
    roomCeilingScopeByRoomId: derivedSections.room.roomCeilingScopeByRoomId,
    roomTrimScopeByRoomId: derivedSections.room.roomTrimScopeByRoomId,
    selectedRoomScopes: derivedSections.room.selectedRoomScopes,
    selectedRoomCeilingScopes: derivedSections.room.selectedRoomCeilingScopes,
    selectedRoomTrimScopes: derivedSections.room.selectedRoomTrimScopes,
    firstScope: derivedSections.room.firstScope,
    firstCeilingScope: derivedSections.room.firstCeilingScope,
    firstTrimScope: derivedSections.room.firstTrimScope,
    wallsIncluded: derivedSections.room.wallsIncluded,
    ceilingsIncluded: derivedSections.room.ceilingsIncluded,
    trimsIncluded: derivedSections.room.trimsIncluded,
    jobTrimsIncluded: derivedSections.room.jobTrimsIncluded,
    selectedRoomResolvedMode: derivedSections.room.selectedRoomResolvedMode,
    selectedRoomGeometryMode: derivedSections.room.selectedRoomGeometryMode,
    roomComplexityFactorByRoomId: derivedSections.room.roomComplexityFactorByRoomId,
    roomWallFlagFactorByRoomId: derivedSections.room.roomWallFlagFactorByRoomId,
    roomCeilingFlagFactorByRoomId: derivedSections.room.roomCeilingFlagFactorByRoomId,
    roomTrimFlagFactorByRoomId: derivedSections.room.roomTrimFlagFactorByRoomId,
    roomHeightFactorByRoomId: derivedSections.room.roomHeightFactorByRoomId,
    displayedSegmentEffectiveAreaById: derivedSections.calculation.displayedSegmentEffectiveAreaById,
    displayedScopeEffectiveAreaById: derivedSections.calculation.displayedScopeEffectiveAreaById,
    displayedRoomEffectiveAreaByRoomId:
      derivedSections.calculation.displayedRoomEffectiveAreaByRoomId,
    selectedCeilingEffectiveSqFt: derivedSections.calculation.selectedCeilingEffectiveSqFt,
    trimScopeEffectiveMeasurementById:
      derivedSections.calculation.trimScopeEffectiveMeasurementById,
    trimScopeEffectiveTotalById: derivedSections.calculation.trimScopeEffectiveTotalById,
    totalEffectiveAreaSqFt: derivedSections.calculation.totalEffectiveAreaSqFt,
    selectedRoomEffectiveSqFt: derivedSections.calculation.selectedRoomEffectiveSqFt,
    selectedScopeEffectiveSqFt: derivedSections.calculation.selectedScopeEffectiveSqFt,
    activeRoomFlagCount: derivedSections.room.activeRoomFlagCount,
    selectedRoomIssueCount: derivedSections.room.selectedRoomIssueCount,
    colorCodeOptions: derivedSections.catalog.colorCodeOptions,
    defaultColorCodeId: derivedSections.catalog.defaultColorCodeId,
    productLabelById: derivedSections.catalog.productLabelById,
    allPaintProducts: derivedSections.catalog.allPaintProducts,
    allPrimerProducts: derivedSections.catalog.allPrimerProducts,
    paintOptions: derivedSections.catalog.paintOptions,
    wallPaintOptions: derivedSections.catalog.wallPaintOptions,
    ceilingPaintOptions: derivedSections.catalog.ceilingPaintOptions,
    trimPaintOptions: derivedSections.catalog.trimPaintOptions,
    wallPrimerOptions: derivedSections.catalog.wallPrimerOptions,
    ceilingPrimerOptions: derivedSections.catalog.ceilingPrimerOptions,
    trimPrimerOptions: derivedSections.catalog.trimPrimerOptions,
    roomTypeOptions: derivedSections.catalog.roomTypeOptions,
    calculationsStale: derivedSections.calculation.calculationsStale,
    wallPaintLabel: derivedSections.productLabels.wallPaintLabel,
    wallPrimerLabel: derivedSections.productLabels.wallPrimerLabel,
    ceilingPaintLabel: derivedSections.productLabels.ceilingPaintLabel,
    ceilingPrimerLabel: derivedSections.productLabels.ceilingPrimerLabel,
    trimPaintLabel: derivedSections.productLabels.trimPaintLabel,
    trimPrimerLabel: derivedSections.productLabels.trimPrimerLabel,
    selectedTrimSubtotal: derivedSections.calculation.selectedTrimSubtotal,
    selectedTrimMeasurement: derivedSections.calculation.selectedTrimMeasurement,
    saveStatusText: derivedSections.save.saveStatusText,
    saveStatusColor: derivedSections.save.saveStatusColor,
    orgWallPaintLabel: derivedSections.productLabels.orgWallPaintLabel,
    orgWallPrimerLabel: derivedSections.productLabels.orgWallPrimerLabel,
    orgCeilingPaintLabel: derivedSections.productLabels.orgCeilingPaintLabel,
    orgCeilingPrimerLabel: derivedSections.productLabels.orgCeilingPrimerLabel,
    orgTrimPaintLabel: derivedSections.productLabels.orgTrimPaintLabel,
    orgTrimPrimerLabel: derivedSections.productLabels.orgTrimPrimerLabel,
    effectiveWallPaintLabel: derivedSections.productLabels.effectiveWallPaintLabel,
    effectiveWallPrimerLabel: derivedSections.productLabels.effectiveWallPrimerLabel,
    effectiveCeilingPaintLabel: derivedSections.productLabels.effectiveCeilingPaintLabel,
    effectiveCeilingPrimerLabel: derivedSections.productLabels.effectiveCeilingPrimerLabel,
    effectiveTrimPaintLabel: derivedSections.productLabels.effectiveTrimPaintLabel,
    effectiveTrimPrimerLabel: derivedSections.productLabels.effectiveTrimPrimerLabel,
    dirty: derivedSections.calculation.dirty,
    currentSnapshot: derivedSections.calculation.currentSnapshot,
    currentPayload: derivedSections.calculation.currentPayload,
    useLocalPreviewCalculations: derivedSections.calculation.useLocalPreviewCalculations,
  }
}
