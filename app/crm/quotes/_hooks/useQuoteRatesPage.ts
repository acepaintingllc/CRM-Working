'use client'

import { useCallback } from 'react'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { buildDenseQuotePageUiState } from '@/app/crm/quotes/_hooks/denseQuotePageUiState'
import { valueFromRatesFlagsRow } from '@/lib/quotes/ratesFlagsForm'
import { loadRatesFlags } from '@/lib/quotes/client'
import type {
  RatesFlagsPayload,
  RatesFlagsTab,
} from '@/types/estimator/ratesFlags'
import { useQuoteRatesEditorState } from './useQuoteRatesEditorState'
import { useQuoteRatesFilters } from './useQuoteRatesFilters'
import { useQuoteRatesPersistence } from './useQuoteRatesPersistence'
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

const emptyRatesFlags: RatesFlagsPayload = {
  source: 'db',
  seeded: false,
  template_version: null,
  categories: [],
}

export function useQuoteRatesPage() {
  const resource = useLoadableResource<RatesFlagsPayload>({
    initialData: emptyRatesFlags,
    load: () => loadRatesFlags(),
    getErrorMessage: (loadError: unknown) =>
      loadError instanceof Error ? loadError.message : 'Failed to load rates and flags.',
  })

  const filters = useQuoteRatesFilters({ payload: resource.data })
  const editor = useQuoteRatesEditorState({
    activeCategory: filters.activeCategory,
    filteredRows: filters.filteredRows,
  })

  const hasData =
    resource.data.categories.length > 0 || (!resource.loading && !resource.error)

  const reload = useCallback(
    async (keepId?: string) => {
      const ok = await resource.refresh()
      if (ok && keepId) {
        editor.setSelectedId(keepId)
      }
      return ok
    },
    [editor, resource]
  )

  const persistence = useQuoteRatesPersistence({
    categoryKey: filters.activeCategory?.key ?? null,
    refresh: reload,
  })

  async function saveCurrent() {
    if (!filters.activeCategory) return
    persistence.setActionError(null)
    persistence.setNotice(null)
    const mutation = editor.buildMutation({
      action: editor.isCreating ? 'create' : 'update',
    })
    if (!mutation) {
      return
    }
    const ok = await persistence.saveMutation({
      action: mutation.action,
      values: mutation.values,
      originalId: mutation.originalId,
      keepId: mutation.keepId,
      notice: `${editor.isCreating ? 'Created' : 'Saved'} ${filters.activeCategory.label}.`,
    })
    if (ok) {
      editor.finishCreate()
    }
  }

  async function archiveOrReactivate(nextActive: boolean) {
    if (!editor.selectedRow) return
    await persistence.archiveToggle({
      selectedId: editor.selectedRow.id,
      nextActive,
    })
  }

  function startCreate() {
    editor.startCreate()
    persistence.setNotice(null)
    persistence.setActionError(null)
  }

  function startDuplicate() {
    editor.startDuplicate()
    persistence.setNotice(null)
    persistence.setActionError(null)
  }

  function cancelEdit() {
    editor.cancelEdit()
  }

  const uiState = buildDenseQuotePageUiState({
    loading: resource.loading,
    hasData,
    loadError: resource.error,
    actionError: persistence.actionError,
    validationError: editor.validationError,
    notice: persistence.notice,
    canRetry: !resource.loading,
    canSave:
      Boolean(filters.activeCategory) &&
      !persistence.saving &&
      !resource.error &&
      Boolean(editor.validationResult?.ok),
    canArchiveToggle:
      Boolean(editor.selectedRow) &&
      !editor.isCreating &&
      !persistence.saving &&
      !resource.loading &&
      !resource.error,
    canDuplicate: Boolean(editor.selectedRow) && !persistence.saving && !resource.loading && !resource.error,
  })

  const filtersVm = {
    search: filters.search,
    statusFilter: filters.statusFilter,
    activeTab: filters.activeTab as RatesFlagsTab,
    rateSection: filters.rateSection,
    rateCategory: filters.rateCategory,
    flagsSection: filters.flagsSection,
    roomDefaultsSection: filters.roomDefaultsSection,
  }

  const tableVm = {
    activeCategory: filters.activeCategory,
    filteredRows: filters.filteredRows,
    selectedRow: editor.selectedRow,
    selectedId: editor.selectedId,
    isCreating: editor.isCreating,
    canDuplicate: uiState.canDuplicate,
    canArchiveToggle: uiState.canArchiveToggle,
  }

  const editorVm = {
    draft: editor.draft,
    draftActive: editor.draftActive,
    saving: persistence.saving,
    activeCategory: filters.activeCategory,
    selectedRow: editor.selectedRow,
    isCreating: editor.isCreating,
    inlineValidation: uiState.inlineValidation,
    canSave: uiState.canSave,
    formatDraftValue: editor.formatDraftValue,
  }

  return {
    resource,
    activeTab: filters.activeTab,
    setActiveTab: filters.setActiveTab,
    rateSection: filters.rateSection,
    setRateSection: filters.setRateSection,
    rateCategory: filters.rateCategory,
    setRateCategory: filters.setRateCategory,
    flagsSection: filters.flagsSection,
    setFlagsSection: filters.setFlagsSection,
    roomDefaultsSection: filters.roomDefaultsSection,
    setRoomDefaultsSection: filters.setRoomDefaultsSection,
    statusFilter: filters.statusFilter,
    setStatusFilter: filters.setStatusFilter,
    search: filters.search,
    setSearch: filters.setSearch,
    selectedId: editor.selectedId,
    setSelectedId: editor.setSelectedId,
    isCreating: editor.isCreating,
    draft: editor.draft,
    draftActive: editor.draftActive,
    setDraftActive: editor.setDraftActive,
    saving: persistence.saving,
    activeCategory: filters.activeCategory,
    filteredRows: filters.filteredRows,
    selectedRow: editor.selectedRow,
    reload,
    saveCurrent,
    archiveOrReactivate,
    startCreate,
    startDuplicate,
    cancelEdit,
    updateDraftValue: editor.updateDraftValue,
    valueFromRow: valueFromRatesFlagsRow,
    uiState,
    filtersVm,
    tableVm,
    editorVm,
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
      reload,
      saveCurrent,
      archiveOrReactivate,
      startCreate,
      startDuplicate,
      cancelEdit,
      updateDraftValue: editor.updateDraftValue,
    },
  }
}
