'use client'

import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  type QuoteProductRow,
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
  createEditorFromRow,
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
  const [allKnownData, setAllKnownData] = useState<QuoteProductRow[]>([])
  const selectionPending = !resource.loading && resource.data.length > 0 && state.editor.mode === 'none'

  useEffect(() => {
    applyAction({ type: 'syncProducts', products: resource.data })
  }, [resource.data])

  useEffect(() => {
    setAllKnownData((current) => {
      const nextById = new Map(current.map((product) => [product.id, product]))
      for (const product of resource.data) {
        nextById.set(product.id, product)
      }
      return Array.from(nextById.values())
    })
  }, [resource.data])

  useEffect(() => {
    if (!selectionPending) return
    applyAction({ type: 'syncProducts', products: resource.data })
  }, [selectionPending, resource.data])

  const effectiveResource = selectionPending ? { ...resource, loading: true } : resource
  const resourceAdapter = { ...effectiveResource, allKnownData, setAllKnownData }
  const pageVm = buildQuoteProductsPageVm({ state, resource: resourceAdapter })

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
    let draftSource = currentState.editor
    if (currentState.editor.mode === 'none') {
      const fallback = resource.data[0] ?? null
      if (!fallback) return
      applyAction({ type: 'syncProducts', products: resource.data })
      draftSource = createEditorFromRow(fallback)
    }

    applyAction({
      type: 'updateDraft',
      draft: {
        ...draftSource.draft,
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
        resource: resourceAdapter,
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
        resource: resourceAdapter,
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

  async function requestRemove() {
    const requested = requestDelete()
    if (!requested) return false
    return confirmDelete()
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
    requestRemove,
    confirmDelete,
    cancelDelete,
    confirmDiscard,
    cancelDiscard,
  }

  return {
    resource: resourceAdapter,
    uiState: pageVm.uiState,
    catalogVm: pageVm.catalogVm,
    editorVm: pageVm.editorVm,
    actions,
    discardVm: pageVm.discardVm,
    deleteVm: pageVm.deleteVm,
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
