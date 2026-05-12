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
  pendingChangesCount: number
  activeSettingSet: import('@/types/estimator/ratesFlags').RatesFlagsSettingSetMetadata | null
}

export type QuoteRatesDiscardVm = {
  status: 'idle' | 'confirming' | 'applying'
  isOpen: boolean
  transitionType: QuoteRatesPendingTransition['type'] | null
}

export type QuoteRatesLeavePageVm = {
  status: 'idle' | 'confirming' | 'applying'
  isOpen: boolean
  href: string | null
  saving: boolean
  canSave: boolean
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
  const editorHasValidationIssue = Boolean(workflowState.draft && derived.validationError)
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
      workflowState.pendingMutations.length > 0 &&
      actionIsIdle &&
      !resource.error &&
      !editorHasValidationIssue,
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
      pendingChangesCount: workflowState.pendingMutations.length,
      activeSettingSet: resource.data.active_setting_set ?? null,
    } satisfies QuoteRatesEditorVm,
    discardVm: {
      isOpen:
        workflowState.discardStatus === 'confirming' &&
        Boolean(workflowState.pendingTransition) &&
        workflowState.pendingTransition?.type !== 'leavePage',
      status: workflowState.discardStatus,
      transitionType: workflowState.pendingTransition?.type ?? null,
    } satisfies QuoteRatesDiscardVm,
    leavePageVm: {
      isOpen:
        workflowState.discardStatus === 'confirming' &&
        workflowState.pendingTransition?.type === 'leavePage',
      status: workflowState.discardStatus,
      href:
        workflowState.pendingTransition?.type === 'leavePage'
          ? workflowState.pendingTransition.href
          : null,
      saving: workflowState.actionStatus === 'saving',
      canSave: uiState.canSave,
    } satisfies QuoteRatesLeavePageVm,
  }
}
