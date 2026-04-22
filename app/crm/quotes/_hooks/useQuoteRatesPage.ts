'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { loadRatesFlags, mutateRatesFlags } from '@/lib/quotes/client'
import {
  buildRatesFlagsDraftFromRow,
  categoryByKey,
  getDefaultRatesFlagsDraft,
  valueFromRatesFlagsRow,
} from '@/lib/quotes/ratesFlagsForm'
import type {
  RatesFlagsCategoryKey,
  RatesFlagsMutationAction,
  RatesFlagsPayload,
  RatesFlagsTab,
} from '@/types/estimator/ratesFlags'

export type StatusFilter = 'active' | 'archived' | 'all'
export type RateSectionKey = 'production' | 'unit_rates' | 'access_fees' | 'supplies'
export type FlagsSectionKey =
  | 'condition_modifiers'
  | 'height_factors'
  | 'wall_complexity'
  | 'ceiling_types'
export type RoomDefaultsSectionKey = 'room_types' | 'room_templates' | 'scope_defaults'

export const RATE_SECTIONS = [
  { key: 'production', label: 'Production' },
  { key: 'unit_rates', label: 'Unit Rates' },
  { key: 'access_fees', label: 'Access Fees' },
  { key: 'supplies', label: 'Supplies' },
] as const

export const RATE_SUBGROUPS: Record<
  RateSectionKey,
  Array<{
    key: RatesFlagsCategoryKey
    label: string
  }>
> = {
  production: [
    { key: 'production_rates_walls', label: 'Walls' },
    { key: 'production_rates_ceilings', label: 'Ceilings' },
    { key: 'production_rates_trim', label: 'Trim' },
  ],
  unit_rates: [
    { key: 'unit_rates_doors', label: 'Doors' },
    { key: 'unit_rates_trim', label: 'Trim Types' },
    { key: 'unit_rates_drywall', label: 'Drywall' },
  ],
  access_fees: [
    { key: 'access_fees_ladders', label: 'Ladders' },
    { key: 'access_fees_scaffolding', label: 'Scaffolding' },
    { key: 'access_fees_specialty', label: 'Specialty' },
  ],
  supplies: [
    { key: 'supply_rates_per_color', label: 'Per-Color' },
    { key: 'supply_rates_area_based', label: 'Area-Based' },
    { key: 'supply_rates_per_job', label: 'Per-Job' },
    { key: 'supply_rates_roller_covers', label: 'Roller Covers' },
  ],
}

export const FLAGS_SECTIONS = [
  { key: 'condition_modifiers', label: 'Condition Modifiers' },
  { key: 'height_factors', label: 'Height Factors' },
  { key: 'wall_complexity', label: 'Wall Complexity' },
  { key: 'ceiling_types', label: 'Ceiling Types' },
] as const

export const ROOM_DEFAULTS_SECTIONS = [
  { key: 'room_types', label: 'Room Types' },
  { key: 'room_templates', label: 'Room Templates' },
  { key: 'scope_defaults', label: 'Scope Defaults' },
] as const

const emptyRatesFlags: RatesFlagsPayload = {
  source: 'db',
  seeded: false,
  template_version: null,
  categories: [],
}

export function useQuoteRatesPage() {
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
  const [selectedId, setSelectedId] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [draftActive, setDraftActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const resource = useLoadableResource<RatesFlagsPayload>({
    initialData: emptyRatesFlags,
    load: () => loadRatesFlags(),
    getErrorMessage: (loadError: unknown) =>
      loadError instanceof Error ? loadError.message : 'Failed to load rates and flags.',
  })

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

  const activeCategory = categoryByKey(resource.data.categories, activeCategoryKey)

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
      const haystack = `${row.id} ${row.display_name} ${JSON.stringify(row)}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [activeCategory, search, statusFilter])

  useEffect(() => {
    if (!activeCategory) return
    if (isCreating) return
    const exists = filteredRows.some((row) => row.id === selectedId)
    if (exists) return
    const fallback = filteredRows[0]
    if (!fallback) {
      setSelectedId('')
      setDraft({})
      return
    }
    setSelectedId(fallback.id)
  }, [activeCategory, filteredRows, isCreating, selectedId])

  const selectedRow = useMemo(() => {
    if (!activeCategory || !selectedId) return null
    return activeCategory.rows.find((row) => row.id === selectedId) ?? null
  }, [activeCategory, selectedId])

  useEffect(() => {
    if (!activeCategory || isCreating || !selectedRow) return
    setDraft(buildRatesFlagsDraftFromRow(activeCategory, selectedRow))
    setDraftActive(selectedRow.active)
  }, [activeCategory, isCreating, selectedRow])

  async function reload(keepId?: string) {
    const ok = await resource.refresh()
    if (ok && keepId) {
      setSelectedId(keepId)
    }
  }

  async function mutate(
    action: RatesFlagsMutationAction,
    values: Record<string, unknown>,
    originalId?: string
  ) {
    if (!activeCategory) return false
    setSaving(true)
    setNotice(null)
    setError(null)
    try {
      await mutateRatesFlags({
        category: activeCategory.key,
        action,
        values,
        original_id: originalId,
      })
      return true
    } catch (mutationError) {
      setError(
        mutationError instanceof Error ? mutationError.message : 'Failed to save changes.'
      )
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveCurrent() {
    if (!activeCategory) return
    const action: RatesFlagsMutationAction = isCreating ? 'create' : 'update'
    const ok = await mutate(
      action,
      { ...draft, active: draftActive ? 'Y' : 'N' },
      isCreating ? undefined : selectedRow?.id
    )
    if (!ok) return
    const keep = draft.id || selectedId
    setIsCreating(false)
    setNotice(`${isCreating ? 'Created' : 'Saved'} ${activeCategory.label}.`)
    await reload(keep)
  }

  async function archiveOrReactivate(nextActive: boolean) {
    if (!selectedRow || !activeCategory) return
    const ok = await mutate(
      nextActive ? 'reactivate' : 'archive',
      { id: selectedRow.id },
      selectedRow.id
    )
    if (!ok) return
    setNotice(nextActive ? 'Reactivated row.' : 'Archived row.')
    await reload(selectedRow.id)
  }

  function startCreate() {
    if (!activeCategory) return
    setIsCreating(true)
    setSelectedId('')
    setDraft(getDefaultRatesFlagsDraft(activeCategory))
    setDraftActive(true)
    setNotice(null)
    setError(null)
  }

  function startDuplicate() {
    if (!activeCategory || !selectedRow) return
    const next = buildRatesFlagsDraftFromRow(activeCategory, selectedRow)
    next.id = `${selectedRow.id}_COPY`
    setIsCreating(true)
    setSelectedId('')
    setDraft(next)
    setDraftActive(selectedRow.active)
    setNotice(null)
    setError(null)
  }

  function cancelEdit() {
    if (selectedRow && activeCategory) {
      setDraft(buildRatesFlagsDraftFromRow(activeCategory, selectedRow))
      setDraftActive(selectedRow.active)
      setIsCreating(false)
      return
    }
    setDraft({})
    setDraftActive(true)
    setIsCreating(false)
  }

  const feedbackVm = {
    loading: resource.loading,
    error: error ?? resource.error,
    notice,
    hasData:
      resource.data.categories.length > 0 ||
      (!resource.loading && !resource.error),
  }

  const filtersVm = {
    search,
    statusFilter,
    activeTab,
    rateSection,
    rateCategory,
    flagsSection,
    roomDefaultsSection,
  }

  const tableVm = {
    activeCategory,
    filteredRows,
    selectedRow,
    selectedId,
    isCreating,
  }

  const editorVm = {
    draft,
    draftActive,
    saving,
    activeCategory,
    selectedRow,
    isCreating,
  }

  return {
    resource,
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
    selectedId,
    setSelectedId,
    isCreating,
    draft,
    setDraft,
    draftActive,
    setDraftActive,
    saving,
    error: error ?? resource.error,
    notice,
    activeCategory,
    filteredRows,
    selectedRow,
    reload,
    saveCurrent,
    archiveOrReactivate,
    startCreate,
    startDuplicate,
    cancelEdit,
    valueFromRow: valueFromRatesFlagsRow,
    feedbackVm,
    filtersVm,
    tableVm,
    editorVm,
    actions: {
      setActiveTab,
      setRateSection,
      setRateCategory,
      setFlagsSection,
      setRoomDefaultsSection,
      setStatusFilter,
      setSearch,
      setSelectedId,
      setDraft,
      setDraftActive,
      reload,
      saveCurrent,
      archiveOrReactivate,
      startCreate,
      startDuplicate,
      cancelEdit,
    },
  }
}
