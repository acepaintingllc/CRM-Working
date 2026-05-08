'use client'

import { useMemo } from 'react'
import {
  estimateV2StoreSelectors,
  useEstimateV2Store,
  type EstimateV2EditorStoreApi,
} from '@/lib/estimates/v2/store/estimateV2Store'
import { toDisplayNumber } from '../_lib/estimateV2EditorNormalize'
import { setConditionSelection, type EstimateV2ConditionLevel } from '@/lib/estimator/conditionModifiers'
import {
  buildCalculationState,
  buildHeaderSubtitle,
  buildIncludedScopeLabels,
  buildRoomSubtitle,
  buildRunningTotalLabel,
  buildScopeToggleLabels,
  buildSectionSummaryChips,
  buildSectionSummaryVm,
  buildValidationState,
} from '../_lib/estimateV2EditorPresentation'
import type {
  EstimateV2EditorActiveScopeTotalVm,
  EstimateV2EditorCeilingsVm,
  EstimateV2EditorDoorsVm,
  EstimateV2EditorHeaderVm,
  EstimateV2EditorPageVm,
  EstimateV2EditorRoomVm,
  EstimateV2EditorSaveVm,
  EstimateV2EditorSettingsVm,
  EstimateV2EditorSummaryVm,
  EstimateV2EditorTrimVm,
  EstimateV2EditorWallsVm,
} from './estimateV2EditorTypes'
import type { EstimateV2EditorDerivedSections } from './useEstimateV2EditorDerivedSections'

export type EstimateV2EditorViewModelParams = {
  estimateId?: string
  catalogsReloading?: boolean
  store: EstimateV2EditorStoreApi
  derived: EstimateV2EditorDerivedSections
  roomActions: ReturnType<typeof import('./useEstimateV2RoomActions').useEstimateV2RoomActions>
  wallActions: ReturnType<typeof import('./useEstimateV2WallActions').useEstimateV2WallActions>
  ceilingActions: ReturnType<typeof import('./useEstimateV2CeilingActions').useEstimateV2CeilingActions>
  trimActions: ReturnType<typeof import('./useEstimateV2TrimActions').useEstimateV2TrimActions>
  doorActions: ReturnType<typeof import('./useEstimateV2DoorActions').useEstimateV2DoorActions>
  drywallActions?: ReturnType<typeof import('./useEstimateV2DrywallActions').useEstimateV2DrywallActions>
  otherActions?: ReturnType<typeof import('./useEstimateV2OtherActions').useEstimateV2OtherActions>
  settingsActions: ReturnType<
    typeof import('./useEstimateV2SettingsActions').useEstimateV2SettingsActions
  >
  save: ReturnType<typeof import('./useEstimateV2SaveController').useEstimateV2SaveController>['save']
  saveDraft: ReturnType<typeof import('./useEstimateV2SaveController').useEstimateV2SaveController>['saveDraft']
  saveAndContinue: ReturnType<typeof import('./useEstimateV2SaveController').useEstimateV2SaveController>['saveAndContinue']
}

function usePageVm(
  store: EstimateV2EditorStoreApi,
  derived: EstimateV2EditorDerivedSections,
  catalogsReloading: boolean
): EstimateV2EditorPageVm {
  const pageState = useEstimateV2Store(store, (state) => ({
    loading: state.meta.loading,
    saving: state.meta.saving,
    error: state.meta.error,
    catalogsError: state.meta.catalogsError,
    roomsCount: state.collections.rooms.length,
  }))

  return useMemo(
    () => ({
      loading: pageState.loading,
      saving: pageState.saving,
      error: pageState.error,
      catalogsError: pageState.catalogsError ?? null,
      configurationWarning: derived.productLabels.configurationWarning,
      catalogsReloading,
      validationIssues: derived.save.visibleValidationIssues,
      emptySelectionMessage: 'Add a room or select one from the roster to start editing room inputs.',
      roomsCount: pageState.roomsCount,
    }),
    [
      catalogsReloading,
      derived.productLabels.configurationWarning,
      derived.save.visibleValidationIssues,
      pageState.catalogsError,
      pageState.error,
      pageState.loading,
      pageState.roomsCount,
      pageState.saving,
    ]
  )
}

function useHeaderVm(
  estimateId: string | undefined,
  store: EstimateV2EditorStoreApi,
  derived: EstimateV2EditorDerivedSections,
  addRoom: () => void
): EstimateV2EditorHeaderVm {
  const headerState = useEstimateV2Store(store, (state) => ({
    estimate: state.meta.estimate,
    job: state.meta.job,
    saving: state.meta.saving,
    settingsOpen: state.meta.settingsOpen,
  }))
  const setSettingsOpen = useEstimateV2Store(
    store,
    estimateV2StoreSelectors.meta
  ).setSettingsOpen

  return useMemo(
    () => ({
      estimateId,
      resumeRecord: {
        estimate: headerState.estimate,
        job: headerState.job,
      },
      titleText: headerState.estimate?.version_name ?? 'Estimate Version',
      subtitleText: buildHeaderSubtitle(headerState.job),
      workflowText: 'Walls-first wizard - Rooms',
      dirtyStateText: derived.save.saveStatusText,
      dirtyStateColor: derived.save.saveStatusColor,
      dirty: derived.calculation.dirty,
      saving: headerState.saving,
      settingsOpen: headerState.settingsOpen,
      toggleSettings: () => setSettingsOpen((open) => !open),
      addRoom,
    }),
    [
      addRoom,
      derived.calculation.dirty,
      derived.save.saveStatusColor,
      derived.save.saveStatusText,
      estimateId,
      headerState.estimate,
      headerState.job,
      headerState.saving,
      headerState.settingsOpen,
      setSettingsOpen,
    ]
  )
}

function useRoomVm(
  store: EstimateV2EditorStoreApi,
  derived: EstimateV2EditorDerivedSections,
  roomActions: EstimateV2EditorViewModelParams['roomActions']
): EstimateV2EditorRoomVm {
  const roomState = useEstimateV2Store(store, (state) => ({
    rooms: state.collections.rooms,
    roomFlags: state.collections.roomFlags,
    selectedRoomId: state.meta.selectedRoomId,
    catalogsError: state.meta.catalogsError,
    roomFlagsCatalog: state.meta.catalogs.room_flags,
  }))
  const setSelectedRoomId = useEstimateV2Store(store, estimateV2StoreSelectors.meta).setSelectedRoomId
  const {
    addRoom,
    deleteRoom,
    updateRoom,
    updateRoomComplexity,
    toggleFlag,
    handleRoomDimChange,
    switchRoomGeometryMode,
  } = roomActions

  return useMemo(
    () => ({
      rooms: roomState.rooms,
      selectedRoomId: roomState.selectedRoomId,
      setSelectedRoomId,
      selectedRoom: derived.room.selectedRoom,
      selectedRoomResolvedMode: derived.room.selectedRoomResolvedMode,
      selectedRoomGeometryMode: derived.room.selectedRoomGeometryMode,
      roomTypeOptions: derived.catalog.roomTypeOptions,
      roomTypeCatalogStatus: roomState.catalogsError
        ? 'error'
        : derived.catalog.roomTypeOptions.length > 0
          ? 'ready'
          : 'empty',
      roomFlags: roomState.roomFlags,
      roomScopeByRoomId: derived.room.roomScopeByRoomId,
      roomCeilingScopeByRoomId: derived.room.roomCeilingScopeByRoomId,
      roomTrimScopeByRoomId: derived.room.roomTrimScopeByRoomId,
      roomDoorScopeByRoomId: derived.room.roomDoorScopeByRoomId,
      displayedRoomEffectiveAreaByRoomId: derived.calculation.displayedRoomEffectiveAreaByRoomId,
      selectedRoomEffectiveSqFt: derived.calculation.selectedRoomEffectiveSqFt,
      activeRoomFlagCount: derived.room.activeRoomFlagCount,
      selectedRoomIssueCount: derived.room.selectedRoomIssueCount,
      roomFlagsEnabled: roomState.roomFlagsCatalog.length > 0,
      roomFlagsCatalog: roomState.roomFlagsCatalog,
      conditionModifiers: derived.catalog.conditionModifiers,
      addRoom,
      deleteRoom,
      updateRoom,
      updateRoomComplexity,
      toggleFlag,
      handleRoomDimChange,
      switchRoomGeometryMode,
      updateSelectedRoom: (patch) => {
        if (!derived.room.selectedRoom) return
        updateRoom(derived.room.selectedRoom.roomId, patch)
      },
      deleteSelectedRoom: () => {
        if (!derived.room.selectedRoom) return
        deleteRoom(derived.room.selectedRoom.roomId)
      },
      toggleSelectedRoomFlag: (flagId) => {
        if (!derived.room.selectedRoom) return
        toggleFlag(derived.room.selectedRoom.roomId, flagId)
      },
      updateSelectedRoomDimensions: (field, value) => {
        if (!derived.room.selectedRoom) return
        handleRoomDimChange(derived.room.selectedRoom.roomId, field, value)
      },
      switchSelectedRoomGeometryMode: (nextMode) => {
        if (!derived.room.selectedRoom) return
        switchRoomGeometryMode(derived.room.selectedRoom.roomId, nextMode)
      },
      setSelectedRoomCondition: (conditionId, level) => {
        if (!derived.room.selectedRoom) return
        updateRoom(derived.room.selectedRoom.roomId, {
          conditionSelections: setConditionSelection(
            derived.room.selectedRoom.conditionSelections,
            conditionId,
            level
          ),
        })
      },
    }),
    [
      addRoom,
      deleteRoom,
      derived.calculation.displayedRoomEffectiveAreaByRoomId,
      derived.calculation.selectedRoomEffectiveSqFt,
      derived.catalog.roomTypeOptions,
      derived.catalog.conditionModifiers,
      derived.room.activeRoomFlagCount,
      derived.room.roomCeilingScopeByRoomId,
      derived.room.roomDoorScopeByRoomId,
      derived.room.roomScopeByRoomId,
      derived.room.roomTrimScopeByRoomId,
      derived.room.selectedRoom,
      derived.room.selectedRoomGeometryMode,
      derived.room.selectedRoomIssueCount,
      derived.room.selectedRoomResolvedMode,
      handleRoomDimChange,
      roomState.roomFlags,
      roomState.roomFlagsCatalog,
      roomState.rooms,
      roomState.selectedRoomId,
      roomState.catalogsError,
      setSelectedRoomId,
      switchRoomGeometryMode,
      toggleFlag,
      updateRoom,
      updateRoomComplexity,
    ]
  )
}

function useWallsVm(
  store: EstimateV2EditorStoreApi,
  derived: EstimateV2EditorDerivedSections,
  wallActions: EstimateV2EditorViewModelParams['wallActions'],
  drywallActions: NonNullable<EstimateV2EditorViewModelParams['drywallActions']>,
  updateRoomComplexity: (roomId: string, wallComplexityId: string) => void
): EstimateV2EditorWallsVm {
  const segments = useEstimateV2Store(store, (state) => state.collections.segments)

  return useMemo(
    () => ({
      selectedRoom: derived.room.selectedRoom,
      selectedRoomGeometryMode: derived.room.selectedRoomGeometryMode,
      selectedRoomScopes: derived.room.selectedRoomScopes,
      firstScope: derived.room.firstScope,
      segments,
      wallsIncluded: derived.room.wallsIncluded,
      wallPaintLabel: derived.productLabels.wallPaintLabel,
      wallPrimerLabel: derived.productLabels.wallPrimerLabel,
      effectiveWallPaintLabel: derived.productLabels.effectiveWallPaintLabel,
      effectiveWallPrimerLabel: derived.productLabels.effectiveWallPrimerLabel,
      wallPaintOptions: derived.catalog.wallPaintOptions,
      wallPrimerOptions: derived.catalog.wallPrimerOptions,
      wallProductionRates: derived.catalog.wallProductionRates,
      colorCodeOptions: derived.catalog.colorCodeOptions,
      displayedSegmentEffectiveAreaById: derived.calculation.displayedSegmentEffectiveAreaById,
      displayedScopeEffectiveAreaById: derived.calculation.displayedScopeEffectiveAreaById,
      wallScopeEffectiveTotalById: derived.calculation.wallScopeEffectiveTotalById,
      selectedRoomWallDrywallRepairs: derived.room.selectedRoomWallDrywallRepairs,
      drywallRateOptions: derived.catalog.drywallRateOptions,
      drywallRepairEffectiveQuantityById: derived.calculation.drywallRepairEffectiveQuantityById,
      drywallRepairEffectiveTotalById: derived.calculation.drywallRepairEffectiveTotalById,
      selectedWallDrywallSubtotal: derived.calculation.selectedWallDrywallSubtotal,
      addDrywallRepair: drywallActions.addRepair,
      updateDrywallRepair: (repairId, patch) => {
        if (patch.repairType) drywallActions.updateRepairType(repairId, patch.repairType)
        else drywallActions.updateRepair(repairId, patch)
      },
      deleteDrywallRepair: drywallActions.deleteRepair,
      addScope: wallActions.addScope,
      moveScope: wallActions.moveScope,
      deleteScope: wallActions.deleteScope,
      updateScope: wallActions.updateScope,
      addSegment: wallActions.addSegment,
      moveSegment: wallActions.moveSegment,
      deleteSegment: wallActions.deleteSegment,
      updateSegment: wallActions.updateSegment,
      toggleRoomInclude: wallActions.toggleRoomInclude,
      updateRoomComplexity,
      conditionModifiers: derived.catalog.conditionModifiers,
      conditionSelections: derived.room.firstScope?.conditionSelections ?? {},
      setSelectedRoomWallCondition: (conditionId: string, level: EstimateV2ConditionLevel | 'none') => {
        const baseSelections = derived.room.firstScope?.conditionSelections ?? {}
        const nextSelections = setConditionSelection(baseSelections, conditionId, level)
        for (const scope of derived.room.selectedRoomScopes) {
          wallActions.updateScope(scope.id, { conditionSelections: nextSelections })
        }
      },
    }),
    [
      derived.calculation.displayedScopeEffectiveAreaById,
      derived.calculation.displayedSegmentEffectiveAreaById,
      derived.calculation.drywallRepairEffectiveQuantityById,
      derived.calculation.drywallRepairEffectiveTotalById,
      derived.calculation.selectedWallDrywallSubtotal,
      derived.calculation.wallScopeEffectiveTotalById,
      derived.catalog.colorCodeOptions,
      derived.catalog.conditionModifiers,
      derived.catalog.drywallRateOptions,
      derived.catalog.wallPaintOptions,
      derived.catalog.wallPrimerOptions,
      derived.catalog.wallProductionRates,
      derived.productLabels.effectiveWallPaintLabel,
      derived.productLabels.effectiveWallPrimerLabel,
      derived.productLabels.wallPaintLabel,
      derived.productLabels.wallPrimerLabel,
      derived.room.firstScope,
      derived.room.selectedRoom,
      derived.room.selectedRoomGeometryMode,
      derived.room.selectedRoomScopes,
      derived.room.selectedRoomWallDrywallRepairs,
      derived.room.wallsIncluded,
      drywallActions,
      segments,
      updateRoomComplexity,
      wallActions,
    ]
  )
}

function useCeilingsVm(
  store: EstimateV2EditorStoreApi,
  derived: EstimateV2EditorDerivedSections,
  ceilingActions: EstimateV2EditorViewModelParams['ceilingActions'],
  drywallActions: NonNullable<EstimateV2EditorViewModelParams['drywallActions']>
): EstimateV2EditorCeilingsVm {
  const ceilingState = useEstimateV2Store(store, (state) => ({
    catalogs: state.meta.catalogs,
    ceilingSegments: state.collections.ceilingSegments,
  }))

  return useMemo(
    () => ({
      catalogs: ceilingState.catalogs,
      selectedRoom: derived.room.selectedRoom,
      selectedRoomGeometryMode: derived.room.selectedRoomGeometryMode,
      selectedRoomCeilingScopes: derived.room.selectedRoomCeilingScopes,
      firstCeilingScope: derived.room.firstCeilingScope,
      ceilingSegments: ceilingState.ceilingSegments,
      ceilingsIncluded: derived.room.ceilingsIncluded,
      ceilingPaintLabel: derived.productLabels.ceilingPaintLabel,
      ceilingPrimerLabel: derived.productLabels.ceilingPrimerLabel,
      effectiveCeilingPaintLabel: derived.productLabels.effectiveCeilingPaintLabel,
      effectiveCeilingPrimerLabel: derived.productLabels.effectiveCeilingPrimerLabel,
      ceilingPaintOptions: derived.catalog.ceilingPaintOptions,
      ceilingPrimerOptions: derived.catalog.ceilingPrimerOptions,
      colorCodeOptions: derived.catalog.colorCodeOptions,
      selectedCeilingEffectiveSqFt: derived.calculation.selectedCeilingEffectiveSqFt,
      ceilingScopePreviewMetricsById: derived.calculation.ceilingScopePreviewMetricsById,
      ceilingScopeEffectiveTotalById: derived.calculation.ceilingScopeEffectiveTotalById,
      selectedRoomCeilingDrywallRepairs: derived.room.selectedRoomCeilingDrywallRepairs,
      drywallRateOptions: derived.catalog.drywallRateOptions,
      drywallRepairEffectiveQuantityById: derived.calculation.drywallRepairEffectiveQuantityById,
      drywallRepairEffectiveTotalById: derived.calculation.drywallRepairEffectiveTotalById,
      selectedCeilingDrywallSubtotal: derived.calculation.selectedCeilingDrywallSubtotal,
      addDrywallRepair: drywallActions.addRepair,
      updateDrywallRepair: (repairId, patch) => {
        if (patch.repairType) drywallActions.updateRepairType(repairId, patch.repairType)
        else drywallActions.updateRepair(repairId, patch)
      },
      deleteDrywallRepair: drywallActions.deleteRepair,
      updateScope: ceilingActions.updateScope,
      addScope: ceilingActions.addScope,
      deleteScope: ceilingActions.deleteScope,
      moveScope: ceilingActions.moveScope,
      addSegment: ceilingActions.addSegment,
      deleteSegment: ceilingActions.deleteSegment,
      moveSegment: ceilingActions.moveSegment,
      updateSegment: ceilingActions.updateSegment,
      toggleRoomInclude: ceilingActions.toggleRoomInclude,
      conditionModifiers: derived.catalog.conditionModifiers,
      conditionSelections: derived.room.firstCeilingScope?.conditionSelections ?? {},
      setSelectedRoomCeilingCondition: (conditionId: string, level: EstimateV2ConditionLevel | 'none') => {
        const baseSelections = derived.room.firstCeilingScope?.conditionSelections ?? {}
        const nextSelections = setConditionSelection(baseSelections, conditionId, level)
        for (const scope of derived.room.selectedRoomCeilingScopes) {
          ceilingActions.updateScope(scope.id, { conditionSelections: nextSelections })
        }
      },
    }),
    [
      ceilingActions,
      ceilingState.catalogs,
      ceilingState.ceilingSegments,
      derived.calculation.ceilingScopeEffectiveTotalById,
      derived.calculation.ceilingScopePreviewMetricsById,
      derived.calculation.drywallRepairEffectiveQuantityById,
      derived.calculation.drywallRepairEffectiveTotalById,
      derived.calculation.selectedCeilingDrywallSubtotal,
      derived.calculation.selectedCeilingEffectiveSqFt,
      derived.catalog.ceilingPaintOptions,
      derived.catalog.ceilingPrimerOptions,
      derived.catalog.colorCodeOptions,
      derived.catalog.conditionModifiers,
      derived.catalog.drywallRateOptions,
      derived.productLabels.ceilingPaintLabel,
      derived.productLabels.ceilingPrimerLabel,
      derived.productLabels.effectiveCeilingPaintLabel,
      derived.productLabels.effectiveCeilingPrimerLabel,
      derived.room.ceilingsIncluded,
      derived.room.firstCeilingScope,
      derived.room.selectedRoom,
      derived.room.selectedRoomCeilingScopes,
      derived.room.selectedRoomCeilingDrywallRepairs,
      derived.room.selectedRoomGeometryMode,
      drywallActions,
    ]
  )
}

function useTrimVm(
  derived: EstimateV2EditorDerivedSections,
  trimActions: EstimateV2EditorViewModelParams['trimActions']
): EstimateV2EditorTrimVm {
  return useMemo(
    () => ({
      selectedRoom: derived.room.selectedRoom,
      selectedRoomResolvedMode: derived.room.selectedRoomResolvedMode,
      selectedRoomTrimScopes: derived.room.selectedRoomTrimScopes,
      firstTrimScope: derived.room.firstTrimScope,
      trimsIncluded: derived.room.trimsIncluded,
      jobTrimsIncluded: derived.room.jobTrimsIncluded,
      trimPaintLabel: derived.productLabels.trimPaintLabel,
      trimPrimerLabel: derived.productLabels.trimPrimerLabel,
      effectiveTrimPaintLabel: derived.productLabels.effectiveTrimPaintLabel,
      effectiveTrimPrimerLabel: derived.productLabels.effectiveTrimPrimerLabel,
      trimPaintOptions: derived.catalog.trimPaintOptions,
      trimPrimerOptions: derived.catalog.trimPrimerOptions,
      trimTypeOptions: derived.catalog.trimTypeOptions,
      trimScopeEffectiveMeasurementById: derived.calculation.trimScopeEffectiveMeasurementById,
      trimScopeEffectiveTotalById: derived.calculation.trimScopeEffectiveTotalById,
      selectedTrimSubtotal: derived.calculation.selectedTrimSubtotal,
      selectedTrimMeasurement: derived.calculation.selectedTrimMeasurement,
      colorCodeOptions: derived.catalog.colorCodeOptions,
      updateScope: trimActions.updateScope,
      addScope: trimActions.addScope,
      moveScope: trimActions.moveScope,
      deleteScope: trimActions.deleteScope,
      toggleRoomInclude: trimActions.toggleRoomInclude,
      updateTrimType: trimActions.updateTrimType,
      conditionModifiers: derived.catalog.conditionModifiers,
      conditionSelections: derived.room.firstTrimScope?.conditionSelections ?? {},
      setSelectedRoomTrimCondition: (conditionId: string, level: EstimateV2ConditionLevel | 'none') => {
        const baseSelections = derived.room.firstTrimScope?.conditionSelections ?? {}
        const nextSelections = setConditionSelection(baseSelections, conditionId, level)
        for (const scope of derived.room.selectedRoomTrimScopes) {
          trimActions.updateScope(scope.id, { conditionSelections: nextSelections })
        }
      },
    }),
    [
      derived.calculation.selectedTrimMeasurement,
      derived.calculation.selectedTrimSubtotal,
      derived.calculation.trimScopeEffectiveMeasurementById,
      derived.calculation.trimScopeEffectiveTotalById,
      derived.catalog.colorCodeOptions,
      derived.catalog.conditionModifiers,
      derived.catalog.trimPaintOptions,
      derived.catalog.trimPrimerOptions,
      derived.catalog.trimTypeOptions,
      derived.productLabels.effectiveTrimPaintLabel,
      derived.productLabels.effectiveTrimPrimerLabel,
      derived.productLabels.trimPaintLabel,
      derived.productLabels.trimPrimerLabel,
      derived.room.firstTrimScope,
      derived.room.jobTrimsIncluded,
      derived.room.selectedRoom,
      derived.room.selectedRoomResolvedMode,
      derived.room.selectedRoomTrimScopes,
      derived.room.trimsIncluded,
      trimActions,
    ]
  )
}

const noopDrywallActions: NonNullable<EstimateV2EditorViewModelParams['drywallActions']> = {
  addRepair: () => undefined,
  updateRepair: () => undefined,
  updateRepairType: () => undefined,
  deleteRepair: () => undefined,
}

function formatActiveScopeQuantity(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value)
}

function formatSummaryFinancialTotal(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? 'Pending inputs' : `$${value.toFixed(2)}`
}

function formatTrimTotal(params: {
  trimMeasurement: number
  trimUnit: string | null
}) {
  if (params.trimUnit && params.trimUnit !== 'mixed') return `${formatActiveScopeQuantity(params.trimMeasurement)} ${params.trimUnit}`
  if (params.trimUnit === 'mixed') return `${formatActiveScopeQuantity(params.trimMeasurement)} mixed`
  return '0'
}

function buildActiveScopeTotalRows(
  totals: EstimateV2EditorDerivedSections['calculation']['activeScopeTotals']
): EstimateV2EditorActiveScopeTotalVm[] {
  const rows: EstimateV2EditorActiveScopeTotalVm[] = [
    {
      key: 'walls',
      label: 'Walls',
      value: `${formatActiveScopeQuantity(totals.wallsSqFt)} sf`,
    },
    {
      key: 'ceilings',
      label: 'Ceilings',
      value: `${formatActiveScopeQuantity(totals.ceilingsSqFt)} sf`,
    },
    {
      key: 'trim',
      label: 'Trim',
      value: formatTrimTotal(totals),
    },
  ]

  if (totals.doorsActive || totals.doorSides > 0 || totals.doorCount > 0) {
    rows.push({
      key: 'doors',
      label: 'Doors',
      value: `${formatActiveScopeQuantity(totals.doorSides)} sides`,
      detail: `${formatActiveScopeQuantity(totals.doorCount)} count`,
    })
  }

  return rows
}

function useDoorsVm(
  derived: EstimateV2EditorDerivedSections,
  doorActions: EstimateV2EditorViewModelParams['doorActions']
): EstimateV2EditorDoorsVm {
  return useMemo(
    () => ({
      selectedRoom: derived.room.selectedRoom,
      selectedRoomDoorScopes: derived.room.selectedRoomDoorScopes,
      firstDoorScope: derived.room.firstDoorScope,
      doorsIncluded: derived.room.doorsIncluded,
      jobDoorsIncluded: derived.room.jobDoorsIncluded,
      doorPaintLabel: derived.productLabels.doorPaintLabel,
      doorPrimerLabel: derived.productLabels.doorPrimerLabel,
      effectiveDoorPaintLabel: derived.productLabels.effectiveTrimPaintLabel,
      effectiveDoorPrimerLabel: derived.productLabels.effectiveTrimPrimerLabel,
      doorPaintOptions: derived.catalog.trimPaintOptions,
      doorPrimerOptions: derived.catalog.trimPrimerOptions,
      doorTypeOptions: derived.catalog.doorTypeOptions,
      doorScopeEffectiveUnitsById: derived.calculation.doorScopeEffectiveUnitsById,
      doorScopeEffectiveTotalById: derived.calculation.doorScopeEffectiveTotalById,
      selectedDoorSubtotal: derived.calculation.selectedDoorSubtotal,
      selectedDoorUnits: derived.calculation.selectedDoorUnits,
      colorCodeOptions: derived.catalog.colorCodeOptions,
      updateScope: doorActions.updateScope,
      addScope: doorActions.addScope,
      moveScope: doorActions.moveScope,
      deleteScope: doorActions.deleteScope,
      toggleRoomInclude: doorActions.toggleRoomInclude,
      updateDoorType: doorActions.updateDoorType,
    }),
    [
      derived.calculation.doorScopeEffectiveTotalById,
      derived.calculation.doorScopeEffectiveUnitsById,
      derived.calculation.selectedDoorSubtotal,
      derived.calculation.selectedDoorUnits,
      derived.catalog.colorCodeOptions,
      derived.catalog.doorTypeOptions,
      derived.catalog.trimPaintOptions,
      derived.catalog.trimPrimerOptions,
      derived.productLabels.doorPaintLabel,
      derived.productLabels.doorPrimerLabel,
      derived.productLabels.effectiveTrimPaintLabel,
      derived.productLabels.effectiveTrimPrimerLabel,
      derived.room.doorsIncluded,
      derived.room.firstDoorScope,
      derived.room.jobDoorsIncluded,
      derived.room.selectedRoom,
      derived.room.selectedRoomDoorScopes,
      doorActions,
    ]
  )
}

function useJobSettingsVm(
  store: EstimateV2EditorStoreApi,
  derived: EstimateV2EditorDerivedSections,
  settingsActions: EstimateV2EditorViewModelParams['settingsActions']
): EstimateV2EditorSettingsVm {
  const state = useEstimateV2Store(store, (storeState) => ({
    jobSettingsDraft: storeState.meta.jobSettingsDraft,
    orgJobProductDefaults: storeState.meta.orgJobProductDefaults,
    customerDraft: storeState.meta.customerDraft,
    settingsOpen: storeState.meta.settingsOpen,
    jobDefaultsOpen: storeState.meta.jobDefaultsOpen,
  }))
  const meta = useEstimateV2Store(store, estimateV2StoreSelectors.meta)

  return useMemo(
    () => ({
      jobSettingsDraft: state.jobSettingsDraft,
      orgJobProductDefaults: state.orgJobProductDefaults,
      customerDraft: state.customerDraft,
      settingsOpen: state.settingsOpen,
      setSettingsOpen: meta.setSettingsOpen,
      jobDefaultsOpen: state.jobDefaultsOpen,
      setJobDefaultsOpen: meta.setJobDefaultsOpen,
      wallPaintOptions: derived.catalog.wallPaintOptions,
      wallPrimerOptions: derived.catalog.wallPrimerOptions,
      ceilingPaintOptions: derived.catalog.ceilingPaintOptions,
      ceilingPrimerOptions: derived.catalog.ceilingPrimerOptions,
      trimPaintOptions: derived.catalog.trimPaintOptions,
      trimPrimerOptions: derived.catalog.trimPrimerOptions,
      orgWallPaintLabel: derived.productLabels.orgWallPaintLabel,
      orgWallPrimerLabel: derived.productLabels.orgWallPrimerLabel,
      orgCeilingPaintLabel: derived.productLabels.orgCeilingPaintLabel,
      orgCeilingPrimerLabel: derived.productLabels.orgCeilingPrimerLabel,
      orgTrimPaintLabel: derived.productLabels.orgTrimPaintLabel,
      orgTrimPrimerLabel: derived.productLabels.orgTrimPrimerLabel,
      effectiveWallPaintLabel: derived.productLabels.effectiveWallPaintLabel,
      effectiveWallPrimerLabel: derived.productLabels.effectiveWallPrimerLabel,
      effectiveCeilingPaintLabel: derived.productLabels.effectiveCeilingPaintLabel,
      effectiveCeilingPrimerLabel: derived.productLabels.effectiveCeilingPrimerLabel,
      effectiveTrimPaintLabel: derived.productLabels.effectiveTrimPaintLabel,
      effectiveTrimPrimerLabel: derived.productLabels.effectiveTrimPrimerLabel,
      updateJobSettings: settingsActions.updateJobSettings,
      updateCustomer: settingsActions.updateCustomer,
      flushCustomerSave: settingsActions.flushCustomerSave,
    }),
    [
      derived.catalog.ceilingPaintOptions,
      derived.catalog.ceilingPrimerOptions,
      derived.catalog.trimPaintOptions,
      derived.catalog.trimPrimerOptions,
      derived.catalog.wallPaintOptions,
      derived.catalog.wallPrimerOptions,
      derived.productLabels.effectiveCeilingPaintLabel,
      derived.productLabels.effectiveCeilingPrimerLabel,
      derived.productLabels.effectiveTrimPaintLabel,
      derived.productLabels.effectiveTrimPrimerLabel,
      derived.productLabels.effectiveWallPaintLabel,
      derived.productLabels.effectiveWallPrimerLabel,
      derived.productLabels.orgCeilingPaintLabel,
      derived.productLabels.orgCeilingPrimerLabel,
      derived.productLabels.orgTrimPaintLabel,
      derived.productLabels.orgTrimPrimerLabel,
      derived.productLabels.orgWallPaintLabel,
      derived.productLabels.orgWallPrimerLabel,
      meta.setJobDefaultsOpen,
      meta.setSettingsOpen,
      settingsActions.flushCustomerSave,
      settingsActions.updateCustomer,
      settingsActions.updateJobSettings,
      state.customerDraft,
      state.jobDefaultsOpen,
      state.jobSettingsDraft,
      state.orgJobProductDefaults,
      state.settingsOpen,
    ]
  )
}

function useSaveVm(
  estimateId: string | undefined,
  store: EstimateV2EditorStoreApi,
  derived: EstimateV2EditorDerivedSections,
  save: EstimateV2EditorViewModelParams['save'],
  saveDraft: EstimateV2EditorViewModelParams['saveDraft'],
  saveAndContinue: EstimateV2EditorViewModelParams['saveAndContinue']
): EstimateV2EditorSaveVm {
  const saveState = useEstimateV2Store(store, (state) => ({
    saveStatus: state.meta.saveStatus,
    debugMeta: state.meta.debugMeta,
  }))

  return useMemo(
    () => ({
      dirty: derived.calculation.dirty,
      canManualSave: derived.save.canManualSave,
      canSaveAndContinue:
        Boolean(estimateId) && (!derived.calculation.dirty || derived.save.canManualSave),
      saveStatus: saveState.saveStatus,
      saveStatusText: derived.save.saveStatusText,
      saveStatusColor: derived.save.saveStatusColor,
      blockedReason: derived.save.blockedReason,
      blockingIssues: derived.save.blockingIssues,
      calculationsStale: derived.calculation.calculationsStale,
      debugMeta: {
        ...saveState.debugMeta,
        usingLocalPreview: derived.calculation.useLocalPreviewCalculations,
      },
      save,
      saveDraft,
      saveAndContinue,
    }),
    [
      estimateId,
      derived.save.blockedReason,
      derived.save.blockingIssues,
      derived.save.canManualSave,
      derived.calculation.calculationsStale,
      derived.calculation.dirty,
      derived.calculation.useLocalPreviewCalculations,
      derived.save.saveStatusColor,
      derived.save.saveStatusText,
      save,
      saveDraft,
      saveAndContinue,
      saveState.debugMeta,
      saveState.saveStatus,
    ]
  )
}

function useSummaryVm(
  store: EstimateV2EditorStoreApi,
  derived: EstimateV2EditorDerivedSections
): EstimateV2EditorSummaryVm {
  const summaryState = useEstimateV2Store(store, (state) => ({
    roomsCount: state.collections.rooms.length,
    validationIssueCount: state.meta.validationIssues.length,
  }))

  const wallSectionSummary = useMemo(
    () => {
      const wallUsesPrimer = derived.room.selectedRoomScopes.some(
        (scope) => scope.include === 'Y' && scope.primeMode !== 'NONE'
      )
      return buildSectionSummaryVm({
        visible: derived.room.wallsIncluded,
        title: 'Walls',
        modeLabel: derived.room.selectedRoomGeometryMode,
        primaryValue: toDisplayNumber(derived.calculation.selectedRoomEffectiveSqFt),
        primaryUnit: 'Sq Ft',
        paintLabel: derived.productLabels.wallPaintLabel,
        primerLabel: derived.productLabels.wallPrimerLabel,
        showPrimer: wallUsesPrimer,
        financialRows: [
          {
            label: 'Effective Total',
            value: formatSummaryFinancialTotal(derived.calculation.selectedWallSubtotal),
          },
          ...(derived.calculation.selectedWallDrywallSubtotal == null
            ? []
            : [
                {
                  label: 'Drywall Effective Total',
                  value: formatSummaryFinancialTotal(derived.calculation.selectedWallDrywallSubtotal),
                },
              ]),
        ],
        chips: buildSectionSummaryChips({
          modeLabel: derived.room.selectedRoomGeometryMode,
          primaryValue: toDisplayNumber(derived.calculation.selectedRoomEffectiveSqFt),
          primaryUnit: 'Sq Ft',
          paintLabel: derived.productLabels.wallPaintLabel,
          primerLabel: derived.productLabels.wallPrimerLabel,
          showPrimer: wallUsesPrimer,
          secondaryValue: formatSummaryFinancialTotal(derived.calculation.selectedWallSubtotal),
          secondaryLabel: 'Effective Total',
          validationIssueCount: derived.room.selectedRoomIssueCount,
        }),
      })
    },
    [
      derived.calculation.selectedRoomEffectiveSqFt,
      derived.calculation.selectedWallDrywallSubtotal,
      derived.calculation.selectedWallSubtotal,
      derived.productLabels.wallPaintLabel,
      derived.productLabels.wallPrimerLabel,
      derived.room.selectedRoomGeometryMode,
      derived.room.selectedRoomIssueCount,
      derived.room.selectedRoomScopes,
      derived.room.wallsIncluded,
    ]
  )

  const ceilingSectionSummary = useMemo(
    () => {
      const ceilingUsesPrimer = derived.room.selectedRoomCeilingScopes.some(
        (scope) => scope.include === 'Y' && scope.primeMode !== 'NONE'
      )
      return buildSectionSummaryVm({
        visible: derived.room.ceilingsIncluded,
        title: 'Ceilings',
        modeLabel: derived.room.selectedRoomGeometryMode,
        primaryValue: toDisplayNumber(derived.calculation.selectedCeilingEffectiveSqFt),
        primaryUnit: 'Sq Ft',
        paintLabel: derived.productLabels.ceilingPaintLabel,
        primerLabel: derived.productLabels.ceilingPrimerLabel,
        showPrimer: ceilingUsesPrimer,
        financialRows: [
          {
            label: 'Effective Total',
            value: formatSummaryFinancialTotal(derived.calculation.selectedCeilingSubtotal),
          },
          ...(derived.calculation.selectedCeilingDrywallSubtotal == null
            ? []
            : [
                {
                  label: 'Drywall Effective Total',
                  value: formatSummaryFinancialTotal(derived.calculation.selectedCeilingDrywallSubtotal),
                },
              ]),
        ],
        chips: buildSectionSummaryChips({
          modeLabel: derived.room.selectedRoomGeometryMode,
          primaryValue: toDisplayNumber(derived.calculation.selectedCeilingEffectiveSqFt),
          primaryUnit: 'Sq Ft',
          paintLabel: derived.productLabels.ceilingPaintLabel,
          primerLabel: derived.productLabels.ceilingPrimerLabel,
          showPrimer: ceilingUsesPrimer,
          secondaryValue: formatSummaryFinancialTotal(derived.calculation.selectedCeilingSubtotal),
          secondaryLabel: 'Effective Total',
          validationIssueCount: derived.room.selectedRoomIssueCount,
        }),
      })
    },
    [
      derived.calculation.selectedCeilingEffectiveSqFt,
      derived.calculation.selectedCeilingDrywallSubtotal,
      derived.calculation.selectedCeilingSubtotal,
      derived.productLabels.ceilingPaintLabel,
      derived.productLabels.ceilingPrimerLabel,
      derived.room.ceilingsIncluded,
      derived.room.selectedRoomGeometryMode,
      derived.room.selectedRoomCeilingScopes,
      derived.room.selectedRoomIssueCount,
    ]
  )

  const trimSectionSummary = useMemo(
    () => {
      const trimUsesPrimer = derived.room.selectedRoomTrimScopes.some(
        (scope) => scope.include === 'Y' && scope.primeMode !== 'NONE'
      )
      return buildSectionSummaryVm({
        visible: derived.room.trimsIncluded,
        title: 'Trim',
        primaryValue: toDisplayNumber(derived.calculation.selectedTrimMeasurement),
        primaryUnit: 'LF / EA / SF',
        paintLabel: derived.productLabels.trimPaintLabel,
        primerLabel: derived.productLabels.trimPrimerLabel,
        showPrimer: trimUsesPrimer,
        secondaryValue: formatSummaryFinancialTotal(derived.calculation.selectedTrimSubtotal),
        secondaryLabel: 'Effective Total',
        financialRows: [
          {
            label: 'Effective Total',
            value: formatSummaryFinancialTotal(derived.calculation.selectedTrimSubtotal),
          },
        ],
        chips: buildSectionSummaryChips({
          itemCount: derived.room.selectedRoomTrimScopes.length,
          primaryValue: toDisplayNumber(derived.calculation.selectedTrimMeasurement),
          primaryUnit: 'Measure',
          paintLabel: derived.productLabels.trimPaintLabel,
          primerLabel: derived.productLabels.trimPrimerLabel,
          showPrimer: trimUsesPrimer,
          secondaryValue: formatSummaryFinancialTotal(derived.calculation.selectedTrimSubtotal),
          secondaryLabel: 'Effective Total',
        }),
      })
    },
    [
      derived.calculation.selectedTrimMeasurement,
      derived.calculation.selectedTrimSubtotal,
      derived.productLabels.trimPaintLabel,
      derived.productLabels.trimPrimerLabel,
      derived.room.selectedRoomTrimScopes,
      derived.room.trimsIncluded,
    ]
  )

  const doorSectionSummary = useMemo(
    () => {
      const doorUsesPrimer = derived.room.selectedRoomDoorScopes.some(
        (scope) => scope.include === 'Y' && scope.primeMode !== 'NONE'
      )
      return buildSectionSummaryVm({
        visible: derived.room.doorsIncluded,
        title: 'Doors',
        primaryValue: toDisplayNumber(derived.calculation.selectedDoorUnits),
        primaryUnit: 'Sides',
        paintLabel: derived.productLabels.doorPaintLabel,
        primerLabel: derived.productLabels.doorPrimerLabel,
        showPrimer: doorUsesPrimer,
        secondaryValue: formatSummaryFinancialTotal(derived.calculation.selectedDoorSubtotal),
        secondaryLabel: 'Effective Total',
        financialRows: [
          {
            label: 'Effective Total',
            value: formatSummaryFinancialTotal(derived.calculation.selectedDoorSubtotal),
          },
        ],
        chips: buildSectionSummaryChips({
          itemCount: derived.room.selectedRoomDoorScopes.length,
          primaryValue: toDisplayNumber(derived.calculation.selectedDoorUnits),
          primaryUnit: 'Sides',
          paintLabel: derived.productLabels.doorPaintLabel,
          primerLabel: derived.productLabels.doorPrimerLabel,
          showPrimer: doorUsesPrimer,
          secondaryValue: formatSummaryFinancialTotal(derived.calculation.selectedDoorSubtotal),
          secondaryLabel: 'Effective Total',
        }),
      })
    },
    [
      derived.calculation.selectedDoorSubtotal,
      derived.calculation.selectedDoorUnits,
      derived.productLabels.doorPaintLabel,
      derived.productLabels.doorPrimerLabel,
      derived.room.doorsIncluded,
      derived.room.selectedRoomDoorScopes,
    ]
  )

  const scopeToggleLabels = useMemo(
    () =>
      buildScopeToggleLabels({
        wallsIncluded: derived.room.wallsIncluded,
        ceilingsIncluded: derived.room.ceilingsIncluded,
        trimsIncluded: derived.room.trimsIncluded,
        doorsIncluded: derived.room.doorsIncluded,
      }),
    [derived.room.ceilingsIncluded, derived.room.doorsIncluded, derived.room.trimsIncluded, derived.room.wallsIncluded]
  )

  return useMemo(() => {
    const includedScopeLabels = buildIncludedScopeLabels({
      wallsIncluded: derived.room.wallsIncluded,
      ceilingsIncluded: derived.room.ceilingsIncluded,
      trimsIncluded: derived.room.trimsIncluded,
      doorsIncluded: derived.room.doorsIncluded,
    })
    const validationState = buildValidationState(summaryState.validationIssueCount)
    const calculationStateVm = buildCalculationState(derived.calculation.calculationsStale)
    const selectedRoomName = derived.room.selectedRoom?.roomName || 'Unnamed room'
    const roomSubtitle = buildRoomSubtitle(selectedRoomName, includedScopeLabels)

    return {
      roomLabel: derived.room.selectedRoom?.roomId ?? '--',
      roomName: selectedRoomName,
      roomSubtitle,
      includedScopeLabels,
      scopeToggleLabels,
      validationText: validationState.text,
      validationColor: validationState.color,
      calculationStateText: calculationStateVm.text,
      calculationStateColor: calculationStateVm.color,
      runningTotalLabel: buildRunningTotalLabel(summaryState.roomsCount),
      activeScopeTotals: buildActiveScopeTotalRows(derived.calculation.activeScopeTotals),
      saveStatusText: derived.save.saveStatusText,
      saveStatusColor: derived.save.saveStatusColor,
      walls: wallSectionSummary,
      ceilings: ceilingSectionSummary,
      trim: trimSectionSummary,
      doors: doorSectionSummary,
    }
  }, [
    ceilingSectionSummary,
    doorSectionSummary,
    derived.calculation.calculationsStale,
    derived.calculation.activeScopeTotals,
    derived.room.ceilingsIncluded,
    derived.room.doorsIncluded,
    derived.room.selectedRoom,
    derived.room.trimsIncluded,
    derived.room.wallsIncluded,
    derived.save.saveStatusColor,
    derived.save.saveStatusText,
    scopeToggleLabels,
    summaryState.roomsCount,
    summaryState.validationIssueCount,
    trimSectionSummary,
    wallSectionSummary,
  ])
}

export function useEstimateV2EditorSliceViewModels(
  params: EstimateV2EditorViewModelParams
) {
  const { estimateId, catalogsReloading = false, store, derived, roomActions, wallActions, ceilingActions, trimActions, doorActions, drywallActions, settingsActions, save, saveDraft, saveAndContinue } = params
  const effectiveDrywallActions = drywallActions ?? noopDrywallActions
  const pageVm = usePageVm(store, derived, catalogsReloading)
  const headerVm = useHeaderVm(estimateId, store, derived, roomActions.addRoom)
  const roomVm = useRoomVm(store, derived, roomActions)
  const wallsVm = useWallsVm(store, derived, wallActions, effectiveDrywallActions, roomActions.updateRoomComplexity)
  const ceilingsVm = useCeilingsVm(store, derived, ceilingActions, effectiveDrywallActions)
  const trimVm = useTrimVm(derived, trimActions)
  const doorsVm = useDoorsVm(derived, doorActions)
  const jobSettingsVm = useJobSettingsVm(store, derived, settingsActions)
  const saveVm = useSaveVm(estimateId, store, derived, save, saveDraft, saveAndContinue)
  const summaryVm = useSummaryVm(store, derived)

  return {
    pageVm,
    headerVm,
    summaryVm,
    roomVm,
    wallsVm,
    ceilingsVm,
    trimVm,
    doorsVm,
    jobSettingsVm,
    saveVm,
    toDisplayNumber,
  }
}
