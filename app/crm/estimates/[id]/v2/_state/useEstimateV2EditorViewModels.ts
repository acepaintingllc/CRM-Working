'use client'

import { useMemo } from 'react'
import {
  estimateV2StoreSelectors,
  useEstimateV2Store,
  type EstimateV2EditorStoreApi,
} from '@/lib/estimates/v2/store/estimateV2Store'
import { getFlagMultiplierHint, toDisplayNumber } from '../_lib/estimateV2EditorNormalize'
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
  EstimateV2EditorCeilingsVm,
  EstimateV2EditorHeaderVm,
  EstimateV2EditorPageVm,
  EstimateV2EditorRoomVm,
  EstimateV2EditorSaveVm,
  EstimateV2EditorSettingsVm,
  EstimateV2EditorSummaryVm,
  EstimateV2EditorTrimVm,
  EstimateV2EditorWallsVm,
} from './estimateV2EditorTypes'
import type { EstimateV2EditorDerivedSections } from './useEstimateV2DerivedState'

export function useEstimateV2EditorViewModels(params: {
  estimateId?: string
  store: EstimateV2EditorStoreApi
  derived: EstimateV2EditorDerivedSections
  roomActions: ReturnType<typeof import('./useEstimateV2RoomActions').useEstimateV2RoomActions>
  wallActions: ReturnType<typeof import('./useEstimateV2WallActions').useEstimateV2WallActions>
  ceilingActions: ReturnType<typeof import('./useEstimateV2CeilingActions').useEstimateV2CeilingActions>
  trimActions: ReturnType<typeof import('./useEstimateV2TrimActions').useEstimateV2TrimActions>
  settingsActions: ReturnType<typeof import('./useEstimateV2SettingsActions').useEstimateV2SettingsActions>
  save: ReturnType<typeof import('./useEstimateV2SaveController').useEstimateV2SaveController>['save']
}) {
  const {
    estimateId,
    store,
    derived,
    roomActions,
    wallActions,
    ceilingActions,
    trimActions,
    settingsActions,
    save,
  } = params
  const state = useEstimateV2Store(store, estimateV2StoreSelectors.viewState)
  const meta = useEstimateV2Store(store, estimateV2StoreSelectors.meta)
  const catalog = derived.catalog
  const room = derived.room
  const calculation = derived.calculation
  const productLabels = derived.productLabels
  const saveDerived = derived.save

  const {
    addRoom,
    deleteRoom,
    updateRoom,
    updateRoomComplexity,
    toggleFlag,
    handleRoomDimChange,
    switchRoomGeometryMode,
  } = roomActions

  const roomVm: EstimateV2EditorRoomVm = useMemo(
    () => ({
      rooms: state.rooms,
      selectedRoomId: state.selectedRoomId,
      setSelectedRoomId: meta.setSelectedRoomId,
      selectedRoom: room.selectedRoom,
      selectedRoomResolvedMode: room.selectedRoomResolvedMode,
      selectedRoomGeometryMode: room.selectedRoomGeometryMode,
      roomTypeOptions: catalog.roomTypeOptions,
      roomFlags: state.roomFlags,
      roomScopeByRoomId: room.roomScopeByRoomId,
      roomCeilingScopeByRoomId: room.roomCeilingScopeByRoomId,
      roomTrimScopeByRoomId: room.roomTrimScopeByRoomId,
      displayedRoomEffectiveAreaByRoomId: calculation.displayedRoomEffectiveAreaByRoomId,
      selectedRoomEffectiveSqFt: calculation.selectedRoomEffectiveSqFt,
      activeRoomFlagCount: room.activeRoomFlagCount,
      selectedRoomIssueCount: room.selectedRoomIssueCount,
      roomFlagsEnabled: state.catalogs.room_flags.length > 0,
      roomFlagsCatalog: state.catalogs.room_flags,
      getFlagMultiplierHint,
      addRoom,
      deleteRoom,
      updateRoom,
      updateRoomComplexity,
      toggleFlag,
      handleRoomDimChange,
      switchRoomGeometryMode,
      updateSelectedRoom: (patch) => {
        if (!room.selectedRoom) return
        updateRoom(room.selectedRoom.roomId, patch)
      },
      deleteSelectedRoom: () => {
        if (!room.selectedRoom) return
        deleteRoom(room.selectedRoom.roomId)
      },
      toggleSelectedRoomFlag: (flagId) => {
        if (!room.selectedRoom) return
        toggleFlag(room.selectedRoom.roomId, flagId)
      },
      updateSelectedRoomDimensions: (field, value) => {
        if (!room.selectedRoom) return
        handleRoomDimChange(room.selectedRoom.roomId, field, value)
      },
      switchSelectedRoomGeometryMode: (nextMode) => {
        if (!room.selectedRoom) return
        switchRoomGeometryMode(room.selectedRoom.roomId, nextMode)
      },
    }),
    [
      calculation.displayedRoomEffectiveAreaByRoomId,
      calculation.selectedRoomEffectiveSqFt,
      catalog.roomTypeOptions,
      handleRoomDimChange,
      meta.setSelectedRoomId,
      addRoom,
      deleteRoom,
      room.activeRoomFlagCount,
      room.roomCeilingScopeByRoomId,
      room.roomScopeByRoomId,
      room.roomTrimScopeByRoomId,
      room.selectedRoom,
      room.selectedRoomGeometryMode,
      room.selectedRoomIssueCount,
      room.selectedRoomResolvedMode,
      state.catalogs.room_flags,
      state.roomFlags,
      state.rooms,
      state.selectedRoomId,
      switchRoomGeometryMode,
      toggleFlag,
      updateRoom,
      updateRoomComplexity,
    ]
  )

  const wallsVm: EstimateV2EditorWallsVm = useMemo(
    () => ({
      selectedRoom: room.selectedRoom,
      selectedRoomGeometryMode: room.selectedRoomGeometryMode,
      selectedRoomScopes: room.selectedRoomScopes,
      firstScope: room.firstScope,
      segments: state.segments,
      wallsIncluded: room.wallsIncluded,
      wallPaintLabel: productLabels.wallPaintLabel,
      wallPrimerLabel: productLabels.wallPrimerLabel,
      effectiveWallPaintLabel: productLabels.effectiveWallPaintLabel,
      effectiveWallPrimerLabel: productLabels.effectiveWallPrimerLabel,
      wallPaintOptions: catalog.wallPaintOptions,
      wallPrimerOptions: catalog.wallPrimerOptions,
      wallProductionRates: catalog.wallProductionRates,
      colorCodeOptions: catalog.colorCodeOptions,
      displayedSegmentEffectiveAreaById: calculation.displayedSegmentEffectiveAreaById,
      displayedScopeEffectiveAreaById: calculation.displayedScopeEffectiveAreaById,
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
    }),
    [
      calculation.displayedScopeEffectiveAreaById,
      calculation.displayedSegmentEffectiveAreaById,
      catalog.colorCodeOptions,
      catalog.wallPaintOptions,
      catalog.wallPrimerOptions,
      catalog.wallProductionRates,
      productLabels.effectiveWallPaintLabel,
      productLabels.effectiveWallPrimerLabel,
      productLabels.wallPaintLabel,
      productLabels.wallPrimerLabel,
      room.firstScope,
      room.selectedRoom,
      room.selectedRoomGeometryMode,
      room.selectedRoomScopes,
      room.wallsIncluded,
      state.segments,
      updateRoomComplexity,
      wallActions.addScope,
      wallActions.addSegment,
      wallActions.deleteScope,
      wallActions.deleteSegment,
      wallActions.moveScope,
      wallActions.moveSegment,
      wallActions.toggleRoomInclude,
      wallActions.updateScope,
      wallActions.updateSegment,
    ]
  )

  const ceilingsVm: EstimateV2EditorCeilingsVm = useMemo(
    () => ({
      catalogs: state.catalogs,
      selectedRoom: room.selectedRoom,
      selectedRoomGeometryMode: room.selectedRoomGeometryMode,
      selectedRoomCeilingScopes: room.selectedRoomCeilingScopes,
      firstCeilingScope: room.firstCeilingScope,
      ceilingSegments: state.ceilingSegments,
      ceilingsIncluded: room.ceilingsIncluded,
      ceilingPaintLabel: productLabels.ceilingPaintLabel,
      ceilingPrimerLabel: productLabels.ceilingPrimerLabel,
      effectiveCeilingPaintLabel: productLabels.effectiveCeilingPaintLabel,
      effectiveCeilingPrimerLabel: productLabels.effectiveCeilingPrimerLabel,
      ceilingPaintOptions: catalog.ceilingPaintOptions,
      ceilingPrimerOptions: catalog.ceilingPrimerOptions,
      colorCodeOptions: catalog.colorCodeOptions,
      selectedCeilingEffectiveSqFt: calculation.selectedCeilingEffectiveSqFt,
      updateScope: ceilingActions.updateScope,
      addScope: ceilingActions.addScope,
      deleteScope: ceilingActions.deleteScope,
      moveScope: ceilingActions.moveScope,
      addSegment: ceilingActions.addSegment,
      deleteSegment: ceilingActions.deleteSegment,
      moveSegment: ceilingActions.moveSegment,
      updateSegment: ceilingActions.updateSegment,
      toggleRoomInclude: ceilingActions.toggleRoomInclude,
    }),
    [
      ceilingActions.addScope,
      ceilingActions.addSegment,
      ceilingActions.deleteScope,
      ceilingActions.deleteSegment,
      ceilingActions.moveScope,
      ceilingActions.moveSegment,
      ceilingActions.toggleRoomInclude,
      ceilingActions.updateScope,
      ceilingActions.updateSegment,
      calculation.selectedCeilingEffectiveSqFt,
      catalog.ceilingPaintOptions,
      catalog.ceilingPrimerOptions,
      catalog.colorCodeOptions,
      productLabels.ceilingPaintLabel,
      productLabels.ceilingPrimerLabel,
      productLabels.effectiveCeilingPaintLabel,
      productLabels.effectiveCeilingPrimerLabel,
      room.ceilingsIncluded,
      room.firstCeilingScope,
      room.selectedRoom,
      room.selectedRoomCeilingScopes,
      room.selectedRoomGeometryMode,
      state.catalogs,
      state.ceilingSegments,
    ]
  )

  const trimVm: EstimateV2EditorTrimVm = useMemo(
    () => ({
      selectedRoom: room.selectedRoom,
      selectedRoomResolvedMode: room.selectedRoomResolvedMode,
      selectedRoomTrimScopes: room.selectedRoomTrimScopes,
      firstTrimScope: room.firstTrimScope,
      trimsIncluded: room.trimsIncluded,
      jobTrimsIncluded: room.jobTrimsIncluded,
      trimPaintLabel: productLabels.trimPaintLabel,
      trimPrimerLabel: productLabels.trimPrimerLabel,
      effectiveTrimPaintLabel: productLabels.effectiveTrimPaintLabel,
      effectiveTrimPrimerLabel: productLabels.effectiveTrimPrimerLabel,
      trimPaintOptions: catalog.trimPaintOptions,
      trimPrimerOptions: catalog.trimPrimerOptions,
      trimTypeOptions: catalog.trimTypeOptions,
      trimScopeEffectiveMeasurementById: calculation.trimScopeEffectiveMeasurementById,
      trimScopeEffectiveTotalById: calculation.trimScopeEffectiveTotalById,
      selectedTrimSubtotal: calculation.selectedTrimSubtotal,
      selectedTrimMeasurement: calculation.selectedTrimMeasurement,
      colorCodeOptions: catalog.colorCodeOptions,
      updateScope: trimActions.updateScope,
      addScope: trimActions.addScope,
      moveScope: trimActions.moveScope,
      deleteScope: trimActions.deleteScope,
      toggleRoomInclude: trimActions.toggleRoomInclude,
      updateTrimType: trimActions.updateTrimType,
    }),
    [
      calculation.selectedTrimMeasurement,
      calculation.selectedTrimSubtotal,
      calculation.trimScopeEffectiveMeasurementById,
      calculation.trimScopeEffectiveTotalById,
      catalog.colorCodeOptions,
      catalog.trimPaintOptions,
      catalog.trimPrimerOptions,
      catalog.trimTypeOptions,
      productLabels.effectiveTrimPaintLabel,
      productLabels.effectiveTrimPrimerLabel,
      productLabels.trimPaintLabel,
      productLabels.trimPrimerLabel,
      room.firstTrimScope,
      room.jobTrimsIncluded,
      room.selectedRoom,
      room.selectedRoomResolvedMode,
      room.selectedRoomTrimScopes,
      room.trimsIncluded,
      trimActions.addScope,
      trimActions.deleteScope,
      trimActions.moveScope,
      trimActions.toggleRoomInclude,
      trimActions.updateScope,
      trimActions.updateTrimType,
    ]
  )

  const jobSettingsVm: EstimateV2EditorSettingsVm = useMemo(
    () => ({
      jobSettingsDraft: state.jobSettingsDraft,
      orgJobProductDefaults: state.orgJobProductDefaults,
      customerDraft: state.customerDraft,
      settingsOpen: state.settingsOpen,
      setSettingsOpen: meta.setSettingsOpen,
      jobDefaultsOpen: state.jobDefaultsOpen,
      setJobDefaultsOpen: meta.setJobDefaultsOpen,
      wallPaintOptions: catalog.wallPaintOptions,
      wallPrimerOptions: catalog.wallPrimerOptions,
      ceilingPaintOptions: catalog.ceilingPaintOptions,
      ceilingPrimerOptions: catalog.ceilingPrimerOptions,
      trimPaintOptions: catalog.trimPaintOptions,
      trimPrimerOptions: catalog.trimPrimerOptions,
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
      updateJobSettings: settingsActions.updateJobSettings,
      updateCustomer: settingsActions.updateCustomer,
      flushCustomerSave: settingsActions.flushCustomerSave,
    }),
    [
      catalog.ceilingPaintOptions,
      catalog.ceilingPrimerOptions,
      catalog.trimPaintOptions,
      catalog.trimPrimerOptions,
      catalog.wallPaintOptions,
      catalog.wallPrimerOptions,
      meta.setJobDefaultsOpen,
      meta.setSettingsOpen,
      productLabels.effectiveCeilingPaintLabel,
      productLabels.effectiveCeilingPrimerLabel,
      productLabels.effectiveTrimPaintLabel,
      productLabels.effectiveTrimPrimerLabel,
      productLabels.effectiveWallPaintLabel,
      productLabels.effectiveWallPrimerLabel,
      productLabels.orgCeilingPaintLabel,
      productLabels.orgCeilingPrimerLabel,
      productLabels.orgTrimPaintLabel,
      productLabels.orgTrimPrimerLabel,
      productLabels.orgWallPaintLabel,
      productLabels.orgWallPrimerLabel,
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

  const saveVm: EstimateV2EditorSaveVm = useMemo(
    () => ({
      dirty: calculation.dirty,
      saveStatus: state.saveStatus,
      saveStatusText: saveDerived.saveStatusText,
      saveStatusColor: saveDerived.saveStatusColor,
      calculationsStale: calculation.calculationsStale,
      debugMeta: {
        ...state.debugMeta,
        usingLocalPreview: calculation.useLocalPreviewCalculations,
      },
      save,
    }),
    [
      calculation.calculationsStale,
      calculation.dirty,
      calculation.useLocalPreviewCalculations,
      save,
      saveDerived.saveStatusColor,
      saveDerived.saveStatusText,
      state.debugMeta,
      state.saveStatus,
    ]
  )

  const pageVm: EstimateV2EditorPageVm = useMemo(
    () => ({
      loading: state.loading,
      saving: state.saving,
      error: state.error,
      validationIssues: state.validationIssues,
      emptySelectionMessage: 'Add a room or select one from the roster to start editing walls.',
      roomsCount: state.rooms.length,
    }),
    [state.error, state.loading, state.rooms.length, state.saving, state.validationIssues]
  )

  const headerVm: EstimateV2EditorHeaderVm = useMemo(
    () => ({
      estimateId,
      titleText: state.estimate?.version_name ?? 'Estimate Version',
      subtitleText: buildHeaderSubtitle(state.job),
      workflowText: 'Walls-first wizard - Rooms',
      dirtyStateText: calculation.dirty ? 'unsaved - live preview' : null,
      dirty: calculation.dirty,
      saving: state.saving,
      toggleSettings: () => meta.setSettingsOpen((open) => !open),
      addRoom,
    }),
    [addRoom, calculation.dirty, estimateId, meta, state.estimate?.version_name, state.job, state.saving]
  )

  const wallSectionSummary = useMemo(
    () =>
      buildSectionSummaryVm({
        visible: room.wallsIncluded,
        title: 'Walls',
        modeLabel: room.selectedRoomGeometryMode,
        primaryValue: toDisplayNumber(calculation.selectedRoomEffectiveSqFt),
        primaryUnit: 'Sq Ft',
        paintLabel: productLabels.wallPaintLabel,
        primerLabel: productLabels.wallPrimerLabel,
        chips: buildSectionSummaryChips({
          modeLabel: room.selectedRoomGeometryMode,
          primaryValue: toDisplayNumber(calculation.selectedRoomEffectiveSqFt),
          primaryUnit: 'Sq Ft',
          paintLabel: productLabels.wallPaintLabel,
          primerLabel: productLabels.wallPrimerLabel,
          validationIssueCount: room.selectedRoomIssueCount,
        }),
      }),
    [
      calculation.selectedRoomEffectiveSqFt,
      productLabels.wallPaintLabel,
      productLabels.wallPrimerLabel,
      room.selectedRoomGeometryMode,
      room.selectedRoomIssueCount,
      room.wallsIncluded,
    ]
  )

  const ceilingSectionSummary = useMemo(
    () =>
      buildSectionSummaryVm({
        visible: room.ceilingsIncluded,
        title: 'Ceilings',
        modeLabel: room.selectedRoomGeometryMode,
        primaryValue: toDisplayNumber(calculation.selectedCeilingEffectiveSqFt),
        primaryUnit: 'Sq Ft',
        paintLabel: productLabels.ceilingPaintLabel,
        primerLabel: productLabels.ceilingPrimerLabel,
        chips: buildSectionSummaryChips({
          modeLabel: room.selectedRoomGeometryMode,
          primaryValue: toDisplayNumber(calculation.selectedCeilingEffectiveSqFt),
          primaryUnit: 'Sq Ft',
          paintLabel: productLabels.ceilingPaintLabel,
          primerLabel: productLabels.ceilingPrimerLabel,
          validationIssueCount: room.selectedRoomIssueCount,
        }),
      }),
    [
      calculation.selectedCeilingEffectiveSqFt,
      productLabels.ceilingPaintLabel,
      productLabels.ceilingPrimerLabel,
      room.ceilingsIncluded,
      room.selectedRoomGeometryMode,
      room.selectedRoomIssueCount,
    ]
  )

  const trimSectionSummary = useMemo(
    () =>
      buildSectionSummaryVm({
        visible: room.trimsIncluded,
        title: 'Trim',
        primaryValue: toDisplayNumber(calculation.selectedTrimMeasurement),
        primaryUnit: 'LF / EA / SF',
        paintLabel: productLabels.trimPaintLabel,
        primerLabel: productLabels.trimPrimerLabel,
        secondaryValue:
          calculation.selectedTrimSubtotal == null
            ? '--'
            : `$${calculation.selectedTrimSubtotal.toFixed(2)}`,
        secondaryLabel: 'Subtotal',
        chips: buildSectionSummaryChips({
          itemCount: room.selectedRoomTrimScopes.length,
          primaryValue: toDisplayNumber(calculation.selectedTrimMeasurement),
          primaryUnit: 'Measure',
          paintLabel: productLabels.trimPaintLabel,
          primerLabel: productLabels.trimPrimerLabel,
          secondaryValue:
            calculation.selectedTrimSubtotal == null
              ? '--'
              : `$${calculation.selectedTrimSubtotal.toFixed(2)}`,
          secondaryLabel: 'Subtotal',
        }),
      }),
    [
      calculation.selectedTrimMeasurement,
      calculation.selectedTrimSubtotal,
      productLabels.trimPaintLabel,
      productLabels.trimPrimerLabel,
      room.selectedRoomTrimScopes.length,
      room.trimsIncluded,
    ]
  )

  const scopeToggleLabels = useMemo(
    () =>
      buildScopeToggleLabels({
        wallsIncluded: room.wallsIncluded,
        ceilingsIncluded: room.ceilingsIncluded,
        trimsIncluded: room.trimsIncluded,
      }),
    [room.ceilingsIncluded, room.trimsIncluded, room.wallsIncluded]
  )

  const summaryVm: EstimateV2EditorSummaryVm = useMemo(() => {
    const includedScopeLabels = buildIncludedScopeLabels({
      wallsIncluded: room.wallsIncluded,
      ceilingsIncluded: room.ceilingsIncluded,
      trimsIncluded: room.trimsIncluded,
    })
    const validationState = buildValidationState(state.validationIssues.length)
    const calculationStateVm = buildCalculationState(calculation.calculationsStale)
    const selectedRoomName = room.selectedRoom?.roomName || 'Unnamed room'
    const roomSubtitle = buildRoomSubtitle(selectedRoomName, includedScopeLabels)

    return {
      roomLabel: room.selectedRoom?.roomId ?? '--',
      roomName: selectedRoomName,
      roomSubtitle,
      includedScopeLabels,
      scopeToggleLabels,
      validationText: validationState.text,
      validationColor: validationState.color,
      calculationStateText: calculationStateVm.text,
      calculationStateColor: calculationStateVm.color,
      totalEffectiveAreaText: `${toDisplayNumber(calculation.totalEffectiveAreaSqFt)} sf`,
      runningTotalLabel: buildRunningTotalLabel(state.rooms.length),
      saveStatusText: saveDerived.saveStatusText,
      saveStatusColor: saveDerived.saveStatusColor,
      walls: wallSectionSummary,
      ceilings: ceilingSectionSummary,
      trim: trimSectionSummary,
    }
  }, [
    calculation.calculationsStale,
    calculation.totalEffectiveAreaSqFt,
    ceilingSectionSummary,
    room.ceilingsIncluded,
    room.selectedRoom,
    room.trimsIncluded,
    room.wallsIncluded,
    saveDerived.saveStatusColor,
    saveDerived.saveStatusText,
    scopeToggleLabels,
    state.rooms.length,
    state.validationIssues.length,
    trimSectionSummary,
    wallSectionSummary,
  ])

  return {
    pageVm,
    headerVm,
    summaryVm,
    roomVm,
    wallsVm,
    ceilingsVm,
    trimVm,
    jobSettingsVm,
    saveVm,
    toDisplayNumber,
  }
}
