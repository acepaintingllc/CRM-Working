'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { buildDenseQuotePageUiState } from '@/app/crm/quotes/_hooks/denseQuotePageUiState'
import { loadRatesFlags, mutateRatesFlags } from '@/lib/quotes/client'
import {
  createEmptyDraft,
  draftToMutationValues,
  formatDraftValue,
  rowToDraft,
  updateDraftField,
  validateDraft,
} from '@/lib/quotes/ratesFlagsDraftAdapters'
import {
  categoryByKey,
  valueFromRatesFlagsRow,
} from '@/lib/quotes/ratesFlagsForm'
import type {
  RatesFlagsCategoryKey,
  RatesFlagsDraft,
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
  const [draft, setDraft] = useState<RatesFlagsDraft>({})
  const [draftActive, setDraftActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
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
    setDraft(rowToDraft(activeCategory, selectedRow))
    setDraftActive(selectedRow.active)
  }, [activeCategory, isCreating, selectedRow])

  function updateDraftValue(fieldKey: string, rawInput: string) {
    if (!activeCategory) return
    setDraft((current) => updateDraftField(activeCategory, current, fieldKey, rawInput))
  }

  const validationResult = activeCategory ? validateDraft(activeCategory, draft) : null
  const validationError = validationResult && !validationResult.ok ? validationResult.error : null
  const hasData =
    resource.data.categories.length > 0 || (!resource.loading && !resource.error)

  async function reload(keepId?: string) {
    const ok = await resource.refresh()
    if (ok && keepId) {
      setSelectedId(keepId)
    }
    return ok
  }

  async function mutate(
    action: RatesFlagsMutationAction,
    values: Record<string, unknown>,
    originalId?: string
  ) {
    if (!activeCategory) return false
    setSaving(true)
    setNotice(null)
    setActionError(null)
    try {
      await mutateRatesFlags({
        category: activeCategory.key,
        action,
        values,
        original_id: originalId,
      })
      return true
    } catch (mutationError) {
      setActionError(
        mutationError instanceof Error ? mutationError.message : 'Failed to save changes.'
      )
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveCurrent() {
    if (!activeCategory) return
    setActionError(null)
    setNotice(null)
    if (!validationResult?.ok) {
      return
    }
    const action: RatesFlagsMutationAction = isCreating ? 'create' : 'update'
    const ok = await mutate(
      action,
      draftToMutationValues(activeCategory, draft, draftActive),
      isCreating ? undefined : selectedRow?.id
    )
    if (!ok) return
    const keep = typeof draft.id === 'string' && draft.id ? draft.id : selectedId
    setIsCreating(false)
    const reloaded = await reload(keep)
    if (!reloaded) return
    setNotice(`${isCreating ? 'Created' : 'Saved'} ${activeCategory.label}.`)
  }

  async function archiveOrReactivate(nextActive: boolean) {
    if (!selectedRow || !activeCategory) return
    const ok = await mutate(
      nextActive ? 'reactivate' : 'archive',
      { id: selectedRow.id },
      selectedRow.id
    )
    if (!ok) return
    const reloaded = await reload(selectedRow.id)
    if (!reloaded) return
    setNotice(nextActive ? 'Reactivated row.' : 'Archived row.')
  }

  function startCreate() {
    if (!activeCategory) return
    setIsCreating(true)
    setSelectedId('')
    setDraft(createEmptyDraft(activeCategory))
    setDraftActive(true)
    setNotice(null)
    setActionError(null)
  }

  function startDuplicate() {
    if (!activeCategory || !selectedRow) return
    const next = rowToDraft(activeCategory, selectedRow)
    next.id = `${selectedRow.id}_COPY`
    setIsCreating(true)
    setSelectedId('')
    setDraft(next)
    setDraftActive(selectedRow.active)
    setNotice(null)
    setActionError(null)
  }

  function cancelEdit() {
    if (selectedRow && activeCategory) {
      setDraft(rowToDraft(activeCategory, selectedRow))
      setDraftActive(selectedRow.active)
      setIsCreating(false)
      return
    }
    setDraft({})
    setDraftActive(true)
    setIsCreating(false)
  }

  const uiState = buildDenseQuotePageUiState({
    loading: resource.loading,
    hasData,
    loadError: resource.error,
    actionError,
    validationError,
    notice,
    canRetry: !resource.loading,
    canSave: Boolean(activeCategory) && !saving && !resource.error && Boolean(validationResult?.ok),
    canArchiveToggle:
      Boolean(selectedRow) && !isCreating && !saving && !resource.loading && !resource.error,
    canDuplicate: Boolean(selectedRow) && !saving && !resource.loading && !resource.error,
  })

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
    canDuplicate: uiState.canDuplicate,
    canArchiveToggle: uiState.canArchiveToggle,
  }

  const editorVm = {
    draft,
    draftActive,
    saving,
    activeCategory,
    selectedRow,
    isCreating,
    inlineValidation: uiState.inlineValidation,
    canSave: uiState.canSave,
    formatDraftValue: activeCategory
      ? (fieldKey: string) => formatDraftValue(activeCategory, draft, fieldKey)
      : () => '',
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
    draftActive,
    setDraftActive,
    saving,
    activeCategory,
    filteredRows,
    selectedRow,
    reload,
    saveCurrent,
    archiveOrReactivate,
    startCreate,
    startDuplicate,
    cancelEdit,
    updateDraftValue,
    valueFromRow: valueFromRatesFlagsRow,
    uiState,
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
      setDraftActive,
      reload,
      saveCurrent,
      archiveOrReactivate,
      startCreate,
      startDuplicate,
      cancelEdit,
      updateDraftValue,
    },
  }
}
