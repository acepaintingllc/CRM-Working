'use client'

import { buildDenseQuotePageUiState } from '@/app/crm/quotes/_hooks/denseQuotePageUiState'
import { valueFromRatesFlagsRow } from '@/lib/quotes/ratesFlagsForm'
import type {
  RatesFlagsCategory,
  RatesFlagsDraft,
  RatesFlagsEditableCategory,
  RatesFlagsEditableCategoryKey,
  RatesFlagsRow,
  RatesFlagsTab,
} from '@/types/estimator/ratesFlags'
import { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'
import {
  getDefaultRateCategory,
  type QuoteRatesNavigationState,
} from './quoteRatesPageController'
import { useQuoteRatesData } from './useQuoteRatesData'
import { useQuoteRatesDiscard } from './useQuoteRatesDiscard'
import { useQuoteRatesEditor } from './useQuoteRatesEditor'
import { useQuoteRatesMutations } from './useQuoteRatesMutations'
import { useQuoteRatesNavigation } from './useQuoteRatesNavigation'
import type { QuoteRatesPendingTransition } from './useQuoteRatesPageControllerTypes'

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
  activeTab: RatesFlagsTab
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
  transitionType:
    | 'setActiveTab'
    | 'setRateSection'
    | 'setRateCategory'
    | 'setFlagsSection'
    | 'setRoomDefaultsSection'
    | 'setStatusFilter'
    | 'setSearch'
    | 'setSelectedId'
    | 'startCreate'
    | 'startDuplicate'
    | 'reload'
    | 'archiveOrReactivate'
    | null
}

export type QuoteRatesActions = {
  setActiveTab: (activeTab: RatesFlagsTab) => boolean | Promise<boolean>
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
  confirmDiscard: () => Promise<boolean> | boolean
  cancelDiscard: () => void
  updateDraftValue: (fieldKey: string, rawInput: string) => void
}

export function useQuoteRatesPage() {
  const resource = useQuoteRatesData()
  const feedback = useDenseQuoteAdminFeedback()
  const navigation = useQuoteRatesNavigation(resource.data)
  const editor = useQuoteRatesEditor({
    activeCategory: navigation.activeCategory,
    filteredRows: navigation.filteredRows,
  })

  function setNavigationAndSelection(
    nextNavigation: QuoteRatesNavigationState,
    preferredId?: string
  ) {
    const { nextCategory, nextSelectedId } = navigation.getSelectionForNavigation(
      nextNavigation,
      preferredId
    )

    navigation.setNavigation(nextNavigation)
    editor.setSelectionState(nextCategory, nextSelectedId)
  }

  const mutations = useQuoteRatesMutations({
    resource,
    feedback,
    activeCategory: navigation.activeCategory,
    selectedRow: editor.selectedRow,
    editor: editor.editor,
    validationOk: Boolean(editor.validationResult?.ok),
    scheduleRefreshSelection: editor.scheduleRefreshSelection,
    clearScheduledRefreshSelection: editor.clearScheduledRefreshSelection,
  })

  function applyTransition(intent: QuoteRatesPendingTransition) {
    switch (intent.type) {
      case 'setActiveTab':
        setNavigationAndSelection({
          ...navigation.navigation,
          activeTab: intent.activeTab,
        })
        return true
      case 'setRateSection': {
        const rateCategory = getDefaultRateCategory(intent.rateSection)
        setNavigationAndSelection({
          ...navigation.navigation,
          activeTab: 'rates',
          rateSection: intent.rateSection,
          rateCategory,
        })
        return true
      }
      case 'setRateCategory':
        setNavigationAndSelection({
          ...navigation.navigation,
          activeTab: 'rates',
          rateCategory: intent.rateCategory as QuoteRatesNavigationState['rateCategory'],
        })
        return true
      case 'setFlagsSection':
        setNavigationAndSelection({
          ...navigation.navigation,
          activeTab: 'flags',
          flagsSection: intent.flagsSection,
        })
        return true
      case 'setRoomDefaultsSection':
        setNavigationAndSelection({
          ...navigation.navigation,
          activeTab: 'room_defaults',
          roomDefaultsSection: intent.roomDefaultsSection,
        })
        return true
      case 'setStatusFilter':
        setNavigationAndSelection(
          {
            ...navigation.navigation,
            statusFilter: intent.statusFilter,
          },
          editor.editor.selectedId
        )
        return true
      case 'setSearch':
        setNavigationAndSelection(
          {
            ...navigation.navigation,
            search: intent.search,
          },
          editor.editor.selectedId
        )
        return true
      case 'setSelectedId':
        editor.setSelectionState(navigation.activeCategory, intent.selectedId)
        return true
      case 'startCreate': {
        const started = editor.beginCreate()
        if (started) feedback.clearFeedback()
        return started
      }
      case 'startDuplicate': {
        const started = editor.beginDuplicate()
        if (started) feedback.clearFeedback()
        return started
      }
      case 'reload':
        return mutations.performReload(intent.keepId)
      case 'archiveOrReactivate':
        return mutations.archiveOrReactivate(intent.nextActive)
      default:
        return false
    }
  }

  const discard = useQuoteRatesDiscard({
    isDirtyRef: editor.isDirtyRef,
    applyTransition,
  })

  function cancelEdit() {
    editor.cancelEdit()
    discard.cancelDiscard()
    feedback.clearFeedback()
  }

  const hasData = resource.data.categories.length > 0 || (!resource.loading && !resource.error)
  const uiState = buildDenseQuotePageUiState({
    loading: resource.loading,
    hasData,
    loadError: resource.error,
    actionError: feedback.actionError,
    validationError: editor.validationError,
    notice: feedback.notice,
    canRetry: !resource.loading,
    canSave:
      Boolean(navigation.activeCategory) &&
      !feedback.saving &&
      !resource.error &&
      Boolean(editor.validationResult?.ok),
    canArchiveToggle:
      Boolean(editor.selectedRow) &&
      !editor.editor.isCreating &&
      !feedback.saving &&
      !resource.loading &&
      !resource.error,
    canDuplicate:
      Boolean(editor.selectedRow) && !feedback.saving && !resource.loading && !resource.error,
  })

  return {
    resource,
    valueFromRow: valueFromRatesFlagsRow,
    uiState,
    filtersVm: {
      search: navigation.navigation.search,
      statusFilter: navigation.navigation.statusFilter,
      activeTab: navigation.navigation.activeTab,
      rateSection: navigation.navigation.rateSection,
      rateCategory: navigation.navigation.rateCategory,
      flagsSection: navigation.navigation.flagsSection,
      roomDefaultsSection: navigation.navigation.roomDefaultsSection,
    } satisfies QuoteRatesFiltersVm,
    tableVm: {
      activeCategory: navigation.activeCategory,
      filteredRows: navigation.filteredRows,
      selectedRow: editor.selectedRow,
      selectedId: editor.editor.selectedId,
      isCreating: editor.editor.isCreating,
      canDuplicate: uiState.canDuplicate,
      canArchiveToggle: uiState.canArchiveToggle,
    } satisfies QuoteRatesTableVm,
    editorVm: {
      draft: editor.editor.draft,
      draftActive: editor.editor.draftActive,
      isDirty: editor.isDirty,
      saving: feedback.saving,
      activeCategory: navigation.activeCategory,
      selectedRow: editor.selectedRow,
      isCreating: editor.editor.isCreating,
      inlineValidation: uiState.inlineValidation,
      canSave: uiState.canSave,
      formatDraftValue: navigation.activeCategory
        ? (fieldKey: string) =>
            editor.editor.draft && editor.adapter
              ? editor.adapter.formatDraftValue(
                  navigation.activeCategory as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>,
                  editor.editor.draft as never,
                  fieldKey
                )
              : ''
        : () => '',
    } satisfies QuoteRatesEditorVm,
    actions: {
      setActiveTab: (activeTab) =>
        discard.requestTransition(
          { type: 'setActiveTab', activeTab },
          activeTab !== navigation.navigation.activeTab
        ),
      setRateSection: (rateSection) =>
        discard.requestTransition(
          { type: 'setRateSection', rateSection },
          rateSection !== navigation.navigation.rateSection
        ),
      setRateCategory: (rateCategory) =>
        discard.requestTransition(
          { type: 'setRateCategory', rateCategory },
          rateCategory !== navigation.navigation.rateCategory
        ),
      setFlagsSection: (flagsSection) =>
        discard.requestTransition(
          { type: 'setFlagsSection', flagsSection },
          flagsSection !== navigation.navigation.flagsSection
        ),
      setRoomDefaultsSection: (roomDefaultsSection) =>
        discard.requestTransition(
          { type: 'setRoomDefaultsSection', roomDefaultsSection },
          roomDefaultsSection !== navigation.navigation.roomDefaultsSection
        ),
      setStatusFilter: (statusFilter) =>
        discard.requestTransition(
          { type: 'setStatusFilter', statusFilter },
          statusFilter !== navigation.navigation.statusFilter
        ),
      setSearch: (search) =>
        discard.requestTransition(
          { type: 'setSearch', search },
          search !== navigation.navigation.search
        ),
      setSelectedId: (selectedId) =>
        discard.requestTransition(
          { type: 'setSelectedId', selectedId },
          selectedId !== editor.editor.selectedId
        ),
      setDraftActive: editor.setDraftActive,
      reload: (keepId?: string) => discard.requestTransition({ type: 'reload', keepId }, true),
      saveCurrent: mutations.saveCurrent,
      archiveOrReactivate: (nextActive: boolean) =>
        discard.requestTransition({ type: 'archiveOrReactivate', nextActive }, true),
      startCreate: () => discard.requestTransition({ type: 'startCreate' }, true),
      startDuplicate: () => discard.requestTransition({ type: 'startDuplicate' }, true),
      cancelEdit,
      confirmDiscard: discard.confirmDiscard,
      cancelDiscard: discard.cancelDiscard,
      updateDraftValue: editor.updateDraftValue,
    } satisfies QuoteRatesActions,
    discardVm: discard.discardVm satisfies QuoteRatesDiscardVm,
  }
}
