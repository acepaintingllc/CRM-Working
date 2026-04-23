'use client'

import { buildDenseQuotePageUiState } from '@/app/crm/quotes/_hooks/denseQuotePageUiState'
import type {
  RatesFlagsCategory,
  RatesFlagsDraft,
  RatesFlagsEditableCategory,
  RatesFlagsEditableCategoryKey,
  RatesFlagsRow,
} from '@/types/estimator/ratesFlags'
import {
  type QuoteRatesPendingTransition,
  useQuoteRatesPageController,
} from './quoteRatesPageController'

export {
  FLAGS_SECTIONS,
  RATE_SECTIONS,
  RATE_SUBGROUPS,
  ROOM_DEFAULTS_SECTIONS,
  type FlagsSectionKey,
  type RateSectionKey,
  type RoomDefaultsSectionKey,
  type StatusFilter,
} from './quoteRatesPageConfig'

export type QuoteRatesFiltersVm = {
  search: string
  statusFilter: import('./quoteRatesPageConfig').StatusFilter
  activeTab: import('@/types/estimator/ratesFlags').RatesFlagsTab
  rateSection: import('./quoteRatesPageConfig').RateSectionKey
  rateCategory: import('@/types/estimator/ratesFlags').RatesFlagsCategoryKey
  flagsSection: import('./quoteRatesPageConfig').FlagsSectionKey
  roomDefaultsSection: import('./quoteRatesPageConfig').RoomDefaultsSectionKey
}

export type QuoteRatesTableVm = {
  activeCategory: RatesFlagsCategory | null
  filteredRows: RatesFlagsRow[]
  selectedRow: RatesFlagsRow | null
  selectedId: string
  isCreating: boolean
  canDuplicate: boolean
  canArchiveToggle: boolean
}

export type QuoteRatesEditorVm = {
  draft: RatesFlagsDraft | null
  draftActive: boolean
  isDirty: boolean
  saving: boolean
  activeCategory: RatesFlagsCategory | null
  selectedRow: RatesFlagsRow | null
  isCreating: boolean
  inlineValidation: string | null
  canSave: boolean
  formatDraftValue: (fieldKey: string) => string
}

export type QuoteRatesDiscardVm = {
  status: 'idle' | 'confirming' | 'applying'
  isOpen: boolean
  transitionType: QuoteRatesPendingTransition['type'] | null
}

export type QuoteRatesActions = {
  setActiveTab: (
    activeTab: import('@/types/estimator/ratesFlags').RatesFlagsTab
  ) => boolean | Promise<boolean>
  setRateSection: (
    rateSection: import('./quoteRatesPageConfig').RateSectionKey
  ) => boolean | Promise<boolean>
  setRateCategory: (rateCategory: string) => boolean | Promise<boolean>
  setFlagsSection: (
    flagsSection: import('./quoteRatesPageConfig').FlagsSectionKey
  ) => boolean | Promise<boolean>
  setRoomDefaultsSection: (
    roomDefaultsSection: import('./quoteRatesPageConfig').RoomDefaultsSectionKey
  ) => boolean | Promise<boolean>
  setStatusFilter: (
    statusFilter: import('./quoteRatesPageConfig').StatusFilter
  ) => boolean | Promise<boolean>
  setSearch: (search: string) => boolean | Promise<boolean>
  setSelectedId: (selectedId: string) => boolean | Promise<boolean>
  setDraftActive: (nextActive: boolean) => void
  reload: (keepId?: string) => Promise<boolean> | boolean
  saveCurrent: () => Promise<void>
  archiveOrReactivate: (nextActive: boolean) => Promise<boolean> | boolean
  startCreate: () => boolean | Promise<boolean>
  startDuplicate: () => boolean | Promise<boolean>
  cancelEdit: () => void
  confirmDiscard: () => Promise<boolean>
  cancelDiscard: () => void
  updateDraftValue: (fieldKey: string, rawInput: string) => void
}

export function useQuoteRatesPage() {
  const controller = useQuoteRatesPageController()
  const { resource, workflowState, derived } = controller

  const hasData = resource.data.categories.length > 0 || (!resource.loading && !resource.error)
  const uiState = buildDenseQuotePageUiState({
    loading: resource.loading,
    hasData,
    loadError: resource.error,
    actionError: workflowState.actionError,
    validationError: derived.validationError,
    notice: workflowState.notice,
    noticeTone: workflowState.noticeTone,
    canRetry: !resource.loading,
    canSave:
      Boolean(derived.activeCategory) &&
      workflowState.actionStatus !== 'saving' &&
      !resource.error &&
      Boolean(derived.validationResult?.ok),
    canArchiveToggle:
      Boolean(derived.selectedRow) &&
      workflowState.editorMode !== 'create' &&
      workflowState.actionStatus === 'idle' &&
      !resource.loading &&
      !resource.error,
    canDuplicate:
      Boolean(derived.selectedRow) &&
      workflowState.actionStatus === 'idle' &&
      !resource.loading &&
      !resource.error,
  })

  const filtersVm = {
    search: workflowState.navigation.search,
    statusFilter: workflowState.navigation.statusFilter,
    activeTab: workflowState.navigation.activeTab,
    rateSection: workflowState.navigation.rateSection,
    rateCategory: workflowState.navigation.rateCategory,
    flagsSection: workflowState.navigation.flagsSection,
    roomDefaultsSection: workflowState.navigation.roomDefaultsSection,
  } satisfies QuoteRatesFiltersVm

  return {
    resource,
    valueFromRow: controller.valueFromRow,
    workflowVm: {
      navigation: workflowState.navigation,
      selectedId: workflowState.selectedId,
      editorMode: workflowState.editorMode,
      dirty: derived.isDirty,
      pendingTransition: workflowState.pendingTransition,
      actionStatus: workflowState.actionStatus,
      refreshSelectionId: workflowState.refreshSelectionId,
      forceRefreshRehydrate: workflowState.forceRefreshRehydrate,
    },
    uiState,
    filtersVm,
    tableVm: {
      activeCategory: derived.activeCategory,
      filteredRows: derived.filteredRows,
      selectedRow: derived.selectedRow,
      selectedId: workflowState.selectedId,
      isCreating: workflowState.editorMode === 'create',
      canDuplicate: uiState.canDuplicate,
      canArchiveToggle: uiState.canArchiveToggle,
    } satisfies QuoteRatesTableVm,
    editorVm: {
      draft: workflowState.draft,
      draftActive: workflowState.draftActive,
      isDirty: derived.isDirty,
      saving: workflowState.actionStatus === 'saving',
      activeCategory: derived.activeCategory,
      selectedRow: derived.selectedRow,
      isCreating: workflowState.editorMode === 'create',
      inlineValidation: uiState.inlineValidation,
      canSave: uiState.canSave,
      formatDraftValue: derived.activeCategory
        ? (fieldKey: string) =>
            workflowState.draft && derived.adapter
              ? derived.adapter.formatDraftValue(
                  derived.activeCategory as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>,
                  workflowState.draft as never,
                  fieldKey
                )
              : ''
        : () => '',
    } satisfies QuoteRatesEditorVm,
    actions: {
      setActiveTab: (activeTab) =>
        controller.actions.requestTransition(
          { type: 'setActiveTab', activeTab },
          activeTab !== workflowState.navigation.activeTab
        ),
      setRateSection: (rateSection) =>
        controller.actions.requestTransition(
          { type: 'setRateSection', rateSection },
          rateSection !== workflowState.navigation.rateSection
        ),
      setRateCategory: (rateCategory) =>
        controller.actions.requestTransition(
          { type: 'setRateCategory', rateCategory },
          rateCategory !== workflowState.navigation.rateCategory
        ),
      setFlagsSection: (flagsSection) =>
        controller.actions.requestTransition(
          { type: 'setFlagsSection', flagsSection },
          flagsSection !== workflowState.navigation.flagsSection
        ),
      setRoomDefaultsSection: (roomDefaultsSection) =>
        controller.actions.requestTransition(
          { type: 'setRoomDefaultsSection', roomDefaultsSection },
          roomDefaultsSection !== workflowState.navigation.roomDefaultsSection
        ),
      setStatusFilter: (statusFilter) =>
        controller.actions.requestTransition(
          { type: 'setStatusFilter', statusFilter },
          statusFilter !== workflowState.navigation.statusFilter
        ),
      setSearch: (search) =>
        controller.actions.requestTransition(
          { type: 'setSearch', search },
          search !== workflowState.navigation.search
        ),
      setSelectedId: (selectedId) =>
        controller.actions.requestTransition(
          { type: 'setSelectedId', selectedId },
          selectedId !== workflowState.selectedId
        ),
      setDraftActive: controller.actions.setDraftActive,
      reload: (keepId?: string) =>
        controller.actions.requestTransition({ type: 'reload', keepId }, true),
      saveCurrent: controller.actions.saveCurrent,
      archiveOrReactivate: (nextActive: boolean) =>
        controller.actions.requestTransition({ type: 'archiveOrReactivate', nextActive }, true),
      startCreate: () => controller.actions.requestTransition({ type: 'startCreate' }, true),
      startDuplicate: () => controller.actions.requestTransition({ type: 'startDuplicate' }, true),
      cancelEdit: controller.actions.cancelEdit,
      confirmDiscard: controller.actions.confirmDiscard,
      cancelDiscard: controller.actions.cancelDiscard,
      updateDraftValue: controller.actions.updateDraftValue,
    } satisfies QuoteRatesActions,
    discardVm: {
      isOpen:
        workflowState.discardStatus === 'confirming' && Boolean(workflowState.pendingTransition),
      status: workflowState.discardStatus,
      transitionType: workflowState.pendingTransition?.type ?? null,
    } satisfies QuoteRatesDiscardVm,
  }
}
