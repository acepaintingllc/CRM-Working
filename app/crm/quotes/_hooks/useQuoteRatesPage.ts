'use client'

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
  saving: boolean
  activeCategory: ReturnType<typeof useQuoteRatesFilters>['activeCategory']
  selectedRow: ReturnType<typeof useQuoteRatesEditorState>['selectedRow']
  isCreating: boolean
  inlineValidation: string | null
  canSave: boolean
  formatDraftValue: ReturnType<typeof useQuoteRatesEditorState>['formatDraftValue']
}

export type QuoteRatesActions = {
  setActiveTab: ReturnType<typeof useQuoteRatesFilters>['setActiveTab']
  setRateSection: ReturnType<typeof useQuoteRatesFilters>['setRateSection']
  setRateCategory: ReturnType<typeof useQuoteRatesFilters>['setRateCategory']
  setFlagsSection: ReturnType<typeof useQuoteRatesFilters>['setFlagsSection']
  setRoomDefaultsSection: ReturnType<typeof useQuoteRatesFilters>['setRoomDefaultsSection']
  setStatusFilter: ReturnType<typeof useQuoteRatesFilters>['setStatusFilter']
  setSearch: ReturnType<typeof useQuoteRatesFilters>['setSearch']
  setSelectedId: ReturnType<typeof useQuoteRatesEditorState>['setSelectedId']
  setDraftActive: ReturnType<typeof useQuoteRatesEditorState>['setDraftActive']
  reload: (keepId?: string) => Promise<boolean>
  saveCurrent: () => Promise<void>
  archiveOrReactivate: (nextActive: boolean) => Promise<void>
  startCreate: () => void
  startDuplicate: () => void
  cancelEdit: () => void
  updateDraftValue: ReturnType<typeof useQuoteRatesEditorState>['updateDraftValue']
}

export function useQuoteRatesPage() {
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
      saving: feedback.saving,
      activeCategory: filters.activeCategory,
      selectedRow: editor.selectedRow,
      isCreating: editor.isCreating,
      inlineValidation: uiState.inlineValidation,
      canSave: uiState.canSave,
      formatDraftValue: editor.formatDraftValue,
    } satisfies QuoteRatesEditorVm,
    actions: {
      setActiveTab: filters.setActiveTab,
      setRateSection: filters.setRateSection,
      setRateCategory: filters.setRateCategory,
      setFlagsSection: filters.setFlagsSection,
      setRoomDefaultsSection: filters.setRoomDefaultsSection,
      setStatusFilter: filters.setStatusFilter,
      setSearch: filters.setSearch,
      setSelectedId: editor.setSelectedId,
      setDraftActive: editor.setDraftActive,
      reload: controllerActions.reload,
      saveCurrent: controllerActions.saveCurrent,
      archiveOrReactivate: controllerActions.archiveOrReactivate,
      startCreate: controllerActions.startCreate,
      startDuplicate: controllerActions.startDuplicate,
      cancelEdit: controllerActions.cancelEdit,
      updateDraftValue: editor.updateDraftValue,
    } satisfies QuoteRatesActions,
  }
}
