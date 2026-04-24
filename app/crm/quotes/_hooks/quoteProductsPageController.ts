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
  buildQuoteProductsSelection,
  createInitialQuoteProductsWorkflowState,
  createQuoteProductsDraftFromRow,
  getQuoteProductsHasUnsavedChanges,
  getQuoteProductsSelectedRow,
  quoteProductsPageReducer,
  reconcileQuoteProductsStateFromResource,
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
      queue: (intent) => ({ type: 'openDiscard', transition: intent }),
      setStatus: (status) => ({ type: 'setDiscardStatus', status }),
      clear: () => ({ type: 'clearDiscard' }),
    },
  })
  const { state, stateRef, applyAction, requestTransition, confirmDiscard, cancelDiscard } =
    orchestrator

  const query = useMemo(() => buildQuoteProductsQuery(state.navigation), [state.navigation])
  const resource = useQuoteProductsData({ query })

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      applyAction({ type: 'commitSearch', search: state.navigation.search })
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [applyAction, state.navigation.search])

  useEffect(() => {
    const nextAction = reconcileQuoteProductsStateFromResource(stateRef.current, {
      visibleRows: resource.data,
      knownRows: resource.allKnownData,
    })
    if (nextAction) {
      applyAction(nextAction)
    }
  }, [
    applyAction,
    resource.allKnownData,
    resource.data,
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
    validationResult && !validationResult.ok ? validationResult.validation.summary : null
  const isDirty = getQuoteProductsHasUnsavedChanges(state)

  function applyIntent(intent: QuoteProductsPendingTransition) {
    applyAction({ type: 'applyIntent', intent })
    return true
  }

  function setActiveFamily(nextFamily: QuoteProductsWorkflowState['navigation']['activeFamily']) {
    if (nextFamily === stateRef.current.navigation.activeFamily) return true
    return (
      requestTransition(
        { type: 'setActiveFamily', nextFamily },
        {
          changed: true,
          run: () => applyIntent({ type: 'setActiveFamily', nextFamily }),
        }
      ) === true
    )
  }

  function setStatusFilter(next: string) {
    const normalized = normalizeQuoteProductStatusFilter(next, 'all')
    if (normalized === stateRef.current.navigation.statusFilter) return true
    return (
      requestTransition(
        { type: 'setStatusFilter', status: normalized },
        {
          changed: true,
          run: () => applyIntent({ type: 'setStatusFilter', status: normalized }),
        }
      ) === true
    )
  }

  function setSearch(search: string) {
    const currentState = stateRef.current
    if (search === currentState.navigation.search) return true

    return (
      requestTransition(
        { type: 'setSearch', search },
        {
          changed: true,
          run: () => {
            applyAction({ type: 'setSearchInput', search })
            if (currentState.editorMode === 'create') {
              applyIntent({ type: 'setSearch', search })
            }
            return true
          },
        }
      ) === true
    )
  }

  function setSelectedId(selectedId: string | null) {
    if (selectedId === stateRef.current.selectedId) return true
    return (
      requestTransition(
        { type: 'setSelectedId', selectedId },
        {
          changed: true,
          run: () => applyIntent({ type: 'setSelectedId', selectedId }),
        }
      ) === true
    )
  }

  function updateDraftField<K extends keyof QuoteProductDraft>(
    field: K,
    value: QuoteProductDraft[K]
  ) {
    if (stateRef.current.editorMode === 'none') return
    applyAction({
      type: 'setDraft',
      draft: {
        ...stateRef.current.draft,
        [field]: value,
      },
    })
  }

  function startCreate() {
    const currentState = stateRef.current
    if (currentState.editorMode === 'create' && !getQuoteProductsHasUnsavedChanges(currentState)) {
      applyAction({ type: 'clearFeedback' })
      applyAction({ type: 'setDeleteTargetId', id: null })
      return true
    }

    return (
      requestTransition(
        { type: 'startCreate' },
        {
          changed: currentState.editorMode !== 'create',
          run: () => applyIntent({ type: 'startCreate' }),
        }
      ) === true
    )
  }

  function cancelEdit() {
    const currentState = stateRef.current
    const selectedId =
      currentState.editorMode === 'create'
        ? currentState.returnSelectionId
        : currentState.selectedId
    applyAction({ type: 'cancelEdit', selectedId })

    const selection = buildQuoteProductsSelection({
      visibleRows: resource.data,
      knownRows: resource.allKnownData,
      selectedId,
    })

    if (!selection.selected) {
      return
    }

    const restored = createQuoteProductsDraftFromRow(selection.selected)
    applyAction({
      type: 'reconcileFromResource',
      selectedId: selection.selected.id,
      editorMode: 'edit',
      draft: restored.draft,
      cleanSnapshot: restored.cleanSnapshot,
    })
  }

  async function saveCurrent() {
    const currentState = stateRef.current
    if (currentState.editorMode === 'none') return false

    const nextValidation = validateQuoteProductDraft(currentState.draft)
    applyAction({ type: 'setDraft', draft: nextValidation.draft })
    if (!nextValidation.ok) return false

    applyAction({ type: 'beginAction', status: 'saving' })

    const result = await saveQuoteProductsMutation({
      resource,
      state: currentState,
      payload: nextValidation.payload,
    })
    if (!result.ok) {
      applyAction({ type: 'setActionError', error: result.error })
      applyAction({ type: 'finishAction' })
      return false
    }

    applyAction({
      type: 'commitSave',
      row: result.row,
      notice: result.notice,
      navigation: result.navigation,
    })
    return true
  }

  function requestDelete() {
    const currentState = stateRef.current
    if (currentState.editorMode !== 'edit' || currentState.actionStatus !== 'idle') return false
    if (!currentState.selectedId) return false

    applyAction({ type: 'setDeleteTargetId', id: currentState.selectedId })
    return true
  }

  async function confirmDelete() {
    const currentState = stateRef.current
    const deleteTargetId = currentState.deleteTargetId
    if (!deleteTargetId || currentState.actionStatus !== 'idle') return false

    applyAction({ type: 'beginAction', status: 'deleting' })

    const result = await archiveQuoteProductsMutation({
      resource,
      state: currentState,
      deleteTargetId,
    })
    if (!result.ok) {
      applyAction({ type: 'setActionError', error: result.error })
      applyAction({ type: 'finishAction' })
      return false
    }

    applyAction({
      type: 'commitDelete',
      deletedId: result.deletedId,
      notice: result.notice,
      nextSelectedId: result.nextSelectedId,
    })
    return true
  }

  function cancelDelete() {
    applyAction({ type: 'setDeleteTargetId', id: null })
  }

  function resetDiscardedDraft() {
    const currentState = stateRef.current
    const selectedId =
      currentState.editorMode === 'create'
        ? currentState.returnSelectionId
        : currentState.selectedId

    applyAction({ type: 'cancelEdit', selectedId })

    const selection = buildQuoteProductsSelection({
      visibleRows: resource.data,
      knownRows: resource.allKnownData,
      selectedId,
    })

    if (!selection.selected) {
      return
    }

    const restored = createQuoteProductsDraftFromRow(selection.selected)
    applyAction({
      type: 'reconcileFromResource',
      selectedId: selection.selected.id,
      editorMode: 'edit',
      draft: restored.draft,
      cleanSnapshot: restored.cleanSnapshot,
    })
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
          const shouldResetDraft =
            intent.type === 'setSelectedId' ||
            intent.type === 'startCreate' ||
            (stateRef.current.editorMode === 'create' && intent.type !== 'setActiveFamily')

          if (shouldResetDraft) {
            resetDiscardedDraft()
          }
          if (intent.type === 'setSearch') {
            applyAction({ type: 'setSearchInput', search: intent.search })
          }
          return applyIntent(intent)
        }) === true,
      cancelDiscard,
    },
  }
}
