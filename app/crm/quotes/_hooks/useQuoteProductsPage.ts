'use client'

<<<<<<< Updated upstream
import { buildDenseQuotePageUiState } from '@/app/crm/quotes/_hooks/denseQuotePageUiState'
import {
  QUOTE_PRODUCT_FAMILIES,
  type ProductFamily,
  type QuoteProductStatusFilter,
} from '@/lib/quotes/productsForm'
import { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'
import { useQuoteProductEditorState } from './useQuoteProductEditorState'
import { useQuoteProductsControllerActions } from './useQuoteProductsControllerActions'
import { useQuoteProductMutations } from './useQuoteProductMutations'
import {
  useQuoteProductsQueryState,
  useQuoteProductsSelectionState,
} from './useQuoteProductsCatalogState'
import { useQuoteProductsData } from './useQuoteProductsData'

export type QuoteProductsCatalogVm = {
  activeFamily: ProductFamily
  families: readonly ProductFamily[]
  statusFilter: QuoteProductStatusFilter
  search: string
  products: ReturnType<typeof useQuoteProductsSelectionState>['products']
  selectedId: string | null
  selected: ReturnType<typeof useQuoteProductsSelectionState>['selected']
}

export type QuoteProductsEditorVm = {
  draft: ReturnType<typeof useQuoteProductEditorState>['draft']
  selected: ReturnType<typeof useQuoteProductsSelectionState>['selected']
  saving: boolean
  isCreating: boolean
  isDirty: boolean
  validation: ReturnType<typeof useQuoteProductEditorState>['validation']
  inlineValidation: string | null
  canSave: boolean
  canDelete: boolean
}

export type QuoteProductDiscardVm = {
  isOpen: boolean
  transitionType: 'setSelectedId' | 'setActiveFamily' | 'setStatusFilter' | 'setSearch' | 'startCreate' | null
}

export type QuoteProductsActions = {
  setActiveFamily: (nextFamily: ProductFamily) => void
  setStatusFilter: (next: string) => void
  setSearch: (value: string) => void
  setSelectedId: (id: string | null) => void
  updateDraftField: ReturnType<typeof useQuoteProductEditorState>['updateDraftField']
  startCreate: () => void
  cancelEdit: () => void
  save: () => Promise<boolean>
  requestRemove: () => Promise<boolean>
  confirmDiscard: () => boolean
  cancelDiscard: () => void
}

export function useQuoteProductsPage() {
  const feedback = useDenseQuoteAdminFeedback()

  const queryState = useQuoteProductsQueryState()

  const resource = useQuoteProductsData({
    query: queryState.query,
  })

  const selectionState = useQuoteProductsSelectionState({
    products: resource.data,
  })

  const editor = useQuoteProductEditorState({
    selected: selectionState.selected,
  })

  const mutations = useQuoteProductMutations({
    setData: resource.setData,
    getQuery: () => queryState.query,
    feedback,
  })

  const controllerActions = useQuoteProductsControllerActions({
    queryState,
    selectionState,
    editor,
    mutations,
    feedback,
  })

  const validation = editor.validation
  const uiState = buildDenseQuotePageUiState({
    loading: resource.loading,
    hasData: resource.data.length > 0 || (!resource.loading && !resource.error),
    loadError: resource.error,
    actionError: feedback.actionError,
    validationError: validation.ok ? null : validation.summary,
    notice: feedback.notice,
    canRetry: !resource.loading,
    canSave:
      !feedback.saving &&
      validation.ok &&
      !resource.error &&
      (editor.isCreating || Boolean(selectionState.selected)),
    canDelete:
      Boolean(selectionState.selected) && !editor.isCreating && !feedback.saving && !resource.error,
  })

  return {
    resource,
    uiState,
    catalogVm: {
      activeFamily: queryState.activeFamily,
      families: QUOTE_PRODUCT_FAMILIES,
      statusFilter: queryState.statusFilter,
      search: queryState.search,
      products: resource.data,
      selectedId: selectionState.selectedId,
      selected: selectionState.selected,
    } satisfies QuoteProductsCatalogVm,
    editorVm: {
      draft: editor.draft,
      selected: selectionState.selected,
      saving: feedback.saving,
      isCreating: editor.isCreating,
      isDirty: editor.isDirty,
      validation,
      inlineValidation: uiState.inlineValidation,
      canSave: uiState.canSave,
      canDelete: uiState.canDelete,
    } satisfies QuoteProductsEditorVm,
    actions: {
      setActiveFamily: controllerActions.setActiveFamily,
      setStatusFilter: controllerActions.setStatusFilter,
      setSearch: controllerActions.setSearch,
      setSelectedId: controllerActions.setSelectedId,
      updateDraftField: controllerActions.updateDraftField,
      startCreate: controllerActions.startCreate,
      cancelEdit: controllerActions.cancelEdit,
      save: controllerActions.save,
      requestRemove: controllerActions.requestRemove,
      confirmDiscard: controllerActions.confirmDiscard,
      cancelDiscard: controllerActions.cancelDiscard,
    } satisfies QuoteProductsActions,
    discardVm: controllerActions.discardVm,
=======
import { useEffect, useMemo, useReducer, useRef } from 'react'
import {
  normalizeQuoteProductStatusFilter,
  type QuoteProductDraft,
} from '@/lib/quotes/productsForm'
import { quoteProductsPageReducer } from './quoteProductsPageReducer'
import {
  deleteQuoteProductMutation,
  saveQuoteProductMutation,
  validateDraftForSave,
} from './quoteProductsPageMutations'
import {
  buildCurrentQuery,
  hasUnsavedChanges,
} from './quoteProductsPageTransitions'
import {
  buildQuoteProductsPageVm,
  type QuoteProductsActions,
  type QuoteProductsPageController,
} from './quoteProductsPageVm'
import {
  getSelectedId,
  initialQuoteProductsPageState,
  type QuoteProductsControllerAction,
  type QuoteProductsPendingTransition,
} from './quoteProductsPageState'
import { useQuoteProductsResourceAdapter } from './useQuoteProductsData'

export function useQuoteProductsPage(): QuoteProductsPageController {
  const [state, dispatch] = useReducer(quoteProductsPageReducer, initialQuoteProductsPageState)
  const stateRef = useRef(state)

  function applyAction(action: QuoteProductsControllerAction) {
    stateRef.current = quoteProductsPageReducer(stateRef.current, action)
    dispatch(action)
  }

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      applyAction({ type: 'commitDebouncedSearch', search: state.search })
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [state.search])

  const query = useMemo(() => buildCurrentQuery(state), [state])
  const resource = useQuoteProductsResourceAdapter({ query })

  useEffect(() => {
    applyAction({ type: 'syncProducts', products: resource.data })
  }, [resource.data])

  const pageVm = buildQuoteProductsPageVm({ state, resource })

  function requestTransition(transition: QuoteProductsPendingTransition, changed: boolean) {
    if (!changed) return true

    const currentState = stateRef.current
    if (hasUnsavedChanges(currentState)) {
      applyAction({ type: 'queueDiscard', transition })
      return false
    }

    applyAction({
      type: 'applyTransition',
      transition,
      products: resource.data,
    })
    return true
  }

  function updateDraftField<K extends keyof QuoteProductDraft>(field: K, value: QuoteProductDraft[K]) {
    const currentState = stateRef.current
    if (currentState.editor.mode === 'none') return

    applyAction({
      type: 'updateDraft',
      draft: {
        ...currentState.editor.draft,
        [field]: value,
      },
    })
  }

  async function save() {
    const currentState = stateRef.current
    if (currentState.editor.mode === 'none') return false

    const validationResult = validateDraftForSave(currentState)
    applyAction({ type: 'updateDraft', draft: validationResult.draft })
    if (!validationResult.ok) return false

    applyAction({
      type: 'setFeedback',
      saving: true,
      notice: null,
      actionError: null,
    })

    try {
      const result = await saveQuoteProductMutation({
        state: currentState,
        resource,
        validationResult,
      })

      if (!result.ok) {
        applyAction({
          type: 'setFeedback',
          saving: false,
          notice: null,
          actionError: result.error,
        })
        return false
      }

      applyAction(result.action)
      return true
    } catch (error) {
      applyAction({
        type: 'setFeedback',
        saving: false,
        notice: null,
        actionError: error instanceof Error ? error.message : 'Failed to save product.',
      })
      return false
    }
  }

  function requestDelete() {
    const currentState = stateRef.current
    if (currentState.editor.mode !== 'edit' || currentState.feedback.saving) return false
    applyAction({ type: 'setDeleteTarget', target: currentState.editor.targetRow })
    return true
  }

  async function confirmDelete() {
    const currentState = stateRef.current
    const deleteTarget = currentState.deleteTarget
    if (!deleteTarget || currentState.feedback.saving) return false

    applyAction({
      type: 'setFeedback',
      saving: true,
      notice: null,
      actionError: null,
    })

    try {
      const result = await deleteQuoteProductMutation({
        state: currentState,
        resource,
      })

      if (!result.ok) {
        applyAction({
          type: 'setFeedback',
          saving: false,
          notice: null,
          actionError: result.error,
        })
        return false
      }

      applyAction(result.action)
      return true
    } catch (error) {
      applyAction({
        type: 'setFeedback',
        saving: false,
        notice: null,
        actionError: error instanceof Error ? error.message : 'Failed to delete product.',
      })
      return false
    }
  }

  function confirmDiscard() {
    const currentState = stateRef.current
    const pendingTransition = currentState.discard.transition
    if (!pendingTransition || currentState.discard.status === 'applying') return false

    applyAction({ type: 'setDiscardStatus', status: 'applying' })
    applyAction({
      type: 'applyTransition',
      transition: pendingTransition,
      products: resource.data,
    })
    applyAction({ type: 'clearDiscard' })
    return true
  }

  function cancelDiscard() {
    applyAction({ type: 'clearDiscard' })
  }

  function cancelDelete() {
    applyAction({ type: 'setDeleteTarget', target: null })
  }

  function cancelEdit() {
    applyAction({ type: 'cancelEdit', products: resource.data })
  }

  const actions: QuoteProductsActions = {
    setActiveFamily: (nextFamily) =>
      requestTransition(
        { type: 'setActiveFamily', nextFamily },
        nextFamily !== stateRef.current.activeFamily
      ),
    setStatusFilter: (next) => {
      const normalized = normalizeQuoteProductStatusFilter(next, 'all')
      return requestTransition(
        { type: 'setStatusFilter', status: normalized },
        normalized !== stateRef.current.statusFilter
      )
    },
    setSearch: (value) => {
      const currentState = stateRef.current
      if (hasUnsavedChanges(currentState) && value !== currentState.search) {
        applyAction({ type: 'queueDiscard', transition: { type: 'setSearch', search: value } })
        return false
      }
      applyAction({ type: 'setSearchInput', search: value })
      if (currentState.editor.mode === 'create') {
        applyAction({
          type: 'applyTransition',
          transition: { type: 'setSearch', search: value },
          products: resource.data,
        })
      }
      return true
    },
    setSelectedId: (id) =>
      requestTransition(
        { type: 'setSelectedId', selectedId: id },
        id !== getSelectedId(stateRef.current.editor)
      ),
    updateDraftField,
    startCreate: () => {
      const currentState = stateRef.current
      if (currentState.editor.mode === 'create' && !currentState.editor.dirty) {
        applyAction({
          type: 'setFeedback',
          notice: null,
          actionError: null,
        })
        applyAction({ type: 'setDeleteTarget', target: null })
        return true
      }

      return requestTransition(
        { type: 'startCreate' },
        currentState.editor.mode !== 'create'
      )
    },
    cancelEdit,
    save,
    requestDelete,
    confirmDelete,
    cancelDelete,
    confirmDiscard,
    cancelDiscard,
  }

  return {
    resource,
    uiState: pageVm.uiState,
    catalogVm: pageVm.catalogVm,
    editorVm: pageVm.editorVm,
    actions,
    discardVm: pageVm.discardVm,
    deleteVm: pageVm.deleteVm,
>>>>>>> Stashed changes
  }
}

export type {
  QuoteProductDeleteVm,
  QuoteProductDiscardVm,
  QuoteProductsActions,
  QuoteProductsCatalogVm,
  QuoteProductsEditorVm,
  QuoteProductsPageController,
} from './quoteProductsPageVm'
