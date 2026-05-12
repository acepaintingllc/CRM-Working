'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useCrmBeforeUnloadGuard } from '@/app/crm/_hooks/useCrmBeforeUnloadGuard'
import {
  applyQuoteRatesLocalMutation,
  publishQuoteRatesBatchMutation,
} from './quoteRatesPageMutations'
import { getRatesFlagsDraftAdapter } from '@/lib/quotes/ratesFlagsDraftAdapters'
import {
  buildQuoteRatesTransitionPlan,
  buildQuoteRatesDerivedState,
  buildQuoteRatesEditorSnapshotFromSelection,
  buildQuoteRatesResourceSyncAction,
  buildQuoteRatesSelectionSnapshot,
  getQuoteRatesIntentChanged,
} from './quoteRatesPageNavigation'
import {
  createInitialQuoteRatesWorkflowState,
  getQuoteRatesHasEditorChanges,
  getQuoteRatesHasUnsavedChanges,
  quoteRatesPageReducer,
  transitionNeedsDiscardReset,
  type QuoteRatesControllerAction,
  type QuoteRatesPendingTransition,
  type QuoteRatesWorkflowState,
} from './quoteRatesPageState'
import {
  type FlagsSectionKey,
  type QuoteRatesTopTab,
  type RateSectionKey,
  type RoomDefaultsSectionKey,
  type StatusFilter,
} from './quoteRatesPageConfig'
import { formatRatesDraftValue } from './quoteRatesPageVm'
import { useDenseQuoteAdminOrchestrator } from './useDenseQuoteAdminOrchestrator'
import { useQuoteRatesData } from './useQuoteRatesData'

export type QuoteRatesActions = {
  setActiveTab: (activeTab: QuoteRatesTopTab) => boolean | Promise<boolean>
  setRateSection: (rateSection: RateSectionKey) => boolean | Promise<boolean>
  setRateCategory: (rateCategory: string) => boolean | Promise<boolean>
  setFlagsSection: (flagsSection: FlagsSectionKey) => boolean | Promise<boolean>
  setRoomDefaultsSection: (
    roomDefaultsSection: RoomDefaultsSectionKey
  ) => boolean | Promise<boolean>
  setStatusFilter: (statusFilter: StatusFilter) => boolean | Promise<boolean>
  setSearch: (search: string) => boolean | Promise<boolean>
  setSelectedId: (selectedId: string) => boolean | Promise<boolean>
  setDraftActive: (nextActive: boolean) => void
  reload: (keepId?: string) => Promise<boolean> | boolean
  saveBatch: () => Promise<boolean> | boolean
  discardBatch: () => Promise<boolean> | boolean
  archiveOrReactivate: (nextActive: boolean) => Promise<boolean> | boolean
  startCreate: () => boolean | Promise<boolean>
  startDuplicate: () => boolean | Promise<boolean>
  cancelEdit: () => void
  confirmDiscard: () => boolean | Promise<boolean>
  cancelDiscard: () => void
  saveAndLeave: () => Promise<boolean> | boolean
  discardAndLeave: () => boolean
  requestLeavePage: (href: string) => boolean
  updateDraftValue: (fieldKey: string, rawInput: string) => void
  formatDraftValue: (fieldKey: string) => string
}

type QuoteRatesTransitionResult = boolean | Promise<boolean>

export function useQuoteRatesPageController() {
  const router = useRouter()
  const resource = useQuoteRatesData()
  const cleanResourceRef = useRef(resource.data)
  const orchestrator = useDenseQuoteAdminOrchestrator<
    QuoteRatesWorkflowState,
    QuoteRatesControllerAction,
    QuoteRatesPendingTransition,
    typeof resource.data
  >({
    reducer: quoteRatesPageReducer,
    initialState: createInitialQuoteRatesWorkflowState(),
    resourceData: resource.data,
    getResourceSyncAction: buildQuoteRatesResourceSyncAction,
    hasUnsavedChanges: getQuoteRatesHasEditorChanges,
    discard: {
      getPendingIntent: (state) => state.pendingTransition,
      queue: (intent) => ({ type: 'discardChanged', status: 'confirming', intent }),
      setStatus: (status) => ({ type: 'discardChanged', status }),
      clear: () => ({ type: 'discardChanged', status: 'idle' }),
    },
  })
  const { state, stateRef, applyAction, requestTransition, confirmDiscard, cancelDiscard } =
    orchestrator

  const derived = useMemo(
    () => buildQuoteRatesDerivedState(resource.data, state),
    [resource.data, state]
  )
  const dirty = getQuoteRatesHasUnsavedChanges(state)
  useCrmBeforeUnloadGuard({ loading: resource.loading, dirty })

  useEffect(() => {
    if (!getQuoteRatesHasUnsavedChanges(stateRef.current)) {
      cleanResourceRef.current = resource.data
    }
  }, [resource.data, state.pendingMutations.length, state.draft, state.draftActive, stateRef])

  useEffect(() => {
    if (state.actionStatus !== 'reloading' || resource.loading) return

    if (state.refreshSelectionId !== null || state.forceRefreshRehydrate) {
      applyAction({ type: 'refreshRehydrateChanged', selectedId: null, force: false })
    }
    applyAction({ type: 'mutationChanged', status: 'idle' })
  }, [
    applyAction,
    resource.loading,
    state.actionStatus,
    state.forceRefreshRehydrate,
    state.refreshSelectionId,
  ])

  function applyNavigation(navigation: QuoteRatesWorkflowState['navigation'], preferredId?: string) {
    if (stateRef.current.actionStatus !== 'idle') return false

    const selection = buildQuoteRatesSelectionSnapshot(resource.data, navigation, preferredId)
    applyAction({
      type: 'editorApplied',
      navigation,
      selectedId: selection.selectedId,
      editor: selection.editor,
    })
    return true
  }

  function applySelection(selectedId: string) {
    if (stateRef.current.actionStatus !== 'idle') return false

    const editor = buildQuoteRatesEditorSnapshotFromSelection(derived.activeCategory, selectedId)
    applyAction({ type: 'editorApplied', selectedId: editor.selectedId, editor })
    return true
  }

  function startCreate() {
    if (stateRef.current.actionStatus !== 'idle') return false
    if (!derived.editableActiveCategory || !derived.adapter) return false

    const draft = derived.adapter.createEmptyDraft(derived.editableActiveCategory)
    applyAction({ type: 'createStarted', draft })
    return true
  }

  function startDuplicate() {
    if (stateRef.current.actionStatus !== 'idle') return false
    if (!derived.editableActiveCategory || !derived.adapter || !derived.selectedRow) return false

    const draft = derived.adapter.withDuplicateId(
      derived.adapter.rowToDraft(derived.editableActiveCategory, derived.selectedRow),
      derived.selectedRow.id
    )

    applyAction({
      type: 'createStarted',
      draft,
      draftActive: derived.selectedRow.active,
    })
    return true
  }

  function discardCurrentChanges() {
    const editor = buildQuoteRatesEditorSnapshotFromSelection(
      derived.activeCategory,
      stateRef.current.selectedId
    )
    applyAction({ type: 'editorApplied', selectedId: editor.selectedId, editor })
  }

  async function performReload(keepId?: string) {
    if (stateRef.current.actionStatus !== 'idle') return false

    applyAction({
      type: 'refreshRehydrateChanged',
      selectedId: (keepId ?? stateRef.current.selectedId) || null,
      force: true,
    })
    applyAction({ type: 'mutationChanged', status: 'reloading' })

    const result = await resource.attemptRefresh({
      preserveDataOnError: true,
      reportError: true,
    })

    if (!result.ok) {
      applyAction({ type: 'refreshRehydrateChanged', selectedId: null, force: false })
      applyAction({ type: 'mutationChanged', status: 'idle' })
    }

    return result.ok
  }

  function applyLocalCurrentDraft() {
    const currentState = stateRef.current
    if (currentState.actionStatus !== 'idle') return false
    if (!derived.editableActiveCategory || !derived.adapter || !currentState.draft) {
      return false
    }

    const validation = derived.adapter.validateDraft(
      derived.editableActiveCategory,
      currentState.draft
    )
    if (!validation.ok) {
      return false
    }

    const adapter = getRatesFlagsDraftAdapter(derived.editableActiveCategory.key)
    const request = adapter.toMutationRequest({
      action: currentState.editorMode === 'create' ? 'create' : 'update',
      category: derived.editableActiveCategory,
      draft: currentState.draft,
      draftActive: currentState.draftActive,
      originalId:
        currentState.editorMode === 'create'
          ? undefined
          : currentState.selectedId || derived.selectedRow?.id,
    })
    const keepId =
      typeof currentState.draft.id === 'string' && currentState.draft.id
        ? currentState.draft.id
        : derived.selectedRow?.id ?? ''
    const result = applyQuoteRatesLocalMutation({
      resource,
      navigation: currentState.navigation,
      pendingMutations: currentState.pendingMutations,
      request,
      keepId,
    })

    applyAction({
      type: 'editorApplied',
      selectedId: result.selectedId,
      editor: result.editor,
    })
    applyAction({ type: 'pendingMutationsChanged', mutations: result.pendingMutations })
    applyAction({ type: 'feedbackChanged', notice: null })
    return true
  }

  async function saveBatch() {
    const currentState = stateRef.current
    if (currentState.actionStatus !== 'idle') return false
    if (
      (getQuoteRatesHasEditorChanges(currentState) || currentState.editorMode === 'create') &&
      !applyLocalCurrentDraft()
    ) {
      return false
    }

    const nextState = stateRef.current
    if (nextState.pendingMutations.length === 0) return false

    applyAction({ type: 'mutationChanged', status: 'saving' })

    const result = await publishQuoteRatesBatchMutation({
      resource,
      navigation: nextState.navigation,
      pendingMutations: nextState.pendingMutations,
      selectedRowId: nextState.selectedId,
    })

    if (!result.ok) {
      applyAction({ type: 'mutationChanged', status: 'idle', error: result.error })
      return false
    }

    applyAction({
      type: 'editorApplied',
      selectedId: result.selectedId,
      editor: result.editor,
    })
    applyAction({
      type: 'feedbackChanged',
      notice: result.notice,
      tone: result.tone,
    })
    applyAction({ type: 'pendingMutationsChanged', mutations: [] })
    applyAction({ type: 'mutationChanged', status: 'idle' })
    return true
  }

  function discardLocalBatch() {
    if (stateRef.current.actionStatus !== 'idle') return false

    const cleanPayload = cleanResourceRef.current
    resource.setData(cleanPayload)
    const selection = buildQuoteRatesSelectionSnapshot(
      cleanPayload,
      stateRef.current.navigation,
      stateRef.current.selectedId || undefined
    )
    applyAction({
      type: 'editorApplied',
      selectedId: selection.selectedId,
      editor: selection.editor,
    })
    applyAction({ type: 'pendingMutationsChanged', mutations: [] })
    applyAction({ type: 'feedbackChanged', notice: null })
    return true
  }

  async function archiveOrReactivate(nextActive: boolean) {
    if (stateRef.current.actionStatus !== 'idle') return false
    if (!derived.editableActiveCategory || !derived.selectedRow) return false

    const adapter = getRatesFlagsDraftAdapter(derived.editableActiveCategory.key)
    const request = adapter.toArchiveRequest({
      action: nextActive ? 'reactivate' : 'archive',
      rowId: derived.selectedRow.id,
    })
    const result = applyQuoteRatesLocalMutation({
      resource,
      navigation: stateRef.current.navigation,
      pendingMutations: stateRef.current.pendingMutations,
      request,
      keepId: derived.selectedRow.id,
    })

    applyAction({
      type: 'editorApplied',
      selectedId: result.selectedId,
      editor: result.editor,
    })
    applyAction({ type: 'pendingMutationsChanged', mutations: result.pendingMutations })
    applyAction({ type: 'feedbackChanged', notice: null })
    return true
  }

  async function discardBatch() {
    if (stateRef.current.actionStatus !== 'idle') return false

    const discarded = await performReload(stateRef.current.selectedId)
    if (!discarded) return false

    applyAction({ type: 'pendingMutationsChanged', mutations: [] })
    applyAction({
      type: 'feedbackChanged',
      notice: 'Discarded unsaved global changes.',
      tone: 'warning',
    })
    return true
  }

  function cancelEdit() {
    if (stateRef.current.actionStatus !== 'idle') return

    const editor = buildQuoteRatesEditorSnapshotFromSelection(
      derived.activeCategory,
      stateRef.current.selectedId
    )
    applyAction({ type: 'editorApplied', selectedId: editor.selectedId, editor })
    cancelDiscard()
    applyAction({ type: 'feedbackChanged', notice: null })
  }

  function updateDraftValue(fieldKey: string, rawInput: string) {
    const currentState = stateRef.current
    if (currentState.actionStatus !== 'idle') return
    if (!derived.editableActiveCategory || !derived.adapter || !currentState.draft) return

    const nextDraft = derived.adapter.updateDraftField(
      derived.editableActiveCategory,
      currentState.draft,
      fieldKey,
      rawInput
    )
    applyAction({ type: 'draftChanged', draft: nextDraft })
    const validation = derived.adapter.validateDraft(derived.editableActiveCategory, nextDraft)
    if (validation.ok) {
      queueMicrotask(() => {
        applyLocalCurrentDraft()
      })
    }
  }

  function setDraftActive(nextActive: boolean) {
    if (stateRef.current.actionStatus !== 'idle') return

    applyAction({ type: 'draftChanged', draftActive: nextActive })
    queueMicrotask(() => {
      applyLocalCurrentDraft()
    })
  }

  const formatDraftValue = useCallback(
    (fieldKey: string) =>
      formatRatesDraftValue(
        derived.adapter,
        derived.editableActiveCategory,
        state.draft,
        fieldKey
      ),
    [derived.adapter, derived.editableActiveCategory, state.draft]
  )

  function executeIntent(intent: QuoteRatesPendingTransition): QuoteRatesTransitionResult {
    const plan = buildQuoteRatesTransitionPlan(stateRef.current.navigation, intent)

    switch (plan.kind) {
      case 'navigation':
        return applyNavigation(
          plan.navigation,
          plan.preserveSelectedId ? stateRef.current.selectedId || undefined : undefined
        )
      case 'selection':
        return applySelection(plan.selectedId)
      case 'startCreate':
        return startCreate()
      case 'startDuplicate':
        return startDuplicate()
      case 'reload':
        return performReload(plan.keepId)
      case 'archiveOrReactivate':
        return archiveOrReactivate(plan.nextActive)
      case 'leavePage':
        router.push(plan.href)
        return true
      default:
        return false
    }
  }

  function requestIntent(intent: QuoteRatesPendingTransition): QuoteRatesTransitionResult {
    if (stateRef.current.actionStatus !== 'idle') return false

    return requestTransition(intent, {
      changed: getQuoteRatesIntentChanged(stateRef.current, intent),
      run: () => executeIntent(intent),
    })
  }

  const requestLeavePage = useCallback((href: string) => {
    if (stateRef.current.actionStatus !== 'idle') return false

    if (getQuoteRatesHasUnsavedChanges(stateRef.current)) {
      if (stateRef.current.pendingTransition) return false
      applyAction({
        type: 'discardChanged',
        status: 'confirming',
        intent: { type: 'leavePage', href },
      })
      return false
    }

    router.push(href)
    return true
  }, [applyAction, router, stateRef])

  function getCurrentHref() {
    return `${window.location.pathname}${window.location.search}${window.location.hash}`
  }

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!getQuoteRatesHasUnsavedChanges(stateRef.current)) return
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return

      const nextHref = `${url.pathname}${url.search}${url.hash}`
      if (nextHref === getCurrentHref()) return

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      requestLeavePage(nextHref)
    }

    document.addEventListener('click', handleDocumentClick, true)
    return () => document.removeEventListener('click', handleDocumentClick, true)
  }, [requestLeavePage, stateRef])

  useEffect(() => {
    const currentHref = getCurrentHref()
    const currentHistoryState = window.history.state

    const handlePopState = () => {
      if (!getQuoteRatesHasUnsavedChanges(stateRef.current)) return

      const nextHref = getCurrentHref()
      if (nextHref === currentHref) return

      window.history.pushState(currentHistoryState, '', currentHref)
      requestLeavePage(nextHref)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [requestLeavePage, stateRef])

  async function saveAndLeave() {
    const pendingIntent = stateRef.current.pendingTransition
    if (pendingIntent?.type !== 'leavePage') return false

    const href = pendingIntent.href
    const saved = await saveBatch()
    if (!saved) return false

    cancelDiscard()
    router.push(href)
    return true
  }

  function discardAndLeave() {
    const pendingIntent = stateRef.current.pendingTransition
    if (pendingIntent?.type !== 'leavePage') return false

    const href = pendingIntent.href
    if (!discardLocalBatch()) return false

    cancelDiscard()
    router.push(href)
    return true
  }

  const actions: QuoteRatesActions = {
    setActiveTab: (activeTab) => requestIntent({ type: 'setActiveTab', activeTab }),
    setRateSection: (rateSection) => requestIntent({ type: 'setRateSection', rateSection }),
    setRateCategory: (rateCategory) => requestIntent({ type: 'setRateCategory', rateCategory }),
    setFlagsSection: (flagsSection) => requestIntent({ type: 'setFlagsSection', flagsSection }),
    setRoomDefaultsSection: (roomDefaultsSection) =>
      requestIntent({ type: 'setRoomDefaultsSection', roomDefaultsSection }),
    setStatusFilter: (statusFilter) => requestIntent({ type: 'setStatusFilter', statusFilter }),
    setSearch: (search) => requestIntent({ type: 'setSearch', search }),
    setSelectedId: (selectedId) => requestIntent({ type: 'setSelectedId', selectedId }),
    setDraftActive,
    reload: (keepId?: string) => requestIntent({ type: 'reload', keepId }),
    saveBatch: () => saveBatch(),
    discardBatch: () => discardBatch(),
    archiveOrReactivate: (nextActive: boolean) =>
      requestIntent({ type: 'archiveOrReactivate', nextActive }),
    startCreate: () => requestIntent({ type: 'startCreate' }),
    startDuplicate: () => requestIntent({ type: 'startDuplicate' }),
    cancelEdit,
    confirmDiscard: () => {
      if (stateRef.current.actionStatus !== 'idle') return false

      return confirmDiscard((intent) => {
        if (intent.type === 'leavePage') return false
        if (transitionNeedsDiscardReset(intent)) {
          discardCurrentChanges()
        }
        return executeIntent(intent)
      })
    },
    cancelDiscard,
    saveAndLeave,
    discardAndLeave,
    requestLeavePage,
    updateDraftValue,
    formatDraftValue,
  }

  return {
    resource,
    workflowState: state,
    derived,
    actions,
  }
}
