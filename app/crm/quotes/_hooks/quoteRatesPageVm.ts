'use client'

import { buildDenseQuotePageUiState } from '@/app/crm/quotes/_hooks/denseQuotePageUiState'
import type { RatesFlagsDraftAdapter } from '@/lib/quotes/ratesFlagsDraftAdapters'
import type {
  RatesFlagsCategory,
  RatesFlagsDraft,
  RatesFlagsEditableCategory,
  RatesFlagsEditableCategoryKey,
  RatesFlagsRow,
} from '@/types/estimator/ratesFlags'
import type { QuoteRatesDataResource } from './useQuoteRatesData'
import type {
  QuoteRatesDerivedState,
  QuoteRatesPendingTransition,
  QuoteRatesWorkflowState,
} from './quoteRatesPageState'

export type QuoteRatesFiltersVm = {
  search: string
  statusFilter: import('./quoteRatesPageConfig').StatusFilter
  activeTab: import('./quoteRatesPageConfig').QuoteRatesTopTab
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
  busy: boolean
  activeCategory: RatesFlagsCategory | null
  canEditCategory: boolean
  showLegacyCategoryNotice: boolean
  selectedRow: RatesFlagsRow | null
  isCreating: boolean
  inlineValidation: string | null
  canSave: boolean
  activeSettingSet: import('@/types/estimator/ratesFlags').RatesFlagsSettingSetMetadata | null
  draftSettingSet: import('@/types/estimator/ratesFlags').RatesFlagsSettingSetMetadata | null
  editingSettingSet: import('@/types/estimator/ratesFlags').RatesFlagsSettingSetMetadata | null
  canActivateDraft: boolean
  activating: boolean
}

export type QuoteRatesDiscardVm = {
  status: 'idle' | 'confirming' | 'applying'
  isOpen: boolean
  transitionType: QuoteRatesPendingTransition['type'] | null
}

export function formatRatesDraftValue<TKey extends RatesFlagsEditableCategoryKey>(
  adapter: RatesFlagsDraftAdapter<TKey> | null,
  category: RatesFlagsEditableCategory<TKey> | null,
  draft: RatesFlagsDraft<TKey> | null,
  fieldKey: string
) {
  if (!adapter || !category || !draft) return ''

  return adapter.formatDraftValue(category, draft, fieldKey)
}

export function buildQuoteRatesPageVm(params: {
  resource: QuoteRatesDataResource
  workflowState: QuoteRatesWorkflowState
  derived: QuoteRatesDerivedState
}) {
  const { resource, workflowState, derived } = params

  const hasData = resource.data.categories.length > 0
  const actionIsIdle = workflowState.actionStatus === 'idle'
  const isCreating = workflowState.editorMode === 'create'
  const canEditCategory = Boolean(derived.editableActiveCategory)
  const showLegacyCategoryNotice =
    derived.activeCategory !== null &&
    !canEditCategory &&
    !isCreating &&
    workflowState.draft === null
  const uiState = buildDenseQuotePageUiState({
    loading: resource.loading,
    hasData,
    loadError: resource.error,
    actionError: workflowState.actionError,
    validationError: derived.validationError,
    notice: workflowState.notice,
    noticeTone: workflowState.noticeTone,
    canRetry: !resource.loading && actionIsIdle,
    canSave:
      Boolean(derived.activeCategory) &&
      actionIsIdle &&
      !resource.error &&
      Boolean(derived.validationResult?.ok),
    canArchiveToggle:
      Boolean(derived.selectedRow) &&
      workflowState.editorMode !== 'create' &&
      actionIsIdle &&
      !resource.loading &&
      !resource.error,
    canDuplicate:
      Boolean(derived.selectedRow) &&
      actionIsIdle &&
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
    uiState,
    filtersVm,
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
    tableVm: {
      activeCategory: derived.activeCategory,
      filteredRows: derived.filteredRows,
      selectedRow: derived.selectedRow,
      selectedId: workflowState.selectedId,
      isCreating,
      canDuplicate: uiState.canDuplicate,
      canArchiveToggle: uiState.canArchiveToggle,
    } satisfies QuoteRatesTableVm,
    editorVm: {
      draft: workflowState.draft,
      draftActive: workflowState.draftActive,
      isDirty: derived.isDirty,
      saving: workflowState.actionStatus === 'saving',
      busy: !actionIsIdle,
      activeCategory: derived.activeCategory,
      canEditCategory,
      showLegacyCategoryNotice,
      selectedRow: derived.selectedRow,
      isCreating,
      inlineValidation: uiState.inlineValidation,
      canSave: uiState.canSave,
      activeSettingSet: resource.data.active_setting_set ?? null,
      draftSettingSet: resource.data.draft_setting_set ?? null,
      editingSettingSet: resource.data.editing_setting_set ?? null,
      canActivateDraft:
        Boolean(resource.data.draft_setting_set) &&
        actionIsIdle &&
        !resource.loading &&
        !resource.error &&
        !derived.isDirty,
      activating: workflowState.actionStatus === 'activating',
    } satisfies QuoteRatesEditorVm,
    discardVm: {
      isOpen:
        workflowState.discardStatus === 'confirming' && Boolean(workflowState.pendingTransition),
      status: workflowState.discardStatus,
      transitionType: workflowState.pendingTransition?.type ?? null,
    } satisfies QuoteRatesDiscardVm,
  }
}
