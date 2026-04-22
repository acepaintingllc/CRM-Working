'use client'

import { useMemo } from 'react'
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
  EstimateV2EditorMetaState,
  EstimateV2EditorHeaderVm,
  EstimateV2EditorPageVm,
  EstimateV2EditorRoomVm,
  EstimateV2EditorSaveVm,
  EstimateV2EditorSettingsVm,
  EstimateV2EditorSummaryVm,
  EstimateV2EditorTrimVm,
  EstimateV2EditorWallsVm,
} from './estimateV2EditorTypes'

export function useEstimateV2EditorViewModels(params: {
  estimateId?: string
  state: ReturnType<typeof import('./useEstimateV2EditorStore').useEstimateV2EditorStore>['state']
  meta: EstimateV2EditorMetaState
  derived: ReturnType<typeof import('./useEstimateV2DerivedState').useEstimateV2DerivedState>
  roomActions: ReturnType<typeof import('./useEstimateV2RoomActions').useEstimateV2RoomActions>
  wallActions: ReturnType<typeof import('./useEstimateV2WallActions').useEstimateV2WallActions>
  ceilingActions: ReturnType<typeof import('./useEstimateV2CeilingActions').useEstimateV2CeilingActions>
  trimActions: ReturnType<typeof import('./useEstimateV2TrimActions').useEstimateV2TrimActions>
  settingsActions: ReturnType<typeof import('./useEstimateV2SettingsActions').useEstimateV2SettingsActions>
  save: ReturnType<typeof import('./useEstimateV2SaveController').useEstimateV2SaveController>['save']
}) {
  const {
    estimateId,
    state,
    meta,
    derived,
    roomActions,
    wallActions,
    ceilingActions,
    trimActions,
    settingsActions,
    save,
  } = params

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
      selectedRoom: derived.selectedRoom,
      selectedRoomResolvedMode: derived.selectedRoomResolvedMode,
      selectedRoomGeometryMode: derived.selectedRoomGeometryMode,
      roomTypeOptions: derived.roomTypeOptions,
      roomFlags: state.roomFlags,
      roomScopeByRoomId: derived.roomScopeByRoomId,
      roomCeilingScopeByRoomId: derived.roomCeilingScopeByRoomId,
      roomTrimScopeByRoomId: derived.roomTrimScopeByRoomId,
      displayedRoomEffectiveAreaByRoomId: derived.displayedRoomEffectiveAreaByRoomId,
      selectedRoomEffectiveSqFt: derived.selectedRoomEffectiveSqFt,
      activeRoomFlagCount: derived.activeRoomFlagCount,
      selectedRoomIssueCount: derived.selectedRoomIssueCount,
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
        if (!derived.selectedRoom) return
        updateRoom(derived.selectedRoom.roomId, patch)
      },
      deleteSelectedRoom: () => {
        if (!derived.selectedRoom) return
        deleteRoom(derived.selectedRoom.roomId)
      },
      toggleSelectedRoomFlag: (flagId) => {
        if (!derived.selectedRoom) return
        toggleFlag(derived.selectedRoom.roomId, flagId)
      },
      updateSelectedRoomDimensions: (field, value) => {
        if (!derived.selectedRoom) return
        handleRoomDimChange(derived.selectedRoom.roomId, field, value)
      },
      switchSelectedRoomGeometryMode: (nextMode) => {
        if (!derived.selectedRoom) return
        switchRoomGeometryMode(derived.selectedRoom.roomId, nextMode)
      },
    }),
    [
      derived.activeRoomFlagCount,
      derived.displayedRoomEffectiveAreaByRoomId,
      derived.roomCeilingScopeByRoomId,
      derived.roomScopeByRoomId,
      derived.roomTrimScopeByRoomId,
      derived.roomTypeOptions,
      derived.selectedRoom,
      derived.selectedRoomEffectiveSqFt,
      derived.selectedRoomGeometryMode,
      derived.selectedRoomIssueCount,
      derived.selectedRoomResolvedMode,
      handleRoomDimChange,
      meta.setSelectedRoomId,
      addRoom,
      deleteRoom,
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
      selectedRoom: derived.selectedRoom,
      selectedRoomGeometryMode: derived.selectedRoomGeometryMode,
      selectedRoomScopes: derived.selectedRoomScopes,
      firstScope: derived.firstScope,
      segments: state.segments,
      wallsIncluded: derived.wallsIncluded,
      wallPaintLabel: derived.wallPaintLabel,
      wallPrimerLabel: derived.wallPrimerLabel,
      effectiveWallPaintLabel: derived.effectiveWallPaintLabel,
      effectiveWallPrimerLabel: derived.effectiveWallPrimerLabel,
      wallPaintOptions: derived.wallPaintOptions,
      wallPrimerOptions: derived.wallPrimerOptions,
      wallProductionRates: derived.wallProductionRates,
      colorCodeOptions: derived.colorCodeOptions,
      displayedSegmentEffectiveAreaById: derived.displayedSegmentEffectiveAreaById,
      displayedScopeEffectiveAreaById: derived.displayedScopeEffectiveAreaById,
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
      derived.colorCodeOptions,
      derived.displayedScopeEffectiveAreaById,
      derived.displayedSegmentEffectiveAreaById,
      derived.effectiveWallPaintLabel,
      derived.effectiveWallPrimerLabel,
      derived.firstScope,
      derived.selectedRoom,
      derived.selectedRoomGeometryMode,
      derived.selectedRoomScopes,
      derived.wallPaintLabel,
      derived.wallPaintOptions,
      derived.wallPrimerLabel,
      derived.wallPrimerOptions,
      derived.wallProductionRates,
      derived.wallsIncluded,
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
      selectedRoom: derived.selectedRoom,
      selectedRoomGeometryMode: derived.selectedRoomGeometryMode,
      selectedRoomCeilingScopes: derived.selectedRoomCeilingScopes,
      firstCeilingScope: derived.firstCeilingScope,
      ceilingSegments: state.ceilingSegments,
      ceilingsIncluded: derived.ceilingsIncluded,
      ceilingPaintLabel: derived.ceilingPaintLabel,
      ceilingPrimerLabel: derived.ceilingPrimerLabel,
      effectiveCeilingPaintLabel: derived.effectiveCeilingPaintLabel,
      effectiveCeilingPrimerLabel: derived.effectiveCeilingPrimerLabel,
      ceilingPaintOptions: derived.ceilingPaintOptions,
      ceilingPrimerOptions: derived.ceilingPrimerOptions,
      colorCodeOptions: derived.colorCodeOptions,
      selectedCeilingEffectiveSqFt: derived.selectedCeilingEffectiveSqFt,
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
      derived.ceilingPaintLabel,
      derived.ceilingPaintOptions,
      derived.ceilingPrimerLabel,
      derived.ceilingPrimerOptions,
      derived.ceilingsIncluded,
      derived.colorCodeOptions,
      derived.effectiveCeilingPaintLabel,
      derived.effectiveCeilingPrimerLabel,
      derived.firstCeilingScope,
      derived.selectedCeilingEffectiveSqFt,
      derived.selectedRoom,
      derived.selectedRoomCeilingScopes,
      derived.selectedRoomGeometryMode,
      state.catalogs,
      state.ceilingSegments,
    ]
  )

  const trimVm: EstimateV2EditorTrimVm = useMemo(
    () => ({
      selectedRoom: derived.selectedRoom,
      selectedRoomResolvedMode: derived.selectedRoomResolvedMode,
      selectedRoomTrimScopes: derived.selectedRoomTrimScopes,
      firstTrimScope: derived.firstTrimScope,
      trimsIncluded: derived.trimsIncluded,
      jobTrimsIncluded: derived.jobTrimsIncluded,
      trimPaintLabel: derived.trimPaintLabel,
      trimPrimerLabel: derived.trimPrimerLabel,
      effectiveTrimPaintLabel: derived.effectiveTrimPaintLabel,
      effectiveTrimPrimerLabel: derived.effectiveTrimPrimerLabel,
      trimPaintOptions: derived.trimPaintOptions,
      trimPrimerOptions: derived.trimPrimerOptions,
      trimTypeOptions: derived.trimTypeOptions,
      trimScopeEffectiveMeasurementById: derived.trimScopeEffectiveMeasurementById,
      trimScopeEffectiveTotalById: derived.trimScopeEffectiveTotalById,
      selectedTrimSubtotal: derived.selectedTrimSubtotal,
      selectedTrimMeasurement: derived.selectedTrimMeasurement,
      colorCodeOptions: derived.colorCodeOptions,
      updateScope: trimActions.updateScope,
      addScope: trimActions.addScope,
      moveScope: trimActions.moveScope,
      deleteScope: trimActions.deleteScope,
      toggleRoomInclude: trimActions.toggleRoomInclude,
      updateTrimType: trimActions.updateTrimType,
    }),
    [
      derived.colorCodeOptions,
      derived.effectiveTrimPaintLabel,
      derived.effectiveTrimPrimerLabel,
      derived.firstTrimScope,
      derived.jobTrimsIncluded,
      derived.selectedRoom,
      derived.selectedRoomResolvedMode,
      derived.selectedRoomTrimScopes,
      derived.selectedTrimMeasurement,
      derived.selectedTrimSubtotal,
      derived.trimPaintLabel,
      derived.trimPaintOptions,
      derived.trimPrimerLabel,
      derived.trimPrimerOptions,
      derived.trimScopeEffectiveMeasurementById,
      derived.trimScopeEffectiveTotalById,
      derived.trimTypeOptions,
      derived.trimsIncluded,
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
      wallPaintOptions: derived.wallPaintOptions,
      wallPrimerOptions: derived.wallPrimerOptions,
      ceilingPaintOptions: derived.ceilingPaintOptions,
      ceilingPrimerOptions: derived.ceilingPrimerOptions,
      trimPaintOptions: derived.trimPaintOptions,
      trimPrimerOptions: derived.trimPrimerOptions,
      orgWallPaintLabel: derived.orgWallPaintLabel,
      orgWallPrimerLabel: derived.orgWallPrimerLabel,
      orgCeilingPaintLabel: derived.orgCeilingPaintLabel,
      orgCeilingPrimerLabel: derived.orgCeilingPrimerLabel,
      orgTrimPaintLabel: derived.orgTrimPaintLabel,
      orgTrimPrimerLabel: derived.orgTrimPrimerLabel,
      effectiveWallPaintLabel: derived.effectiveWallPaintLabel,
      effectiveWallPrimerLabel: derived.effectiveWallPrimerLabel,
      effectiveCeilingPaintLabel: derived.effectiveCeilingPaintLabel,
      effectiveCeilingPrimerLabel: derived.effectiveCeilingPrimerLabel,
      effectiveTrimPaintLabel: derived.effectiveTrimPaintLabel,
      effectiveTrimPrimerLabel: derived.effectiveTrimPrimerLabel,
      updateJobSettings: settingsActions.updateJobSettings,
      updateCustomer: settingsActions.updateCustomer,
      flushCustomerSave: settingsActions.flushCustomerSave,
    }),
    [
      derived.ceilingPaintOptions,
      derived.ceilingPrimerOptions,
      derived.effectiveCeilingPaintLabel,
      derived.effectiveCeilingPrimerLabel,
      derived.effectiveTrimPaintLabel,
      derived.effectiveTrimPrimerLabel,
      derived.effectiveWallPaintLabel,
      derived.effectiveWallPrimerLabel,
      derived.orgCeilingPaintLabel,
      derived.orgCeilingPrimerLabel,
      derived.orgTrimPaintLabel,
      derived.orgTrimPrimerLabel,
      derived.orgWallPaintLabel,
      derived.orgWallPrimerLabel,
      derived.trimPaintOptions,
      derived.trimPrimerOptions,
      derived.wallPaintOptions,
      derived.wallPrimerOptions,
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

  const saveVm: EstimateV2EditorSaveVm = useMemo(
    () => ({
      dirty: derived.dirty,
      saveStatus: state.saveStatus,
      saveStatusText: derived.saveStatusText,
      saveStatusColor: derived.saveStatusColor,
      calculationsStale: derived.calculationsStale,
      debugMeta: {
        ...state.debugMeta,
        usingLocalPreview: derived.useLocalPreviewCalculations,
      },
      save,
    }),
    [
      derived.calculationsStale,
      derived.dirty,
      derived.saveStatusColor,
      derived.saveStatusText,
      derived.useLocalPreviewCalculations,
      save,
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
      titleText: state.estimate?.version_name ?? 'Quote Version',
      subtitleText: buildHeaderSubtitle(state.job),
      workflowText: 'Walls-first wizard - Rooms',
      dirtyStateText: derived.dirty ? 'unsaved - live preview' : null,
      dirty: derived.dirty,
      saving: state.saving,
      toggleSettings: () => meta.setSettingsOpen((open) => !open),
      addRoom,
    }),
    [addRoom, derived.dirty, estimateId, meta, state.estimate?.version_name, state.job, state.saving]
  )

  const wallSectionSummary = useMemo(
    () =>
      buildSectionSummaryVm({
        visible: derived.wallsIncluded,
        title: 'Walls',
        modeLabel: derived.selectedRoomGeometryMode,
        primaryValue: toDisplayNumber(derived.selectedRoomEffectiveSqFt),
        primaryUnit: 'Sq Ft',
        paintLabel: derived.wallPaintLabel,
        primerLabel: derived.wallPrimerLabel,
        chips: buildSectionSummaryChips({
          modeLabel: derived.selectedRoomGeometryMode,
          primaryValue: toDisplayNumber(derived.selectedRoomEffectiveSqFt),
          primaryUnit: 'Sq Ft',
          paintLabel: derived.wallPaintLabel,
          primerLabel: derived.wallPrimerLabel,
          validationIssueCount: derived.selectedRoomIssueCount,
        }),
      }),
    [
      derived.selectedRoomEffectiveSqFt,
      derived.selectedRoomGeometryMode,
      derived.selectedRoomIssueCount,
      derived.wallPaintLabel,
      derived.wallPrimerLabel,
      derived.wallsIncluded,
    ]
  )

  const ceilingSectionSummary = useMemo(
    () =>
      buildSectionSummaryVm({
        visible: derived.ceilingsIncluded,
        title: 'Ceilings',
        modeLabel: derived.selectedRoomGeometryMode,
        primaryValue: toDisplayNumber(derived.selectedCeilingEffectiveSqFt),
        primaryUnit: 'Sq Ft',
        paintLabel: derived.ceilingPaintLabel,
        primerLabel: derived.ceilingPrimerLabel,
        chips: buildSectionSummaryChips({
          modeLabel: derived.selectedRoomGeometryMode,
          primaryValue: toDisplayNumber(derived.selectedCeilingEffectiveSqFt),
          primaryUnit: 'Sq Ft',
          paintLabel: derived.ceilingPaintLabel,
          primerLabel: derived.ceilingPrimerLabel,
          validationIssueCount: derived.selectedRoomIssueCount,
        }),
      }),
    [
      derived.ceilingPaintLabel,
      derived.ceilingPrimerLabel,
      derived.ceilingsIncluded,
      derived.selectedCeilingEffectiveSqFt,
      derived.selectedRoomGeometryMode,
      derived.selectedRoomIssueCount,
    ]
  )

  const trimSectionSummary = useMemo(
    () =>
      buildSectionSummaryVm({
        visible: derived.trimsIncluded,
        title: 'Trim',
        primaryValue: toDisplayNumber(derived.selectedTrimMeasurement),
        primaryUnit: 'LF / EA / SF',
        paintLabel: derived.trimPaintLabel,
        primerLabel: derived.trimPrimerLabel,
        secondaryValue:
          derived.selectedTrimSubtotal == null
            ? '--'
            : `$${derived.selectedTrimSubtotal.toFixed(2)}`,
        secondaryLabel: 'Subtotal',
        chips: buildSectionSummaryChips({
          itemCount: derived.selectedRoomTrimScopes.length,
          primaryValue: toDisplayNumber(derived.selectedTrimMeasurement),
          primaryUnit: 'Measure',
          paintLabel: derived.trimPaintLabel,
          primerLabel: derived.trimPrimerLabel,
          secondaryValue:
            derived.selectedTrimSubtotal == null
              ? '--'
              : `$${derived.selectedTrimSubtotal.toFixed(2)}`,
          secondaryLabel: 'Subtotal',
        }),
      }),
    [
      derived.selectedRoomTrimScopes.length,
      derived.selectedTrimMeasurement,
      derived.selectedTrimSubtotal,
      derived.trimPaintLabel,
      derived.trimPrimerLabel,
      derived.trimsIncluded,
    ]
  )

  const scopeToggleLabels = useMemo(
    () =>
      buildScopeToggleLabels({
        wallsIncluded: derived.wallsIncluded,
        ceilingsIncluded: derived.ceilingsIncluded,
        trimsIncluded: derived.trimsIncluded,
      }),
    [derived.ceilingsIncluded, derived.trimsIncluded, derived.wallsIncluded]
  )

  const summaryVm: EstimateV2EditorSummaryVm = useMemo(() => {
    const includedScopeLabels = buildIncludedScopeLabels({
      wallsIncluded: derived.wallsIncluded,
      ceilingsIncluded: derived.ceilingsIncluded,
      trimsIncluded: derived.trimsIncluded,
    })
    const validationState = buildValidationState(state.validationIssues.length)
    const calculationState = buildCalculationState(derived.calculationsStale)
    const selectedRoomName = derived.selectedRoom?.roomName || 'Unnamed room'
    const roomSubtitle = buildRoomSubtitle(selectedRoomName, includedScopeLabels)

    return {
      roomLabel: derived.selectedRoom?.roomId ?? '--',
      roomName: selectedRoomName,
      roomSubtitle,
      includedScopeLabels,
      scopeToggleLabels,
      validationText: validationState.text,
      validationColor: validationState.color,
      calculationStateText: calculationState.text,
      calculationStateColor: calculationState.color,
      totalEffectiveAreaText: `${toDisplayNumber(derived.totalEffectiveAreaSqFt)} sf`,
      runningTotalLabel: buildRunningTotalLabel(state.rooms.length),
      saveStatusText: derived.saveStatusText,
      saveStatusColor: derived.saveStatusColor,
      walls: wallSectionSummary,
      ceilings: ceilingSectionSummary,
      trim: trimSectionSummary,
    }
  }, [
    derived.calculationsStale,
    derived.ceilingsIncluded,
    derived.saveStatusColor,
    derived.saveStatusText,
    derived.selectedRoom,
    derived.totalEffectiveAreaSqFt,
    derived.trimsIncluded,
    derived.wallsIncluded,
    ceilingSectionSummary,
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
