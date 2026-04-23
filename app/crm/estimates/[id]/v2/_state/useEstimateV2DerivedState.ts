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

  const sections: EstimateV2EditorDerivedSections = {
    catalog: catalogDerived,
    room: roomDerived,
    calculation: calculationDerived,
    productLabels: productLabelDerived,
    save: saveDerived,
  }

  return {
    sections,
    wallProductionRates: sections.catalog.wallProductionRates,
    trimProductionRates: sections.catalog.trimProductionRates,
    wallProductionRateById: sections.catalog.wallProductionRateById,
    trimTypeOptions: sections.catalog.trimTypeOptions,
    roomFlagById: sections.catalog.roomFlagById,
    roomModeById: sections.room.roomModeById,
    selectedRoom: sections.room.selectedRoom,
    roomScopeByRoomId: sections.room.roomScopeByRoomId,
    roomCeilingScopeByRoomId: sections.room.roomCeilingScopeByRoomId,
    roomTrimScopeByRoomId: sections.room.roomTrimScopeByRoomId,
    selectedRoomScopes: sections.room.selectedRoomScopes,
    selectedRoomCeilingScopes: sections.room.selectedRoomCeilingScopes,
    selectedRoomTrimScopes: sections.room.selectedRoomTrimScopes,
    firstScope: sections.room.firstScope,
    firstCeilingScope: sections.room.firstCeilingScope,
    firstTrimScope: sections.room.firstTrimScope,
    wallsIncluded: sections.room.wallsIncluded,
    ceilingsIncluded: sections.room.ceilingsIncluded,
    trimsIncluded: sections.room.trimsIncluded,
    jobTrimsIncluded: sections.room.jobTrimsIncluded,
    selectedRoomResolvedMode: sections.room.selectedRoomResolvedMode,
    selectedRoomGeometryMode: sections.room.selectedRoomGeometryMode,
    roomComplexityFactorByRoomId: sections.room.roomComplexityFactorByRoomId,
    roomWallFlagFactorByRoomId: sections.room.roomWallFlagFactorByRoomId,
    roomCeilingFlagFactorByRoomId: sections.room.roomCeilingFlagFactorByRoomId,
    roomTrimFlagFactorByRoomId: sections.room.roomTrimFlagFactorByRoomId,
    roomHeightFactorByRoomId: sections.room.roomHeightFactorByRoomId,
    displayedSegmentEffectiveAreaById: sections.calculation.displayedSegmentEffectiveAreaById,
    displayedScopeEffectiveAreaById: sections.calculation.displayedScopeEffectiveAreaById,
    displayedRoomEffectiveAreaByRoomId: sections.calculation.displayedRoomEffectiveAreaByRoomId,
    selectedCeilingEffectiveSqFt: sections.calculation.selectedCeilingEffectiveSqFt,
    trimScopeEffectiveMeasurementById: sections.calculation.trimScopeEffectiveMeasurementById,
    trimScopeEffectiveTotalById: sections.calculation.trimScopeEffectiveTotalById,
    totalEffectiveAreaSqFt: sections.calculation.totalEffectiveAreaSqFt,
    selectedRoomEffectiveSqFt: sections.calculation.selectedRoomEffectiveSqFt,
    selectedScopeEffectiveSqFt: sections.calculation.selectedScopeEffectiveSqFt,
    activeRoomFlagCount: sections.room.activeRoomFlagCount,
    selectedRoomIssueCount: sections.room.selectedRoomIssueCount,
    colorCodeOptions: sections.catalog.colorCodeOptions,
    defaultColorCodeId: sections.catalog.defaultColorCodeId,
    productLabelById: sections.catalog.productLabelById,
    allPaintProducts: sections.catalog.allPaintProducts,
    allPrimerProducts: sections.catalog.allPrimerProducts,
    paintOptions: sections.catalog.paintOptions,
    wallPaintOptions: sections.catalog.wallPaintOptions,
    ceilingPaintOptions: sections.catalog.ceilingPaintOptions,
    trimPaintOptions: sections.catalog.trimPaintOptions,
    wallPrimerOptions: sections.catalog.wallPrimerOptions,
    ceilingPrimerOptions: sections.catalog.ceilingPrimerOptions,
    trimPrimerOptions: sections.catalog.trimPrimerOptions,
    roomTypeOptions: sections.catalog.roomTypeOptions,
    calculationsStale: sections.calculation.calculationsStale,
    wallPaintLabel: sections.productLabels.wallPaintLabel,
    wallPrimerLabel: sections.productLabels.wallPrimerLabel,
    ceilingPaintLabel: sections.productLabels.ceilingPaintLabel,
    ceilingPrimerLabel: sections.productLabels.ceilingPrimerLabel,
    trimPaintLabel: sections.productLabels.trimPaintLabel,
    trimPrimerLabel: sections.productLabels.trimPrimerLabel,
    selectedTrimSubtotal: sections.calculation.selectedTrimSubtotal,
    selectedTrimMeasurement: sections.calculation.selectedTrimMeasurement,
    saveStatusText: sections.save.saveStatusText,
    saveStatusColor: sections.save.saveStatusColor,
    orgWallPaintLabel: sections.productLabels.orgWallPaintLabel,
    orgWallPrimerLabel: sections.productLabels.orgWallPrimerLabel,
    orgCeilingPaintLabel: sections.productLabels.orgCeilingPaintLabel,
    orgCeilingPrimerLabel: sections.productLabels.orgCeilingPrimerLabel,
    orgTrimPaintLabel: sections.productLabels.orgTrimPaintLabel,
    orgTrimPrimerLabel: sections.productLabels.orgTrimPrimerLabel,
    effectiveWallPaintLabel: sections.productLabels.effectiveWallPaintLabel,
    effectiveWallPrimerLabel: sections.productLabels.effectiveWallPrimerLabel,
    effectiveCeilingPaintLabel: sections.productLabels.effectiveCeilingPaintLabel,
    effectiveCeilingPrimerLabel: sections.productLabels.effectiveCeilingPrimerLabel,
    effectiveTrimPaintLabel: sections.productLabels.effectiveTrimPaintLabel,
    effectiveTrimPrimerLabel: sections.productLabels.effectiveTrimPrimerLabel,
    dirty: sections.calculation.dirty,
    currentSnapshot: sections.calculation.currentSnapshot,
    currentPayload: sections.calculation.currentPayload,
    useLocalPreviewCalculations: sections.calculation.useLocalPreviewCalculations,
  }
}
