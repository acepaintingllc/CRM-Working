'use client'

import {
  buildRatesFlagsSearchableText,
  categoryByKey,
  createRatesFlagsDraftSnapshot,
} from '@/lib/quotes/ratesFlagsForm'
import {
  getRatesFlagsDraftAdapter,
  isRatesFlagsEditableCategory,
  isRatesFlagsEditableCategoryKey,
} from '@/lib/quotes/ratesFlagsDraftAdapters'
import type {
  RatesFlagsCategory,
  RatesFlagsCategoryKey,
  RatesFlagsPayload,
  RatesFlagsRow,
} from '@/types/estimator/ratesFlags'
import type {
  QuoteRatesControllerAction,
  QuoteRatesDerivedState,
  QuoteRatesEditorSnapshot,
  QuoteRatesNavigationState,
  QuoteRatesPendingTransition,
  QuoteRatesWorkflowState,
} from './quoteRatesPageState'
import {
  emptyQuoteRatesEditorSnapshot,
  getDefaultRateCategory,
  getQuoteRatesHasUnsavedChanges,
} from './quoteRatesPageState'

export type QuoteRatesTransitionPlan =
  | { kind: 'navigation'; navigation: QuoteRatesNavigationState; preserveSelectedId: boolean }
  | { kind: 'selection'; selectedId: string }
  | { kind: 'startCreate' }
  | { kind: 'startDuplicate' }
  | { kind: 'reload'; keepId?: string }
  | { kind: 'archiveOrReactivate'; nextActive: boolean }
  | { kind: 'noop' }

export function resolveActiveCategoryKey(navigation: QuoteRatesNavigationState) {
  if (navigation.activeTab === 'rates') return navigation.rateCategory
  if (navigation.activeTab === 'flags') return navigation.flagsSection
  return navigation.roomDefaultsSection
}

export function resolveActiveCategory(
  payload: RatesFlagsPayload,
  navigation: QuoteRatesNavigationState
): RatesFlagsCategory | null {
  return categoryByKey(payload.categories, resolveActiveCategoryKey(navigation))
}

export function getFilteredRows(
  activeCategory: RatesFlagsCategory | null,
  navigation: Pick<QuoteRatesNavigationState, 'search' | 'statusFilter'>
): RatesFlagsRow[] {
  if (!activeCategory) return []

  const query = navigation.search.trim().toLowerCase()
  return activeCategory.rows.filter((row) => {
    const statusMatch =
      navigation.statusFilter === 'all' ||
      (navigation.statusFilter === 'active' && row.active) ||
      (navigation.statusFilter === 'archived' && !row.active)
    if (!statusMatch) return false
    if (!query) return true
    return buildRatesFlagsSearchableText(activeCategory, row).includes(query)
  })
}

export function getNextSelectedId(rows: RatesFlagsRow[], preferredId?: string): string {
  if (!rows.length) return ''
  if (preferredId && rows.some((row) => row.id === preferredId)) return preferredId
  return rows[0]?.id ?? ''
}

export function getQuoteRatesCategoryContext(
  data: RatesFlagsPayload,
  navigation: QuoteRatesNavigationState
) {
  const activeCategory = resolveActiveCategory(data, navigation)
  const filteredRows = getFilteredRows(activeCategory, navigation)
  return { activeCategory, filteredRows }
}

export function getQuoteRatesSelectedRow(
  activeCategory: RatesFlagsCategory | null,
  selectedId: string
) {
  if (!activeCategory || !selectedId) return null
  return activeCategory.rows.find((row) => row.id === selectedId) ?? null
}

export function buildQuoteRatesDerivedState(
  data: RatesFlagsPayload,
  state: QuoteRatesWorkflowState
): QuoteRatesDerivedState {
  const { activeCategory, filteredRows } = getQuoteRatesCategoryContext(data, state.navigation)
  const selectedRow = getQuoteRatesSelectedRow(activeCategory, state.selectedId)
  const editableActiveCategory =
    activeCategory && isRatesFlagsEditableCategory(activeCategory) ? activeCategory : null
  const adapter = editableActiveCategory
    ? getRatesFlagsDraftAdapter(editableActiveCategory.key)
    : null
  const validationResult =
    editableActiveCategory && adapter && state.draft
      ? adapter.validateDraft(editableActiveCategory, state.draft)
      : null
  const validationError = validationResult && !validationResult.ok ? validationResult.error : null

  return {
    activeCategory,
    editableActiveCategory,
    filteredRows,
    selectedRow,
    adapter,
    validationResult,
    validationError,
    isDirty: getQuoteRatesHasUnsavedChanges(state),
  }
}

export function buildQuoteRatesEditorSnapshotFromSelection(
  category: RatesFlagsCategory | null,
  selectedId: string
): QuoteRatesEditorSnapshot {
  if (!category || !selectedId) return emptyQuoteRatesEditorSnapshot()
  if (!isRatesFlagsEditableCategory(category)) return emptyQuoteRatesEditorSnapshot()

  const selectedRow = category.rows.find((row) => row.id === selectedId) ?? null
  if (!selectedRow) return emptyQuoteRatesEditorSnapshot()

  const adapter = getRatesFlagsDraftAdapter(category.key)
  const draft = adapter.rowToDraft(category, selectedRow)

  return {
    selectedId: selectedRow.id,
    editorMode: 'selection',
    draft,
    draftActive: selectedRow.active,
    cleanSnapshot: createRatesFlagsDraftSnapshot(draft),
    cleanDraftActive: selectedRow.active,
  }
}

export function buildQuoteRatesSelectionSnapshot(
  data: RatesFlagsPayload,
  navigation: QuoteRatesNavigationState,
  preferredId?: string
) {
  const { activeCategory, filteredRows } = getQuoteRatesCategoryContext(data, navigation)
  const selectedId = getNextSelectedId(filteredRows, preferredId)
  return {
    activeCategory,
    filteredRows,
    selectedId,
    editor: buildQuoteRatesEditorSnapshotFromSelection(activeCategory, selectedId),
  }
}

export function buildQuoteRatesMutationSnapshot(
  data: RatesFlagsPayload,
  navigation: QuoteRatesNavigationState,
  selectedId: string
) {
  const activeCategory = resolveActiveCategory(data, navigation)
  const editor = buildQuoteRatesEditorSnapshotFromSelection(activeCategory, selectedId)
  return {
    selectedId: editor.selectedId,
    editor,
  }
}

export function buildQuoteRatesResourceSyncAction(
  state: QuoteRatesWorkflowState,
  resourceData: RatesFlagsPayload
): QuoteRatesControllerAction | null {
  const selection = buildQuoteRatesSelectionSnapshot(
    resourceData,
    state.navigation,
    (state.refreshSelectionId ?? state.selectedId) || undefined
  )

  const preserveCreateDraft = state.editorMode === 'create' && !state.forceRefreshRehydrate
  const selectionChanged = selection.selectedId !== state.selectedId
  const missingDraft = !state.draft

  if (
    preserveCreateDraft ||
    (!state.forceRefreshRehydrate && !selectionChanged && !missingDraft)
  ) {
    if (state.refreshSelectionId !== null || state.forceRefreshRehydrate) {
      return {
        type: 'resourceReconciled',
        ...selection,
        preserveCreateDraft,
      }
    }
    return null
  }

  return {
    type: 'resourceReconciled',
    ...selection,
    preserveCreateDraft,
  }
}

export function getQuoteRatesIntentChanged(
  state: QuoteRatesWorkflowState,
  intent: QuoteRatesPendingTransition
) {
  switch (intent.type) {
    case 'setActiveTab':
      return intent.activeTab !== state.navigation.activeTab
    case 'setRateSection':
      return intent.rateSection !== state.navigation.rateSection
    case 'setRateCategory':
      return intent.rateCategory !== state.navigation.rateCategory
    case 'setFlagsSection':
      return intent.flagsSection !== state.navigation.flagsSection
    case 'setRoomDefaultsSection':
      return intent.roomDefaultsSection !== state.navigation.roomDefaultsSection
    case 'setStatusFilter':
      return intent.statusFilter !== state.navigation.statusFilter
    case 'setSearch':
      return intent.search !== state.navigation.search
    case 'setSelectedId':
      return intent.selectedId !== state.selectedId
    case 'startCreate':
    case 'startDuplicate':
    case 'reload':
    case 'archiveOrReactivate':
      return true
    default:
      return false
  }
}

export function buildQuoteRatesTransitionPlan(
  navigation: QuoteRatesNavigationState,
  intent: QuoteRatesPendingTransition
): QuoteRatesTransitionPlan {
  switch (intent.type) {
    case 'setActiveTab':
    case 'setRateSection':
    case 'setRateCategory':
    case 'setFlagsSection':
    case 'setRoomDefaultsSection':
      return {
        kind: 'navigation',
        navigation: applyNavigationIntent(navigation, intent),
        preserveSelectedId: false,
      }
    case 'setStatusFilter':
    case 'setSearch':
      return {
        kind: 'navigation',
        navigation: applyNavigationIntent(navigation, intent),
        preserveSelectedId: true,
      }
    case 'setSelectedId':
      return { kind: 'selection', selectedId: intent.selectedId }
    case 'startCreate':
      return { kind: 'startCreate' }
    case 'startDuplicate':
      return { kind: 'startDuplicate' }
    case 'reload':
      return { kind: 'reload', keepId: intent.keepId }
    case 'archiveOrReactivate':
      return { kind: 'archiveOrReactivate', nextActive: intent.nextActive }
    default:
      return { kind: 'noop' }
  }
}

export function applyNavigationIntent(
  navigation: QuoteRatesNavigationState,
  intent: QuoteRatesPendingTransition
): QuoteRatesNavigationState {
  switch (intent.type) {
    case 'setActiveTab':
      return {
        ...navigation,
        activeTab: intent.activeTab,
      }
    case 'setRateSection':
      return {
        ...navigation,
        activeTab: 'rates',
        rateSection: intent.rateSection,
        rateCategory: getDefaultRateCategory(intent.rateSection),
      }
    case 'setRateCategory':
      const rateCategory = intent.rateCategory as RatesFlagsCategoryKey
      if (!isRatesFlagsEditableCategoryKey(rateCategory)) {
        return navigation
      }
      return {
        ...navigation,
        activeTab: 'rates',
        rateCategory,
      }
    case 'setFlagsSection':
      return {
        ...navigation,
        activeTab: 'flags',
        flagsSection: intent.flagsSection,
      }
    case 'setRoomDefaultsSection':
      return {
        ...navigation,
        activeTab: 'room_defaults',
        roomDefaultsSection: intent.roomDefaultsSection,
      }
    case 'setStatusFilter':
      return {
        ...navigation,
        statusFilter: intent.statusFilter,
      }
    case 'setSearch':
      return {
        ...navigation,
        search: intent.search,
      }
    default:
      return navigation
  }
}
