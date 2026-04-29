'use client'

import { useCallback, useEffect, useMemo } from 'react'
import {
  archiveOrReactivateQuoteRatesMutation,
  saveQuoteRatesMutation,
} from './quoteRatesPageMutations'
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
  saveCurrent: () => Promise<void>
  archiveOrReactivate: (nextActive: boolean) => Promise<boolean> | boolean
  startCreate: () => boolean | Promise<boolean>
  startDuplicate: () => boolean | Promise<boolean>
  cancelEdit: () => void
  confirmDiscard: () => boolean | Promise<boolean>
  cancelDiscard: () => void
  updateDraftValue: (fieldKey: string, rawInput: string) => void
  formatDraftValue: (fieldKey: string) => string
}

type QuoteRatesTransitionResult = boolean | Promise<boolean>

export function useQuoteRatesPageController() {
  const resource = useQuoteRatesData()
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
    hasUnsavedChanges: getQuoteRatesHasUnsavedChanges,
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

  async function saveCurrent() {
    const currentState = stateRef.current
    if (currentState.actionStatus !== 'idle') return
    if (!derived.editableActiveCategory || !currentState.draft || !derived.validationResult?.ok) {
      return
    }

    applyAction({ type: 'mutationChanged', status: 'saving' })

    const result = await saveQuoteRatesMutation({
      resource,
      navigation: currentState.navigation,
      activeCategory: derived.editableActiveCategory,
      draft: currentState.draft,
      draftActive: currentState.draftActive,
      editorMode: currentState.editorMode,
      selectedRowId: derived.selectedRow?.id,
    })

    if (!result.ok) {
      applyAction({ type: 'mutationChanged', status: 'idle', error: result.error })
      return
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
    applyAction({ type: 'mutationChanged', status: 'idle' })
  }

  async function archiveOrReactivate(nextActive: boolean) {
    if (stateRef.current.actionStatus !== 'idle') return false
    if (!derived.editableActiveCategory || !derived.selectedRow) return false

    applyAction({ type: 'mutationChanged', status: 'archiving' })

    const result = await archiveOrReactivateQuoteRatesMutation({
      resource,
      navigation: stateRef.current.navigation,
      categoryKey: derived.editableActiveCategory.key,
      selectedRowId: derived.selectedRow.id,
      nextActive,
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
    applyAction({ type: 'mutationChanged', status: 'idle' })
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
  }

  function setDraftActive(nextActive: boolean) {
    if (stateRef.current.actionStatus !== 'idle') return

    applyAction({ type: 'draftChanged', draftActive: nextActive })
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
    saveCurrent,
    archiveOrReactivate: (nextActive: boolean) =>
      requestIntent({ type: 'archiveOrReactivate', nextActive }),
    startCreate: () => requestIntent({ type: 'startCreate' }),
    startDuplicate: () => requestIntent({ type: 'startDuplicate' }),
    cancelEdit,
    confirmDiscard: () => {
      if (stateRef.current.actionStatus !== 'idle') return false

      return confirmDiscard((intent) => {
        if (transitionNeedsDiscardReset(intent)) {
          discardCurrentChanges()
        }
        return executeIntent(intent)
      })
    },
    cancelDiscard,
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
