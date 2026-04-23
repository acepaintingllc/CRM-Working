'use client'

import { getRatesFlagsDraftAdapter } from '@/lib/quotes/ratesFlagsDraftAdapters'
import type { RatesFlagsEditableCategoryKey, RatesFlagsTab } from '@/types/estimator/ratesFlags'
import type { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'
import { useGuardedEditorWorkflow } from './useGuardedEditorWorkflow'
import type {
  FlagsSectionKey,
  RateSectionKey,
  RoomDefaultsSectionKey,
  StatusFilter,
} from './quoteRatesPageConfig'
import { RATE_SUBGROUPS } from './quoteRatesPageConfig'
import type { useQuoteRatesEditorState } from './useQuoteRatesEditorState'
import type { useQuoteRatesFilters } from './useQuoteRatesFilters'
import type { useQuoteRatesPersistence } from './useQuoteRatesPersistence'

type Options = {
  filters: ReturnType<typeof useQuoteRatesFilters>
  editor: ReturnType<typeof useQuoteRatesEditorState>
  persistence: ReturnType<typeof useQuoteRatesPersistence>
  feedback: ReturnType<typeof useDenseQuoteAdminFeedback>
  reload: (keepId?: string) => Promise<boolean>
}

type DiscardCandidateTransition =
  | { type: 'setActiveTab'; activeTab: RatesFlagsTab }
  | { type: 'setRateSection'; rateSection: RateSectionKey }
  | { type: 'setRateCategory'; rateCategory: string }
  | { type: 'setFlagsSection'; flagsSection: FlagsSectionKey }
  | { type: 'setRoomDefaultsSection'; roomDefaultsSection: RoomDefaultsSectionKey }
  | { type: 'setStatusFilter'; statusFilter: StatusFilter }
  | { type: 'setSearch'; search: string }
  | { type: 'setSelectedId'; selectedId: string }
  | { type: 'startCreate' }
  | { type: 'startDuplicate' }
  | { type: 'reload'; keepId?: string }
  | { type: 'archiveOrReactivate'; nextActive: boolean }

function categoryForSection(rateSection: RateSectionKey) {
  return RATE_SUBGROUPS[rateSection][0]?.key ?? 'production_rates_walls'
}

export function useQuoteRatesControllerActions({
  filters,
  editor,
  persistence,
  feedback,
  reload,
}: Options) {
  const workflow = useGuardedEditorWorkflow<DiscardCandidateTransition>({
    isDirty: editor.isDirty,
  })

  function discardCleanCreateDraftIfNeeded() {
    if (editor.isCreating) {
      editor.cancelEdit()
    }
  }

  async function runReload(keepId?: string) {
    discardCleanCreateDraftIfNeeded()
    return reload(keepId)
  }

  async function runArchiveOrReactivate(nextActive: boolean) {
    if (!editor.selectedRow || !filters.activeCategory) return false
    discardCleanCreateDraftIfNeeded()
    const draftAdapter = getRatesFlagsDraftAdapter(
      filters.activeCategory.key as RatesFlagsEditableCategoryKey
    )
    return persistence.archiveToggle({
      request: draftAdapter.toArchiveRequest({
        action: nextActive ? 'reactivate' : 'archive',
        rowId: editor.selectedRow.id,
      }),
    })
  }

  function executeTransition(transition: DiscardCandidateTransition) {
    switch (transition.type) {
      case 'setActiveTab':
        discardCleanCreateDraftIfNeeded()
        filters.setActiveTab(transition.activeTab)
        return true
      case 'setRateSection':
        discardCleanCreateDraftIfNeeded()
        filters.setRateSection(transition.rateSection)
        filters.setRateCategory(categoryForSection(transition.rateSection))
        return true
      case 'setRateCategory':
        discardCleanCreateDraftIfNeeded()
        filters.setRateCategory(transition.rateCategory as typeof filters.rateCategory)
        return true
      case 'setFlagsSection':
        discardCleanCreateDraftIfNeeded()
        filters.setFlagsSection(transition.flagsSection)
        return true
      case 'setRoomDefaultsSection':
        discardCleanCreateDraftIfNeeded()
        filters.setRoomDefaultsSection(transition.roomDefaultsSection)
        return true
      case 'setStatusFilter':
        discardCleanCreateDraftIfNeeded()
        filters.setStatusFilter(transition.statusFilter)
        return true
      case 'setSearch':
        discardCleanCreateDraftIfNeeded()
        filters.setSearch(transition.search)
        return true
      case 'setSelectedId':
        discardCleanCreateDraftIfNeeded()
        editor.setSelectedId(transition.selectedId)
        return true
      case 'startCreate':
        editor.startCreate()
        feedback.clearFeedback()
        return true
      case 'startDuplicate':
        editor.startDuplicate()
        feedback.clearFeedback()
        return true
      case 'reload':
        return runReload(transition.keepId)
      case 'archiveOrReactivate':
        return runArchiveOrReactivate(transition.nextActive)
      default:
        return false
    }
  }

  const setActiveTab = workflow.createGuardedAction(executeTransition, {
    getTransition: (activeTab: RatesFlagsTab) => ({ type: 'setActiveTab', activeTab }),
    changed: (activeTab: RatesFlagsTab) => activeTab !== filters.activeTab,
  })

  const setRateSection = workflow.createGuardedAction(executeTransition, {
    getTransition: (rateSection: RateSectionKey) => ({ type: 'setRateSection', rateSection }),
    changed: (rateSection: RateSectionKey) => rateSection !== filters.rateSection,
  })

  const setRateCategory = workflow.createGuardedAction(executeTransition, {
    getTransition: (rateCategory: string) => ({ type: 'setRateCategory', rateCategory }),
    changed: (rateCategory: string) => rateCategory !== filters.rateCategory,
  })

  const setFlagsSection = workflow.createGuardedAction(executeTransition, {
    getTransition: (flagsSection: FlagsSectionKey) => ({ type: 'setFlagsSection', flagsSection }),
    changed: (flagsSection: FlagsSectionKey) => flagsSection !== filters.flagsSection,
  })

  const setRoomDefaultsSection = workflow.createGuardedAction(executeTransition, {
    getTransition: (roomDefaultsSection: RoomDefaultsSectionKey) => ({
      type: 'setRoomDefaultsSection',
      roomDefaultsSection,
    }),
    changed: (roomDefaultsSection: RoomDefaultsSectionKey) =>
      roomDefaultsSection !== filters.roomDefaultsSection,
  })

  const setStatusFilter = workflow.createGuardedAction(executeTransition, {
    getTransition: (statusFilter: StatusFilter) => ({ type: 'setStatusFilter', statusFilter }),
    changed: (statusFilter: StatusFilter) => statusFilter !== filters.statusFilter,
  })

  const setSearch = workflow.createGuardedAction(executeTransition, {
    getTransition: (search: string) => ({ type: 'setSearch', search }),
    changed: (search: string) => search !== filters.search,
  })

  const setSelectedId = workflow.createGuardedAction(executeTransition, {
    getTransition: (selectedId: string) => ({ type: 'setSelectedId', selectedId }),
    changed: (selectedId: string) => selectedId !== editor.selectedId,
  })

  const guardedReload = workflow.createGuardedAction(executeTransition, {
    getTransition: (keepId?: string) => ({ type: 'reload', keepId }),
    changed: () => true,
  })

  const archiveOrReactivate = workflow.createGuardedAction(executeTransition, {
    getTransition: (nextActive: boolean) => ({ type: 'archiveOrReactivate', nextActive }),
    changed: () => true,
  })

  const startCreate = workflow.createGuardedAction(executeTransition, {
    getTransition: () => ({ type: 'startCreate' }),
    changed: () => true,
  })

  const startDuplicate = workflow.createGuardedAction(executeTransition, {
    getTransition: () => ({ type: 'startDuplicate' }),
    changed: () => true,
  })

  async function saveCurrent() {
    if (!filters.activeCategory) return

    const mutation = editor.buildMutation({
      action: editor.isCreating ? 'create' : 'update',
    })
    if (!mutation) return

    const ok = await persistence.saveMutation({
      request: mutation.request,
      keepId: mutation.keepId,
      notice: `${editor.isCreating ? 'Created' : 'Saved'} ${filters.activeCategory.label}.`,
    })
    if (ok) {
      editor.finishCreate()
    }
  }

  function cancelEdit() {
    editor.cancelEdit()
    workflow.cancelDiscard()
    feedback.clearFeedback()
  }

  async function confirmDiscard() {
    return workflow.confirmDiscard(executeTransition)
  }

  return {
    setActiveTab,
    setRateSection,
    setRateCategory,
    setFlagsSection,
    setRoomDefaultsSection,
    setStatusFilter,
    setSearch,
    setSelectedId,
    reload: guardedReload,
    saveCurrent,
    archiveOrReactivate,
    startCreate,
    startDuplicate,
    cancelEdit,
    setDraftActive: (nextActive: boolean) => {
      workflow.markPendingMutation()
      editor.setDraftActive(nextActive)
    },
    updateDraftValue: (fieldKey: string, rawInput: string) => {
      workflow.markPendingMutation()
      editor.updateDraftValue(fieldKey, rawInput)
    },
    confirmDiscard,
    cancelDiscard: workflow.cancelDiscard,
    discardVm: {
      isOpen: workflow.workflowVm.isOpen,
      phase: workflow.workflowVm.phase,
      transitionType: workflow.workflowVm.pendingTransitionType as
        | DiscardCandidateTransition['type']
        | null,
    },
  }
}
