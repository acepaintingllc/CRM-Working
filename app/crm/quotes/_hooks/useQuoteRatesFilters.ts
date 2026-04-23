'use client'

import { useEffect, useMemo, useState } from 'react'
import { buildRatesFlagsSearchableText, categoryByKey } from '@/lib/quotes/ratesFlagsForm'
import type { RatesFlagsCategoryKey, RatesFlagsPayload, RatesFlagsTab } from '@/types/estimator/ratesFlags'
import type {
  FlagsSectionKey,
  RateSectionKey,
  RoomDefaultsSectionKey,
  StatusFilter,
} from './quoteRatesPageConfig'
import { RATE_SUBGROUPS } from './quoteRatesPageConfig'

type Options = {
  payload: RatesFlagsPayload
}

export function useQuoteRatesFilters({ payload }: Options) {
  const [activeTab, setActiveTab] = useState<RatesFlagsTab>('rates')
  const [rateSection, setRateSection] = useState<RateSectionKey>('production')
  const [rateCategory, setRateCategory] =
    useState<RatesFlagsCategoryKey>('production_rates_walls')
  const [flagsSection, setFlagsSection] =
    useState<FlagsSectionKey>('condition_modifiers')
  const [roomDefaultsSection, setRoomDefaultsSection] =
    useState<RoomDefaultsSectionKey>('room_types')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const defaultKey = RATE_SUBGROUPS[rateSection][0]?.key
    if (!defaultKey) return
    if (!RATE_SUBGROUPS[rateSection].some((entry) => entry.key === rateCategory)) {
      setRateCategory(defaultKey)
    }
  }, [rateCategory, rateSection])

  const activeCategoryKey = useMemo<RatesFlagsCategoryKey>(() => {
    if (activeTab === 'rates') return rateCategory
    if (activeTab === 'flags') return flagsSection
    return roomDefaultsSection
  }, [activeTab, flagsSection, rateCategory, roomDefaultsSection])

  const activeCategory = categoryByKey(payload.categories, activeCategoryKey)

  const filteredRows = useMemo(() => {
    if (!activeCategory) return []
    const q = search.trim().toLowerCase()
    return activeCategory.rows.filter((row) => {
      const statusMatch =
        statusFilter === 'all' ||
        (statusFilter === 'active' && row.active) ||
        (statusFilter === 'archived' && !row.active)
      if (!statusMatch) return false
      if (!q) return true
      return buildRatesFlagsSearchableText(activeCategory, row).includes(q)
    })
  }, [activeCategory, search, statusFilter])

  return {
    activeTab,
    setActiveTab,
    rateSection,
    setRateSection,
    rateCategory,
    setRateCategory,
    flagsSection,
    setFlagsSection,
    roomDefaultsSection,
    setRoomDefaultsSection,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    activeCategory,
    filteredRows,
  }
}
