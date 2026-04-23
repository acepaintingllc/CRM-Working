'use client'

import { buildRatesFlagsSearchableText, categoryByKey } from '@/lib/quotes/ratesFlagsForm'
import type {
  RatesFlagsCategory,
  RatesFlagsCategoryKey,
  RatesFlagsPayload,
  RatesFlagsRow,
  RatesFlagsTab,
} from '@/types/estimator/ratesFlags'
import type {
  FlagsSectionKey,
  RateSectionKey,
  RoomDefaultsSectionKey,
  StatusFilter,
} from './quoteRatesPageConfig'
import { RATE_SUBGROUPS } from './quoteRatesPageConfig'

export type QuoteRatesNavigationState = {
  activeTab: RatesFlagsTab
  rateSection: RateSectionKey
  rateCategory: RatesFlagsCategoryKey
  flagsSection: FlagsSectionKey
  roomDefaultsSection: RoomDefaultsSectionKey
  statusFilter: StatusFilter
  search: string
}

export const DEFAULT_QUOTE_RATES_NAVIGATION: QuoteRatesNavigationState = {
  activeTab: 'rates',
  rateSection: 'production',
  rateCategory: 'production_rates_walls',
  flagsSection: 'condition_modifiers',
  roomDefaultsSection: 'room_types',
  statusFilter: 'active',
  search: '',
}

export function getDefaultRateCategory(rateSection: RateSectionKey): RatesFlagsCategoryKey {
  return RATE_SUBGROUPS[rateSection][0]?.key ?? 'production_rates_walls'
}

export function resolveActiveCategoryKey(
  navigation: QuoteRatesNavigationState
): RatesFlagsCategoryKey {
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
