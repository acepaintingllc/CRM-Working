'use client'

import { useEffect, useRef, useState } from 'react'
import { getRatesFlagsDraftAdapter } from '@/lib/quotes/ratesFlagsDraftAdapters'
import type { RatesFlagsEditableCategoryKey, RatesFlagsTab } from '@/types/estimator/ratesFlags'
import type { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'
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
  const [pendingDiscardTransition, setPendingDiscardTransition] =
    useState<DiscardCandidateTransition | null>(null)
  const pendingDiscardTransitionRef = useRef<DiscardCandidateTransition | null>(null)
  const hasPendingMutationRef = useRef(false)

  useEffect(() => {
    if (!editor.isDirty) {
      setPendingDiscardTransition(null)
      pendingDiscardTransitionRef.current = null
      hasPendingMutationRef.current = false
    }
  }, [editor.isDirty])

  function cancelDiscard() {
    setPendingDiscardTransition(null)
    pendingDiscardTransitionRef.current = null
  }

  function queueDiscardTransition(transition: DiscardCandidateTransition) {
    if (pendingDiscardTransitionRef.current) return
    pendingDiscardTransitionRef.current = transition
    setPendingDiscardTransition(transition)
  }

  function shouldGuardTransition(changed: boolean) {
    return (editor.isDirty || hasPendingMutationRef.current) && changed
  }

  function discardCleanCreateDraftIfNeeded() {
    if (editor.isCreating) {
      editor.cancelEdit()
    }
  }

  function setActiveTab(nextTab: RatesFlagsTab) {
    if (shouldGuardTransition(nextTab !== filters.activeTab)) {
      queueDiscardTransition({ type: 'setActiveTab', activeTab: nextTab })
      return
    }
    discardCleanCreateDraftIfNeeded()
    filters.setActiveTab(nextTab)
  }

  function setRateSection(nextSection: RateSectionKey) {
    if (shouldGuardTransition(nextSection !== filters.rateSection)) {
      queueDiscardTransition({ type: 'setRateSection', rateSection: nextSection })
      return
    }
    discardCleanCreateDraftIfNeeded()
    filters.setRateSection(nextSection)
    filters.setRateCategory(categoryForSection(nextSection))
  }

  function setRateCategory(nextCategory: string) {
    if (shouldGuardTransition(nextCategory !== filters.rateCategory)) {
      queueDiscardTransition({ type: 'setRateCategory', rateCategory: nextCategory })
      return
    }
    discardCleanCreateDraftIfNeeded()
    filters.setRateCategory(nextCategory as typeof filters.rateCategory)
  }

  function setFlagsSection(nextSection: FlagsSectionKey) {
    if (shouldGuardTransition(nextSection !== filters.flagsSection)) {
      queueDiscardTransition({ type: 'setFlagsSection', flagsSection: nextSection })
      return
    }
    discardCleanCreateDraftIfNeeded()
    filters.setFlagsSection(nextSection)
  }

  function setRoomDefaultsSection(nextSection: RoomDefaultsSectionKey) {
    if (shouldGuardTransition(nextSection !== filters.roomDefaultsSection)) {
      queueDiscardTransition({
        type: 'setRoomDefaultsSection',
        roomDefaultsSection: nextSection,
      })
      return
    }
    discardCleanCreateDraftIfNeeded()
    filters.setRoomDefaultsSection(nextSection)
  }

  function setStatusFilter(nextFilter: StatusFilter) {
    if (shouldGuardTransition(nextFilter !== filters.statusFilter)) {
      queueDiscardTransition({ type: 'setStatusFilter', statusFilter: nextFilter })
      return
    }
    discardCleanCreateDraftIfNeeded()
    filters.setStatusFilter(nextFilter)
  }

  function setSearch(nextSearch: string) {
    if (shouldGuardTransition(nextSearch !== filters.search)) {
      queueDiscardTransition({ type: 'setSearch', search: nextSearch })
      return
    }
    discardCleanCreateDraftIfNeeded()
    filters.setSearch(nextSearch)
  }

  function setSelectedId(nextId: string) {
    if (shouldGuardTransition(nextId !== editor.selectedId)) {
      queueDiscardTransition({ type: 'setSelectedId', selectedId: nextId })
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
    if (shouldGuardTransition(true)) {
      queueDiscardTransition({ type: 'archiveOrReactivate', nextActive })
      return
    }
    await runArchiveOrReactivate(nextActive)
  }

  function startCreate() {
    if (shouldGuardTransition(true)) {
      queueDiscardTransition({ type: 'startCreate' })
      return
    }
    editor.startCreate()
    feedback.clearFeedback()
  }

  function startDuplicate() {
    if (shouldGuardTransition(true)) {
      queueDiscardTransition({ type: 'startDuplicate' })
      return
    }
    editor.startDuplicate()
    feedback.clearFeedback()
  }

  function cancelEdit() {
    editor.cancelEdit()
    cancelDiscard()
    feedback.clearFeedback()
  }

  async function guardedReload(keepId?: string) {
    if (shouldGuardTransition(true)) {
      queueDiscardTransition({ type: 'reload', keepId })
      return false
    }
    return runReload(keepId)
  }

  async function confirmDiscard() {
    const transition = pendingDiscardTransitionRef.current
    setPendingDiscardTransition(null)
    pendingDiscardTransitionRef.current = null
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

  const discardVm = {
    isOpen: Boolean(pendingDiscardTransition),
    transitionType: pendingDiscardTransition?.type ?? null,
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
      hasPendingMutationRef.current = true
      editor.setDraftActive(nextActive)
    },
    updateDraftValue: (fieldKey: string, rawInput: string) => {
      hasPendingMutationRef.current = true
      editor.updateDraftValue(fieldKey, rawInput)
    },
    confirmDiscard,
    cancelDiscard,
    discardVm,
  }
}
