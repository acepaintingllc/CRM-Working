'use client'

import { useCallback, useEffect, useMemo } from 'react'
import {
  getRatesFlagsDraftAdapter,
  isRatesFlagsEditableCategory,
} from '@/lib/quotes/ratesFlagsDraftAdapters'
import type {
  RatesFlagsDraftValidationResult,
  RatesFlagsTab,
} from '@/types/estimator/ratesFlags'
import {
  archiveOrReactivateQuoteRatesMutation,
  saveQuoteRatesMutation,
} from './quoteRatesPageMutations'
import {
  applyNavigationIntent,
  buildQuoteRatesEditorSnapshotFromSelection,
  buildQuoteRatesSelectionSnapshot,
  getQuoteRatesCategoryContext,
} from './quoteRatesPageNavigation'
import {
  createInitialQuoteRatesWorkflowState,
  getQuoteRatesHasUnsavedChanges,
  quoteRatesPageReducer,
  transitionNeedsDiscardReset,
  type QuoteRatesControllerAction,
  type QuoteRatesDerivedState,
  type QuoteRatesPendingTransition,
  type QuoteRatesWorkflowState,
} from './quoteRatesPageState'
import {
  type FlagsSectionKey,
  type RateSectionKey,
  type RoomDefaultsSectionKey,
  type StatusFilter,
} from './quoteRatesPageConfig'
import { formatRatesDraftValue } from './quoteRatesPageVm'
import { useDenseQuoteAdminOrchestrator } from './useDenseQuoteAdminOrchestrator'
import { useQuoteRatesData } from './useQuoteRatesData'

export type QuoteRatesActions = {
  setActiveTab: (activeTab: RatesFlagsTab) => boolean | Promise<boolean>
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

function getQuoteRatesIntentChanged(
  state: QuoteRatesWorkflowState,
  intent: QuoteRatesPendingTransition
) {
  switch (intent.type) {
    case 'setActiveTab':
      return intent.activeTab !== state.navigation.activeTab
    case 'setRateSection':
      return intent.rateSection !== state.navigation.rateSection
    case 'setRateCategory':
      return intent.rateCategory !== state.navigation.rateCategory
    case 'setFlagsSection':
      return intent.flagsSection !== state.navigation.flagsSection
    case 'setRoomDefaultsSection':
      return intent.roomDefaultsSection !== state.navigation.roomDefaultsSection
    case 'setStatusFilter':
      return intent.statusFilter !== state.navigation.statusFilter
    case 'setSearch':
      return intent.search !== state.navigation.search
    case 'setSelectedId':
      return intent.selectedId !== state.selectedId
    case 'startCreate':
    case 'startDuplicate':
    case 'reload':
    case 'archiveOrReactivate':
      return true
    default:
      return false
  }
}

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
    getResourceSyncAction: (state, resourceData) => {
      const selection = buildQuoteRatesSelectionSnapshot(
        resourceData,
        state.navigation,
        (state.refreshSelectionId ?? state.selectedId) || undefined
      )

      const preserveCreateDraft = state.editorMode === 'create' && !state.forceRefreshRehydrate
      const selectionChanged = selection.selectedId !== state.selectedId
      const missingDraft = !state.draft

      if (
        preserveCreateDraft ||
        (!state.forceRefreshRehydrate && !selectionChanged && !missingDraft)
      ) {
        if (state.refreshSelectionId !== null || state.forceRefreshRehydrate) {
          return {
            type: 'reconcileFromResource',
            ...selection,
            preserveCreateDraft,
          }
        }
        return null
      }

      return {
        type: 'reconcileFromResource',
        ...selection,
        preserveCreateDraft,
      }
    },
    hasUnsavedChanges: getQuoteRatesHasUnsavedChanges,
    discard: {
      getPendingIntent: (state) => state.pendingTransition,
      queue: (intent) => ({ type: 'openDiscard', intent }),
      setStatus: (status) => ({ type: 'setDiscardStatus', status }),
      clear: () => ({ type: 'clearDiscard' }),
    },
  })
  const { state, stateRef, applyAction, requestTransition, confirmDiscard, cancelDiscard } =
    orchestrator

  const { activeCategory, filteredRows } = useMemo(
    () => getQuoteRatesCategoryContext(resource.data, state.navigation),
    [resource.data, state.navigation]
  )

  const selectedRow = useMemo(() => {
    if (!activeCategory || !state.selectedId) return null
    return activeCategory.rows.find((row) => row.id === state.selectedId) ?? null
  }, [activeCategory, state.selectedId])

  const editableActiveCategory = useMemo(
    () => (activeCategory && isRatesFlagsEditableCategory(activeCategory) ? activeCategory : null),
    [activeCategory]
  )
  const adapter = useMemo(
    () => (editableActiveCategory ? getRatesFlagsDraftAdapter(editableActiveCategory.key) : null),
    [editableActiveCategory]
  )

  const validationResult: RatesFlagsDraftValidationResult | null =
    editableActiveCategory && adapter && state.draft
      ? adapter.validateDraft(editableActiveCategory, state.draft)
      : null
  const validationError = validationResult && !validationResult.ok ? validationResult.error : null
  const isDirty = getQuoteRatesHasUnsavedChanges(state)

  useEffect(() => {
    if (state.actionStatus !== 'reloading' || resource.loading) return

    if (state.refreshSelectionId !== null || state.forceRefreshRehydrate) {
      applyAction({ type: 'clearRefreshRehydrate' })
    }
    applyAction({ type: 'finishAction' })
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
      type: 'applyNavigation',
      navigation,
      selectedId: selection.selectedId,
      editor: selection.editor,
    })
    return true
  }

  function applySelection(selectedId: string) {
    if (stateRef.current.actionStatus !== 'idle') return false

    const editor = buildQuoteRatesEditorSnapshotFromSelection(activeCategory, selectedId)
    applyAction({ type: 'selectRow', selectedId: editor.selectedId, editor })
    return true
  }

  function startCreate() {
    if (stateRef.current.actionStatus !== 'idle') return false
    if (!editableActiveCategory || !adapter) return false

    const draft = adapter.createEmptyDraft(editableActiveCategory)
    applyAction({ type: 'startCreate', draft })
    return true
  }

  function startDuplicate() {
    if (stateRef.current.actionStatus !== 'idle') return false
    if (!editableActiveCategory || !adapter || !selectedRow) return false

    const draft = adapter.withDuplicateId(
      adapter.rowToDraft(editableActiveCategory, selectedRow),
      selectedRow.id
    )

    applyAction({
      type: 'startDuplicate',
      draft,
      draftActive: selectedRow.active,
    })
    return true
  }

  function discardCurrentChanges() {
    const editor = buildQuoteRatesEditorSnapshotFromSelection(
      activeCategory,
      stateRef.current.selectedId
    )
    applyAction({ type: 'discardCurrentChanges', selectedId: editor.selectedId, editor })
  }

  async function performReload(keepId?: string) {
    if (stateRef.current.actionStatus !== 'idle') return false

    applyAction({
      type: 'scheduleRefreshRehydrate',
      selectedId: (keepId ?? stateRef.current.selectedId) || null,
      force: true,
    })
    applyAction({ type: 'beginAction', status: 'reloading' })

    const result = await resource.attemptRefresh({
      preserveDataOnError: true,
      reportError: true,
    })

    if (!result.ok) {
      applyAction({ type: 'clearRefreshRehydrate' })
      applyAction({ type: 'finishAction' })
    }

    return result.ok
  }

  async function saveCurrent() {
    const currentState = stateRef.current
    if (currentState.actionStatus !== 'idle') return
    if (!editableActiveCategory || !currentState.draft || !validationResult?.ok) return

    applyAction({ type: 'beginAction', status: 'saving' })

    const result = await saveQuoteRatesMutation({
      resource,
      navigation: currentState.navigation,
      activeCategory: editableActiveCategory,
      draft: currentState.draft,
      draftActive: currentState.draftActive,
      editorMode: currentState.editorMode,
      selectedRowId: selectedRow?.id,
    })

    if (!result.ok) {
      applyAction({ type: 'setActionError', error: result.error })
      applyAction({ type: 'finishAction' })
      return
    }

    applyAction({
      type: 'commitMutation',
      selectedId: result.selectedId,
      editor: result.editor,
    })
    applyAction({
      type: 'setNotice',
      notice: result.notice,
      tone: result.tone,
    })
    applyAction({ type: 'finishAction' })
  }

  async function archiveOrReactivate(nextActive: boolean) {
    if (stateRef.current.actionStatus !== 'idle') return false
    if (!editableActiveCategory || !selectedRow) return false

    applyAction({ type: 'beginAction', status: 'archiving' })

    const result = await archiveOrReactivateQuoteRatesMutation({
      resource,
      navigation: stateRef.current.navigation,
      categoryKey: editableActiveCategory.key,
      selectedRowId: selectedRow.id,
      nextActive,
    })

    if (!result.ok) {
      applyAction({ type: 'setActionError', error: result.error })
      applyAction({ type: 'finishAction' })
      return false
    }

    applyAction({
      type: 'commitMutation',
      selectedId: result.selectedId,
      editor: result.editor,
    })
    applyAction({
      type: 'setNotice',
      notice: result.notice,
      tone: result.tone,
    })
    applyAction({ type: 'finishAction' })
    return true
  }

  function cancelEdit() {
    if (stateRef.current.actionStatus !== 'idle') return

    const editor = buildQuoteRatesEditorSnapshotFromSelection(
      activeCategory,
      stateRef.current.selectedId
    )
    applyAction({ type: 'cancelEdit', selectedId: editor.selectedId, editor })
    cancelDiscard()
    applyAction({ type: 'clearFeedback' })
  }

  function updateDraftValue(fieldKey: string, rawInput: string) {
    const currentState = stateRef.current
    if (currentState.actionStatus !== 'idle') return
    if (!editableActiveCategory || !adapter || !currentState.draft) return

    const nextDraft = adapter.updateDraftField(
      editableActiveCategory,
      currentState.draft,
      fieldKey,
      rawInput
    )
    applyAction({ type: 'setDraft', draft: nextDraft })
  }

  function setDraftActive(nextActive: boolean) {
    if (stateRef.current.actionStatus !== 'idle') return

    applyAction({ type: 'setDraftActive', draftActive: nextActive })
  }

  const formatDraftValue = useCallback(
    (fieldKey: string) =>
      formatRatesDraftValue(adapter, editableActiveCategory, state.draft, fieldKey),
    [adapter, editableActiveCategory, state.draft]
  )

  function executeIntent(intent: QuoteRatesPendingTransition): QuoteRatesTransitionResult {
    switch (intent.type) {
      case 'setActiveTab':
      case 'setRateSection':
      case 'setRateCategory':
      case 'setFlagsSection':
      case 'setRoomDefaultsSection':
        return applyNavigation(applyNavigationIntent(stateRef.current.navigation, intent))
      case 'setStatusFilter':
      case 'setSearch':
        return applyNavigation(
          applyNavigationIntent(stateRef.current.navigation, intent),
          stateRef.current.selectedId || undefined
        )
      case 'setSelectedId':
        return applySelection(intent.selectedId)
      case 'startCreate':
        return startCreate()
      case 'startDuplicate':
        return startDuplicate()
      case 'reload':
        return performReload(intent.keepId)
      case 'archiveOrReactivate':
        return archiveOrReactivate(intent.nextActive)
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

  const derived: QuoteRatesDerivedState = {
    activeCategory,
    filteredRows,
    selectedRow,
    adapter,
    validationResult,
    validationError,
    isDirty,
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
