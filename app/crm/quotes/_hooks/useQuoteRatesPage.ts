'use client'

<<<<<<< Updated upstream
import { buildDenseQuotePageUiState } from '@/app/crm/quotes/_hooks/denseQuotePageUiState'
import { valueFromRatesFlagsRow } from '@/lib/quotes/ratesFlagsForm'
import type { RatesFlagsTab } from '@/types/estimator/ratesFlags'
import { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'
import { useQuoteRatesData } from './useQuoteRatesData'
import { useQuoteRatesControllerActions } from './useQuoteRatesControllerActions'
import { useQuoteRatesEditorState } from './useQuoteRatesEditorState'
import { useQuoteRatesFilters } from './useQuoteRatesFilters'
import { useQuoteRatesPersistence } from './useQuoteRatesPersistence'
import { useQuoteRatesReload } from './useQuoteRatesReload'
=======
import {
  useQuoteRatesPageController,
} from './quoteRatesPageController'
import { buildQuoteRatesPageVm } from './quoteRatesPageVm'

>>>>>>> Stashed changes
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
<<<<<<< Updated upstream

export type QuoteRatesFiltersVm = {
  search: string
  statusFilter: ReturnType<typeof useQuoteRatesFilters>['statusFilter']
  activeTab: RatesFlagsTab
  rateSection: ReturnType<typeof useQuoteRatesFilters>['rateSection']
  rateCategory: ReturnType<typeof useQuoteRatesFilters>['rateCategory']
  flagsSection: ReturnType<typeof useQuoteRatesFilters>['flagsSection']
  roomDefaultsSection: ReturnType<typeof useQuoteRatesFilters>['roomDefaultsSection']
}

export type QuoteRatesTableVm = {
  activeCategory: ReturnType<typeof useQuoteRatesFilters>['activeCategory']
  filteredRows: ReturnType<typeof useQuoteRatesFilters>['filteredRows']
  selectedRow: ReturnType<typeof useQuoteRatesEditorState>['selectedRow']
  selectedId: string
  isCreating: boolean
  canDuplicate: boolean
  canArchiveToggle: boolean
}

export type QuoteRatesEditorVm = {
  draft: ReturnType<typeof useQuoteRatesEditorState>['draft']
  draftActive: boolean
  isDirty: boolean
  saving: boolean
  activeCategory: ReturnType<typeof useQuoteRatesFilters>['activeCategory']
  selectedRow: ReturnType<typeof useQuoteRatesEditorState>['selectedRow']
  isCreating: boolean
  inlineValidation: string | null
  canSave: boolean
  formatDraftValue: ReturnType<typeof useQuoteRatesEditorState>['formatDraftValue']
}

export type QuoteRatesDiscardVm = {
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
=======
export type {
  QuoteRatesDiscardVm,
  QuoteRatesEditorVm,
  QuoteRatesFiltersVm,
  QuoteRatesTableVm,
} from './quoteRatesPageVm'
>>>>>>> Stashed changes

export type QuoteRatesActions = {
  setActiveTab: ReturnType<typeof useQuoteRatesControllerActions>['setActiveTab']
  setRateSection: ReturnType<typeof useQuoteRatesControllerActions>['setRateSection']
  setRateCategory: ReturnType<typeof useQuoteRatesControllerActions>['setRateCategory']
  setFlagsSection: ReturnType<typeof useQuoteRatesControllerActions>['setFlagsSection']
  setRoomDefaultsSection: ReturnType<typeof useQuoteRatesControllerActions>['setRoomDefaultsSection']
  setStatusFilter: ReturnType<typeof useQuoteRatesControllerActions>['setStatusFilter']
  setSearch: ReturnType<typeof useQuoteRatesControllerActions>['setSearch']
  setSelectedId: ReturnType<typeof useQuoteRatesControllerActions>['setSelectedId']
  setDraftActive: ReturnType<typeof useQuoteRatesControllerActions>['setDraftActive']
  reload: ReturnType<typeof useQuoteRatesControllerActions>['reload']
  saveCurrent: ReturnType<typeof useQuoteRatesControllerActions>['saveCurrent']
  archiveOrReactivate: ReturnType<typeof useQuoteRatesControllerActions>['archiveOrReactivate']
  startCreate: ReturnType<typeof useQuoteRatesControllerActions>['startCreate']
  startDuplicate: ReturnType<typeof useQuoteRatesControllerActions>['startDuplicate']
  cancelEdit: ReturnType<typeof useQuoteRatesControllerActions>['cancelEdit']
  confirmDiscard: ReturnType<typeof useQuoteRatesControllerActions>['confirmDiscard']
  cancelDiscard: ReturnType<typeof useQuoteRatesControllerActions>['cancelDiscard']
  updateDraftValue: ReturnType<typeof useQuoteRatesControllerActions>['updateDraftValue']
}

export function useQuoteRatesPage() {
<<<<<<< Updated upstream
  const resource = useQuoteRatesData()
  const feedback = useDenseQuoteAdminFeedback()

  const filters = useQuoteRatesFilters({ payload: resource.data })
  const editor = useQuoteRatesEditorState({
    activeCategory: filters.activeCategory,
    filteredRows: filters.filteredRows,
  })
  const reload = useQuoteRatesReload({ resource, editor })

  const hasData = resource.data.categories.length > 0 || (!resource.loading && !resource.error)

  const persistence = useQuoteRatesPersistence({
    refresh: reload,
    feedback,
  })

  const controllerActions = useQuoteRatesControllerActions({
    filters,
    editor,
    persistence,
    feedback,
    reload,
  })

  const uiState = buildDenseQuotePageUiState({
    loading: resource.loading,
    hasData,
    loadError: resource.error,
    actionError: feedback.actionError,
    validationError: editor.validationError,
    notice: feedback.notice,
    canRetry: !resource.loading,
    canSave:
      Boolean(filters.activeCategory) &&
      !feedback.saving &&
      !resource.error &&
      Boolean(editor.validationResult?.ok),
    canArchiveToggle:
      Boolean(editor.selectedRow) &&
      !editor.isCreating &&
      !feedback.saving &&
      !resource.loading &&
      !resource.error,
    canDuplicate: Boolean(editor.selectedRow) && !feedback.saving && !resource.loading && !resource.error,
  })

  return {
    resource,
    valueFromRow: valueFromRatesFlagsRow,
    uiState,
    filtersVm: {
      search: filters.search,
      statusFilter: filters.statusFilter,
      activeTab: filters.activeTab as RatesFlagsTab,
      rateSection: filters.rateSection,
      rateCategory: filters.rateCategory,
      flagsSection: filters.flagsSection,
      roomDefaultsSection: filters.roomDefaultsSection,
    } satisfies QuoteRatesFiltersVm,
    tableVm: {
      activeCategory: filters.activeCategory,
      filteredRows: filters.filteredRows,
      selectedRow: editor.selectedRow,
      selectedId: editor.selectedId,
      isCreating: editor.isCreating,
      canDuplicate: uiState.canDuplicate,
      canArchiveToggle: uiState.canArchiveToggle,
    } satisfies QuoteRatesTableVm,
    editorVm: {
      draft: editor.draft,
      draftActive: editor.draftActive,
      isDirty: editor.isDirty,
      saving: feedback.saving,
      activeCategory: filters.activeCategory,
      selectedRow: editor.selectedRow,
      isCreating: editor.isCreating,
      inlineValidation: uiState.inlineValidation,
      canSave: uiState.canSave,
      formatDraftValue: editor.formatDraftValue,
    } satisfies QuoteRatesEditorVm,
=======
  const controller = useQuoteRatesPageController()
  const { resource, workflowState, derived } = controller
  const pageVm = buildQuoteRatesPageVm({ resource, workflowState, derived })

  return {
    resource,
    valueFromRow: controller.valueFromRow,
    workflowVm: pageVm.workflowVm,
    uiState: pageVm.uiState,
    filtersVm: pageVm.filtersVm,
    tableVm: pageVm.tableVm,
    editorVm: pageVm.editorVm,
>>>>>>> Stashed changes
    actions: {
      setActiveTab: controllerActions.setActiveTab,
      setRateSection: controllerActions.setRateSection,
      setRateCategory: controllerActions.setRateCategory,
      setFlagsSection: controllerActions.setFlagsSection,
      setRoomDefaultsSection: controllerActions.setRoomDefaultsSection,
      setStatusFilter: controllerActions.setStatusFilter,
      setSearch: controllerActions.setSearch,
      setSelectedId: controllerActions.setSelectedId,
      setDraftActive: controllerActions.setDraftActive,
      reload: controllerActions.reload,
      saveCurrent: controllerActions.saveCurrent,
      archiveOrReactivate: controllerActions.archiveOrReactivate,
      startCreate: controllerActions.startCreate,
      startDuplicate: controllerActions.startDuplicate,
      cancelEdit: controllerActions.cancelEdit,
      confirmDiscard: controllerActions.confirmDiscard,
      cancelDiscard: controllerActions.cancelDiscard,
      updateDraftValue: controllerActions.updateDraftValue,
    } satisfies QuoteRatesActions,
<<<<<<< Updated upstream
    discardVm: controllerActions.discardVm satisfies QuoteRatesDiscardVm,
=======
    discardVm: pageVm.discardVm,
>>>>>>> Stashed changes
  }
}
