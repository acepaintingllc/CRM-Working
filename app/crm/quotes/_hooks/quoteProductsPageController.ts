'use client'

import { useEffect, useMemo } from 'react'
import {
  normalizeQuoteProductStatusFilter,
  validateQuoteProductDraft,
  type QuoteProductDraft,
} from '@/lib/quotes/productsForm'
import {
  archiveQuoteProductsMutation,
  saveQuoteProductsMutation,
} from './quoteProductsPageMutations'
import {
  buildQuoteProductsQuery,
  buildQuoteProductsDraftFieldAction,
  buildQuoteProductsResourceSyncAction,
  buildQuoteProductsRestoreEditorActions,
  createInitialQuoteProductsWorkflowState,
  getQuoteProductsDiscardRestorePolicy,
  getQuoteProductsIntentChanged,
  getQuoteProductsHasUnsavedChanges,
  getQuoteProductsSelectedRow,
  quoteProductsPageReducer,
  type QuoteProductsPendingTransition,
  type QuoteProductsWorkflowAction,
  type QuoteProductsWorkflowState,
} from './quoteProductsPageState'
import { useDenseQuoteAdminOrchestrator } from './useDenseQuoteAdminOrchestrator'
import { useQuoteProductsData } from './useQuoteProductsData'

export function useQuoteProductsPageController() {
  const orchestrator = useDenseQuoteAdminOrchestrator<
    QuoteProductsWorkflowState,
    QuoteProductsWorkflowAction,
    QuoteProductsPendingTransition
  >({
    reducer: quoteProductsPageReducer,
    initialState: createInitialQuoteProductsWorkflowState(),
    hasUnsavedChanges: getQuoteProductsHasUnsavedChanges,
    discard: {
      getPendingIntent: (state) => state.pendingTransition,
      queue: (intent) => ({
        type: 'discardChanged',
        status: 'confirming',
        transition: intent,
      }),
      setStatus: (status) => ({ type: 'discardChanged', status }),
      clear: () => ({ type: 'discardChanged', status: 'idle' }),
    },
  })
  const {
    state,
    stateRef,
    applyAction,
    requestTransition,
    confirmDiscard,
    cancelDiscard,
  } = orchestrator

  const query = useMemo(
    () => buildQuoteProductsQuery(state.navigation),
    [state.navigation]
  )
  const resource = useQuoteProductsData({ query })
  const resourceSnapshot = useMemo(
    () => ({
      visibleRows: resource.data,
      knownRows: resource.allKnownData,
    }),
    [resource.allKnownData, resource.data]
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      applyAction({
        type: 'searchChanged',
        search: state.navigation.search,
        committed: true,
      })
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [applyAction, state.navigation.search])

  useEffect(() => {
    const nextAction = buildQuoteProductsResourceSyncAction(
      stateRef.current,
      resourceSnapshot
    )
    if (nextAction) {
      applyAction(nextAction)
    }
  }, [
    applyAction,
    resourceSnapshot,
    state.cleanSnapshot.key,
    state.editorMode,
    state.selectedId,
    stateRef,
  ])

  const selectedRow = useMemo(
    () => getQuoteProductsSelectedRow(resource.allKnownData, state.selectedId),
    [resource.allKnownData, state.selectedId]
  )
  const visibleSelectedRow = useMemo(
    () => getQuoteProductsSelectedRow(resource.data, state.selectedId),
    [resource.data, state.selectedId]
  )
  const validationResult =
    state.editorMode === 'none' ? null : validateQuoteProductDraft(state.draft)
  const validationError =
    validationResult && !validationResult.ok
      ? validationResult.validation.summary
      : null
  const isDirty = getQuoteProductsHasUnsavedChanges(state)

  function applyIntent(intent: QuoteProductsPendingTransition) {
    applyAction({ type: 'intentApplied', intent })
    return true
  }

  function executeIntent(intent: QuoteProductsPendingTransition) {
    if (intent.type === 'setSearch') {
      applyAction({ type: 'searchChanged', search: intent.search })
      if (stateRef.current.editorMode !== 'create') {
        return true
      }
    }

    if (intent.type === 'startCreate') {
      const currentState = stateRef.current
      if (
        currentState.editorMode === 'create' &&
        !getQuoteProductsHasUnsavedChanges(currentState)
      ) {
        applyAction({ type: 'feedbackChanged', notice: null })
        applyAction({ type: 'deleteTargetChanged', id: null })
        return true
      }
    }

    return applyIntent(intent)
  }

  function requestIntent(intent: QuoteProductsPendingTransition) {
    return (
      requestTransition(intent, {
        changed: getQuoteProductsIntentChanged(stateRef.current, intent),
        run: () => executeIntent(intent),
      }) === true
    )
  }

  function setActiveFamily(
    nextFamily: QuoteProductsWorkflowState['navigation']['activeFamily']
  ) {
    return requestIntent({ type: 'setActiveFamily', nextFamily })
  }

  function setStatusFilter(next: string) {
    return requestIntent({
      type: 'setStatusFilter',
      status: normalizeQuoteProductStatusFilter(next, 'all'),
    })
  }

  function setSearch(search: string) {
    return requestIntent({ type: 'setSearch', search })
  }

  function setSelectedId(selectedId: string | null) {
    return requestIntent({ type: 'setSelectedId', selectedId })
  }

  function updateDraftField<K extends keyof QuoteProductDraft>(
    field: K,
    value: QuoteProductDraft[K]
  ) {
    const action = buildQuoteProductsDraftFieldAction(
      stateRef.current,
      field,
      value
    )
    if (action) applyAction(action)
  }

  function startCreate() {
    return requestIntent({ type: 'startCreate' })
  }

  function cancelEdit() {
    for (const action of buildQuoteProductsRestoreEditorActions({
      state: stateRef.current,
      resource: resourceSnapshot,
    })) {
      applyAction(action)
    }
  }

  async function saveCurrent() {
    const currentState = stateRef.current
    if (currentState.editorMode === 'none') return false

    const nextValidation = validateQuoteProductDraft(currentState.draft)
    applyAction({ type: 'draftChanged', draft: nextValidation.draft })
    if (!nextValidation.ok) return false

    applyAction({ type: 'mutationChanged', status: 'saving' })

    const result = await saveQuoteProductsMutation({
      resource,
      state: currentState,
      payload: nextValidation.payload,
    })
    if (!result.ok) {
      applyAction({
        type: 'mutationChanged',
        status: 'idle',
        error: result.error,
      })
      return false
    }

    applyAction({
      type: 'saveCommitted',
      row: result.row,
      notice: result.notice,
      navigation: result.navigation,
    })
    return true
  }

  function requestDelete() {
    const currentState = stateRef.current
    if (
      currentState.editorMode !== 'edit' ||
      currentState.actionStatus !== 'idle'
    )
      return false
    if (!currentState.selectedId) return false

    applyAction({ type: 'deleteTargetChanged', id: currentState.selectedId })
    return true
  }

  async function confirmDelete() {
    const currentState = stateRef.current
    const deleteTargetId = currentState.deleteTargetId
    if (!deleteTargetId || currentState.actionStatus !== 'idle') return false

    applyAction({ type: 'mutationChanged', status: 'deleting' })

    const result = await archiveQuoteProductsMutation({
      resource,
      state: currentState,
      deleteTargetId,
    })
    if (!result.ok) {
      applyAction({
        type: 'mutationChanged',
        status: 'idle',
        error: result.error,
      })
      return false
    }

    applyAction({
      type: 'deleteCommitted',
      deletedId: result.deletedId,
      notice: result.notice,
      nextSelectedId: result.nextSelectedId,
    })
    return true
  }

  function cancelDelete() {
    applyAction({ type: 'deleteTargetChanged', id: null })
  }

  function resetDiscardedDraft() {
    for (const action of buildQuoteProductsRestoreEditorActions({
      state: stateRef.current,
      resource: resourceSnapshot,
    })) {
      applyAction(action)
    }
  }

  return {
    resource,
    workflowState: state,
    derived: {
      selectedRow,
      visibleSelectedRow,
      validationResult,
      validationError,
      isDirty,
    },
    actions: {
      setActiveFamily,
      setStatusFilter,
      setSearch,
      setSelectedId,
      updateDraftField,
      startCreate,
      cancelEdit,
      saveCurrent,
      requestDelete,
      confirmDelete,
      cancelDelete,
      confirmDiscard: () =>
        confirmDiscard((intent) => {
          const policy = getQuoteProductsDiscardRestorePolicy(
            stateRef.current,
            intent
          )

          if (policy.shouldRestoreDraft) {
            resetDiscardedDraft()
          }
          if (intent.type === 'setSearch' && policy.shouldApplySearchInput) {
            applyAction({ type: 'searchChanged', search: intent.search })
          }
          return applyIntent(intent)
        }) === true,
      cancelDiscard,
    },
  }
}
