'use client'

import { useMemo, useState } from 'react'
import type { RatesFlagsPayload } from '@/types/estimator/ratesFlags'
import {
  DEFAULT_QUOTE_RATES_NAVIGATION,
  getFilteredRows,
  getNextSelectedId,
  resolveActiveCategory,
  type QuoteRatesNavigationState,
} from './quoteRatesPageController'

export function useQuoteRatesNavigation(data: RatesFlagsPayload) {
  const [navigation, setNavigation] = useState<QuoteRatesNavigationState>(
    DEFAULT_QUOTE_RATES_NAVIGATION
  )

  const activeCategory = useMemo(
    () => resolveActiveCategory(data, navigation),
    [data, navigation]
  )

  const filteredRows = useMemo(
    () =>
      getFilteredRows(activeCategory, {
        search: navigation.search,
        statusFilter: navigation.statusFilter,
      }),
    [activeCategory, navigation.search, navigation.statusFilter]
  )

  function getSelectionForNavigation(nextNavigation: QuoteRatesNavigationState, preferredId?: string) {
    const nextCategory = resolveActiveCategory(data, nextNavigation)
    const nextFilteredRows = getFilteredRows(nextCategory, {
      search: nextNavigation.search,
      statusFilter: nextNavigation.statusFilter,
    })

    return {
      nextCategory,
      nextSelectedId: getNextSelectedId(nextFilteredRows, preferredId),
    }
  }

  return {
    navigation,
    setNavigation,
    activeCategory,
    filteredRows,
    getSelectionForNavigation,
  }
}
