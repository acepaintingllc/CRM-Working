'use client'

import {
  buildRatesFlagsSearchableText,
  categoryByKey,
  createRatesFlagsDraftSnapshot,
} from '@/lib/quotes/ratesFlagsForm'
import {
  getRatesFlagsDraftAdapter,
  isRatesFlagsEditableCategoryKey,
} from '@/lib/quotes/ratesFlagsDraftAdapters'
import type {
  RatesFlagsCategory,
  RatesFlagsCategoryKey,
  RatesFlagsEditableCategory,
  RatesFlagsEditableCategoryKey,
  RatesFlagsPayload,
  RatesFlagsRow,
} from '@/types/estimator/ratesFlags'
import type { QuoteRatesNavigationState, QuoteRatesEditorSnapshot } from './quoteRatesPageState'
import { emptyQuoteRatesEditorSnapshot, getDefaultRateCategory } from './quoteRatesPageState'

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

export function buildQuoteRatesEditorSnapshotFromSelection(
  category: RatesFlagsCategory | null,
  selectedId: string
): QuoteRatesEditorSnapshot {
  if (!category || !selectedId) return emptyQuoteRatesEditorSnapshot()

  const selectedRow = category.rows.find((row) => row.id === selectedId) ?? null
  if (!selectedRow) return emptyQuoteRatesEditorSnapshot()

  const adapter = getRatesFlagsDraftAdapter(category.key as RatesFlagsEditableCategoryKey)
  const draft = adapter.rowToDraft(
    category as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>,
    selectedRow
  )

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

export function applyNavigationIntent(
  navigation: QuoteRatesNavigationState,
  intent: import('./quoteRatesPageState').QuoteRatesPendingTransition
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
