'use client'

import { getRatesFlagsDraftAdapter } from '@/lib/quotes/ratesFlagsDraftAdapters'
import type { RatesFlagsEditableCategoryKey, RatesFlagsTab } from '@/types/estimator/ratesFlags'
import type { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'
import { useQuoteAdminIntentGuard } from './useQuoteAdminIntentGuard'
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
  const guard = useQuoteAdminIntentGuard<DiscardCandidateTransition>({
    hasUnsavedChanges: editor.isDirty,
    getHasUnsavedChanges: editor.isDirtyNow,
    getIntentType: (intent) => intent.type,
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

  function requestIntent<TResult>(
    intent: DiscardCandidateTransition,
    changed: boolean,
    run?: () => TResult | Promise<TResult>
  ) {
    return guard.requestIntent(intent, {
      changed,
      run: run ?? (() => executeTransition(intent) as TResult | Promise<TResult>),
    })
  }

  const setActiveTab = (activeTab: RatesFlagsTab) =>
    requestIntent({ type: 'setActiveTab', activeTab }, activeTab !== filters.activeTab)

  const setRateSection = (rateSection: RateSectionKey) =>
    requestIntent({ type: 'setRateSection', rateSection }, rateSection !== filters.rateSection)

  const setRateCategory = (rateCategory: string) =>
    requestIntent({ type: 'setRateCategory', rateCategory }, rateCategory !== filters.rateCategory)

  const setFlagsSection = (flagsSection: FlagsSectionKey) =>
    requestIntent({ type: 'setFlagsSection', flagsSection }, flagsSection !== filters.flagsSection)

  const setRoomDefaultsSection = (roomDefaultsSection: RoomDefaultsSectionKey) =>
    requestIntent(
      { type: 'setRoomDefaultsSection', roomDefaultsSection },
      roomDefaultsSection !== filters.roomDefaultsSection
    )

  const setStatusFilter = (statusFilter: StatusFilter) =>
    requestIntent({ type: 'setStatusFilter', statusFilter }, statusFilter !== filters.statusFilter)

  const setSearch = (search: string) =>
    requestIntent({ type: 'setSearch', search }, search !== filters.search)

  const setSelectedId = (selectedId: string) =>
    requestIntent({ type: 'setSelectedId', selectedId }, selectedId !== editor.selectedId)

  const guardedReload = (keepId?: string) =>
    requestIntent({ type: 'reload', keepId }, true)

  const archiveOrReactivate = (nextActive: boolean) =>
    requestIntent({ type: 'archiveOrReactivate', nextActive }, true)

  const startCreate = () => requestIntent({ type: 'startCreate' }, true)

  const startDuplicate = () => requestIntent({ type: 'startDuplicate' }, true)

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
    guard.cancelDiscard()
    feedback.clearFeedback()
  }

  async function confirmDiscard() {
    return guard.confirmDiscard(executeTransition)
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
      editor.setDraftActive(nextActive)
    },
    updateDraftValue: (fieldKey: string, rawInput: string) => {
      editor.updateDraftValue(fieldKey, rawInput)
    },
    confirmDiscard,
    cancelDiscard: guard.cancelDiscard,
    discardVm: {
      isOpen: guard.discardVm.isOpen,
      status: guard.discardVm.status,
      transitionType: guard.discardVm.intentType as
        | DiscardCandidateTransition['type']
        | null,
    },
  }
}
