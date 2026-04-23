'use client'

import { getRatesFlagsDraftAdapter } from '@/lib/quotes/ratesFlagsDraftAdapters'
import type { RatesFlagsEditableCategoryKey, RatesFlagsTab } from '@/types/estimator/ratesFlags'
import type { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'
import { useDenseQuoteAdminDiscard } from './useDenseQuoteAdminDiscard'
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
  const discard = useDenseQuoteAdminDiscard<DiscardCandidateTransition>({
    isDirty: editor.isDirty,
  })

  function discardCleanCreateDraftIfNeeded() {
    if (editor.isCreating) {
      editor.cancelEdit()
    }
  }

  function setActiveTab(nextTab: RatesFlagsTab) {
    if (discard.shouldGuardTransition(nextTab !== filters.activeTab)) {
      discard.queueDiscardTransition({ type: 'setActiveTab', activeTab: nextTab })
      return
    }
    discardCleanCreateDraftIfNeeded()
    filters.setActiveTab(nextTab)
  }

  function setRateSection(nextSection: RateSectionKey) {
    if (discard.shouldGuardTransition(nextSection !== filters.rateSection)) {
      discard.queueDiscardTransition({ type: 'setRateSection', rateSection: nextSection })
      return
    }
    discardCleanCreateDraftIfNeeded()
    filters.setRateSection(nextSection)
    filters.setRateCategory(categoryForSection(nextSection))
  }

  function setRateCategory(nextCategory: string) {
    if (discard.shouldGuardTransition(nextCategory !== filters.rateCategory)) {
      discard.queueDiscardTransition({ type: 'setRateCategory', rateCategory: nextCategory })
      return
    }
    discardCleanCreateDraftIfNeeded()
    filters.setRateCategory(nextCategory as typeof filters.rateCategory)
  }

  function setFlagsSection(nextSection: FlagsSectionKey) {
    if (discard.shouldGuardTransition(nextSection !== filters.flagsSection)) {
      discard.queueDiscardTransition({ type: 'setFlagsSection', flagsSection: nextSection })
      return
    }
    discardCleanCreateDraftIfNeeded()
    filters.setFlagsSection(nextSection)
  }

  function setRoomDefaultsSection(nextSection: RoomDefaultsSectionKey) {
    if (discard.shouldGuardTransition(nextSection !== filters.roomDefaultsSection)) {
      discard.queueDiscardTransition({
        type: 'setRoomDefaultsSection',
        roomDefaultsSection: nextSection,
      })
      return
    }
    discardCleanCreateDraftIfNeeded()
    filters.setRoomDefaultsSection(nextSection)
  }

  function setStatusFilter(nextFilter: StatusFilter) {
    if (discard.shouldGuardTransition(nextFilter !== filters.statusFilter)) {
      discard.queueDiscardTransition({ type: 'setStatusFilter', statusFilter: nextFilter })
      return
    }
    discardCleanCreateDraftIfNeeded()
    filters.setStatusFilter(nextFilter)
  }

  function setSearch(nextSearch: string) {
    if (discard.shouldGuardTransition(nextSearch !== filters.search)) {
      discard.queueDiscardTransition({ type: 'setSearch', search: nextSearch })
      return
    }
    discardCleanCreateDraftIfNeeded()
    filters.setSearch(nextSearch)
  }

  function setSelectedId(nextId: string) {
    if (discard.shouldGuardTransition(nextId !== editor.selectedId)) {
      discard.queueDiscardTransition({ type: 'setSelectedId', selectedId: nextId })
      return
    }
    discardCleanCreateDraftIfNeeded()
    editor.setSelectedId(nextId)
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

  async function archiveOrReactivate(nextActive: boolean) {
    if (discard.shouldGuardTransition(true)) {
      discard.queueDiscardTransition({ type: 'archiveOrReactivate', nextActive })
      return
    }
    await runArchiveOrReactivate(nextActive)
  }

  function startCreate() {
    if (discard.shouldGuardTransition(true)) {
      discard.queueDiscardTransition({ type: 'startCreate' })
      return
    }
    editor.startCreate()
    feedback.clearFeedback()
  }

  function startDuplicate() {
    if (discard.shouldGuardTransition(true)) {
      discard.queueDiscardTransition({ type: 'startDuplicate' })
      return
    }
    editor.startDuplicate()
    feedback.clearFeedback()
  }

  function cancelEdit() {
    editor.cancelEdit()
    discard.cancelDiscard()
    feedback.clearFeedback()
  }

  async function guardedReload(keepId?: string) {
    if (discard.shouldGuardTransition(true)) {
      discard.queueDiscardTransition({ type: 'reload', keepId })
      return false
    }
    return runReload(keepId)
  }

  async function confirmDiscard() {
    const transition = discard.consumePendingDiscardTransition()
    if (!transition) return false

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
      discard.markPendingMutation()
      editor.setDraftActive(nextActive)
    },
    updateDraftValue: (fieldKey: string, rawInput: string) => {
      discard.markPendingMutation()
      editor.updateDraftValue(fieldKey, rawInput)
    },
    confirmDiscard,
    cancelDiscard: discard.cancelDiscard,
    discardVm: {
      isOpen: discard.discardVm.isOpen,
      transitionType: discard.discardVm.transitionType?.type ?? null,
    },
  }
}
