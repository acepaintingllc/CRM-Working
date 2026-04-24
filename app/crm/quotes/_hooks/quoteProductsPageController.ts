'use client'

import { useEffect, useMemo } from 'react'
import {
  archiveQuoteProduct,
  createQuoteProduct,
  updateQuoteProduct,
} from '@/lib/quotes/client'
import {
  normalizeQuoteProductStatusFilter,
  quoteProductMatchesQuery,
  validateQuoteProductDraft,
  type QuoteProductDraft,
  type QuoteProductRow,
} from '@/lib/quotes/productsForm'
import {
  mergeKnownQuoteProducts,
  removeProductFromVisibleSlice,
  upsertProductIntoVisibleSlice,
} from './quoteProductsControllerUtils'
import {
  buildQuoteProductsIntentState,
  buildQuoteProductsQuery,
  buildQuoteProductsSavedState,
  buildQuoteProductsSelection,
  createInitialQuoteProductsWorkflowState,
  createQuoteProductsDraftFromRow,
  getQuoteProductsHasUnsavedChanges,
  getQuoteProductsSelectedRow,
  reconcileQuoteProductsStateFromResource,
  type QuoteProductsPendingTransition,
  type QuoteProductsWorkflowAction,
  type QuoteProductsWorkflowState,
} from './quoteProductsPageState'
import { useDenseQuoteAdminOrchestrator } from './useDenseQuoteAdminOrchestrator'
import { useQuoteProductsData } from './useQuoteProductsData'

function quoteProductsPageReducer(
  state: QuoteProductsWorkflowState,
  action: QuoteProductsWorkflowAction
): QuoteProductsWorkflowState {
  switch (action.type) {
    case 'setSearchInput':
      return {
        ...state,
        navigation: {
          ...state.navigation,
          search: action.search,
        },
      }
    case 'commitSearch':
      return {
        ...state,
        navigation: {
          ...state.navigation,
          debouncedSearch: action.search.trim(),
        },
      }
    case 'setDraft':
      return {
        ...state,
        draft: action.draft,
      }
    case 'beginAction':
      return {
        ...state,
        actionStatus: action.status,
        notice: null,
        actionError: null,
      }
    case 'finishAction':
      return {
        ...state,
        actionStatus: 'idle',
      }
    case 'setNotice':
      return {
        ...state,
        notice: action.notice,
        actionError: null,
      }
    case 'setActionError':
      return {
        ...state,
        notice: null,
        actionError: action.error,
      }
    case 'clearFeedback':
      return {
        ...state,
        notice: null,
        actionError: null,
      }
    case 'openDiscard':
      if (state.pendingTransition) return state
      return {
        ...state,
        discardStatus: 'confirming',
        pendingTransition: action.transition,
      }
    case 'setDiscardStatus':
      return {
        ...state,
        discardStatus: action.status,
      }
    case 'clearDiscard':
      return {
        ...state,
        discardStatus: 'idle',
        pendingTransition: null,
      }
    case 'setDeleteTargetId':
      return {
        ...state,
        deleteTargetId: action.id,
      }
    case 'applyIntent':
      return buildQuoteProductsIntentState(state, action.intent)
    case 'cancelEdit':
      return {
        ...state,
        selectedId: action.selectedId,
        editorMode: action.selectedId ? 'edit' : 'none',
        deleteTargetId: null,
        discardStatus: 'idle',
        pendingTransition: null,
        notice: null,
        actionError: null,
      }
    case 'reconcileFromResource':
      return {
        ...state,
        selectedId: action.selectedId,
        editorMode: action.editorMode,
        draft: action.draft,
        cleanSnapshot: action.cleanSnapshot,
        deleteTargetId: state.deleteTargetId === action.selectedId ? state.deleteTargetId : null,
      }
    case 'commitSave':
      return buildQuoteProductsSavedState({
        state: {
          ...state,
          navigation: action.navigation,
        },
        row: action.row,
        notice: action.notice,
      })
    case 'commitDelete': {
      const shouldResetEditor = state.selectedId === action.deletedId
      return {
        ...state,
        selectedId: shouldResetEditor ? action.nextSelectedId : state.selectedId,
        editorMode:
          shouldResetEditor && !action.nextSelectedId
            ? 'none'
            : shouldResetEditor
              ? 'edit'
              : state.editorMode,
        deleteTargetId: null,
        actionStatus: 'idle',
        notice: action.notice,
        actionError: null,
      }
    }
    default:
      return state
  }
}

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

    try {
      if (currentState.editorMode === 'create') {
        const created = await createQuoteProduct<QuoteProductRow>(nextValidation.payload)
        const nextNavigation = {
          activeFamily: currentState.navigation.activeFamily,
          statusFilter: 'all' as const,
          search: '',
          debouncedSearch: '',
        }
        const postCreateQuery = buildQuoteProductsQuery(nextNavigation)
        const nextKnownRows = mergeKnownQuoteProducts(resource.allKnownData, [created.data])
        const nextVisibleRows = [
          created.data,
          ...nextKnownRows.filter(
            (product) =>
              product.id !== created.data.id && quoteProductMatchesQuery(product, postCreateQuery)
          ),
        ]

        resource.setAllKnownData(() => nextKnownRows)
        resource.setData(() => nextVisibleRows)
        applyAction({
          type: 'commitSave',
          row: created.data,
          notice: created.notice ?? 'Product created.',
          navigation: nextNavigation,
        })
        return true
      }

      const selectedId = currentState.selectedId
      if (!selectedId) {
        applyAction({ type: 'setActionError', error: 'Failed to save product.' })
        applyAction({ type: 'finishAction' })
        return false
      }

      const updated = await updateQuoteProduct<QuoteProductRow>(selectedId, nextValidation.payload)
      const nextVisibleRows = upsertProductIntoVisibleSlice(
        resource.data,
        updated.data,
        buildQuoteProductsQuery(currentState.navigation),
        selectedId
      )
      const nextKnownRows = mergeKnownQuoteProducts(
        removeProductFromVisibleSlice(resource.allKnownData, selectedId),
        [updated.data]
      )

      resource.setData(() => nextVisibleRows)
      resource.setAllKnownData(() => nextKnownRows)
      applyAction({
        type: 'commitSave',
        row: updated.data,
        notice: updated.notice ?? 'Product saved.',
        navigation: currentState.navigation,
      })
      return true
    } catch (error) {
      applyAction({
        type: 'setActionError',
        error: error instanceof Error ? error.message : 'Failed to save product.',
      })
      applyAction({ type: 'finishAction' })
      return false
    }
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

    try {
      const archived = await archiveQuoteProduct<QuoteProductRow>(deleteTargetId)

      const nextVisibleRows = upsertProductIntoVisibleSlice(
        resource.data,
        archived.data,
        buildQuoteProductsQuery(currentState.navigation),
        deleteTargetId
      )
      const nextKnownRows = mergeKnownQuoteProducts(resource.allKnownData, [archived.data])
      const nextSelectedId =
        currentState.selectedId === deleteTargetId
          ? deleteTargetId
          : currentState.selectedId

      resource.setData(() => nextVisibleRows)
      resource.setAllKnownData(() => nextKnownRows)
      applyAction({
        type: 'commitDelete',
        deletedId: deleteTargetId,
        notice: 'Product archived.',
        nextSelectedId,
      })
      return true
    } catch (error) {
      applyAction({
        type: 'setActionError',
        error: error instanceof Error ? error.message : 'Failed to archive product.',
      })
      applyAction({ type: 'finishAction' })
      return false
    }
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
