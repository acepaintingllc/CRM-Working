'use client'

import { useEffect, useMemo, useState } from 'react'
import { buildDenseQuotePageUiState } from '@/app/crm/quotes/_hooks/denseQuotePageUiState'
import {
  QUOTE_PRODUCT_FAMILIES,
  normalizeQuoteProductStatusFilter,
  type ProductFamily,
  type QuoteProductQuery,
  type QuoteProductRow,
  type QuoteProductStatusFilter,
} from '@/lib/quotes/productsForm'
import { createQuoteProduct, deleteQuoteProduct, updateQuoteProduct } from '@/lib/quotes/client'
import { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'
import { useQuoteProductEditorState } from './useQuoteProductEditorState'
import { useQuoteAdminIntentGuard } from './useQuoteAdminIntentGuard'
import { useQuoteProductsData } from './useQuoteProductsData'
import {
  removeProductFromVisibleSlice,
  upsertProductIntoVisibleSlice,
} from './quoteProductsControllerUtils'

export type QuoteProductsCatalogVm = {
  activeFamily: ProductFamily
  families: readonly ProductFamily[]
  statusFilter: QuoteProductStatusFilter
  search: string
  products: QuoteProductRow[]
  selectedId: string | null
  selected: QuoteProductRow | null
}

export type QuoteProductsEditorVm = {
  draft: ReturnType<typeof useQuoteProductEditorState>['draft']
  selected: QuoteProductRow | null
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
  status: 'idle' | 'confirming' | 'applying'
  transitionType: 'setSelectedId' | 'setActiveFamily' | 'setStatusFilter' | 'setSearch' | 'startCreate' | null
}

export type QuoteProductDeleteVm = {
  isOpen: boolean
  status: 'idle' | 'confirming' | 'deleting'
  productName: string | null
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
  requestDelete: () => boolean
  confirmDelete: () => Promise<boolean>
  cancelDelete: () => void
  confirmDiscard: () => boolean | Promise<boolean>
  cancelDiscard: () => void
}

type DiscardCandidateTransition =
  | { type: 'setSelectedId'; selectedId: string | null }
  | { type: 'setActiveFamily'; nextFamily: ProductFamily }
  | { type: 'setStatusFilter'; status: string }
  | { type: 'setSearch'; search: string }
  | { type: 'startCreate' }

function useQuoteProductsController() {
  const feedback = useDenseQuoteAdminFeedback()
  const [activeFamily, setActiveFamilyState] = useState<ProductFamily>(QUOTE_PRODUCT_FAMILIES[0])
  const [statusFilter, setStatusFilterState] = useState<QuoteProductStatusFilter>('all')
  const [search, setSearchState] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedId, setSelectedIdState] = useState<string | null>(null)
  const [editorSelected, setEditorSelected] = useState<QuoteProductRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<QuoteProductRow | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [search])

  const query = useMemo<QuoteProductQuery>(
    () => ({
      status: statusFilter,
      family: activeFamily,
      search: debouncedSearch || null,
    }),
    [activeFamily, debouncedSearch, statusFilter]
  )

  const resource = useQuoteProductsData({ query })
  const selected = useMemo(() => {
    if (!selectedId) return null
    return resource.data.find((product) => product.id === selectedId) ?? null
  }, [resource.data, selectedId])

  useEffect(() => {
    if (!selectedId) {
      const fallback = resource.data[0] ?? null
      if (!fallback) {
        setEditorSelected(null)
        return
      }

      setSelectedIdState(fallback.id)
      setEditorSelected(fallback)
      return
    }

    if (selected) {
      setEditorSelected(selected)
    }
  }, [resource.data, selected, selectedId])

  const editor = useQuoteProductEditorState({
    selected: editorSelected,
  })

  const guard = useQuoteAdminIntentGuard<DiscardCandidateTransition>({
    hasUnsavedChanges: editor.isDirty,
    getHasUnsavedChanges: editor.isDirtyNow,
    getIntentType: (intent) => intent.type,
  })

  function clearDeleteDialog() {
    setDeleteTarget(null)
  }

  function discardCreateDraftIfNeeded() {
    if (!editor.isCreatingNow()) return
    editor.cancel(editorSelected)
  }

  function applyIntent(transition: DiscardCandidateTransition) {
    clearDeleteDialog()

    switch (transition.type) {
      case 'setActiveFamily':
        setActiveFamilyState(transition.nextFamily)
        if (editor.isCreatingNow()) {
          editor.updateDraftField('family', transition.nextFamily)
        }
        return true
      case 'setSelectedId':
        discardCreateDraftIfNeeded()
        setSelectedIdState(transition.selectedId)
        return true
      case 'setStatusFilter':
        discardCreateDraftIfNeeded()
        setStatusFilterState(normalizeQuoteProductStatusFilter(transition.status, 'all'))
        return true
      case 'setSearch':
        discardCreateDraftIfNeeded()
        setSearchState(transition.search)
        return true
      case 'startCreate':
        editor.startCreate(activeFamily)
        feedback.clearFeedback()
        clearDeleteDialog()
        return true
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
      run: run ?? (() => applyIntent(intent) as TResult | Promise<TResult>),
    })
  }

  function setActiveFamily(nextFamily: ProductFamily) {
    return requestIntent(
      { type: 'setActiveFamily', nextFamily },
      nextFamily !== activeFamily
    )
  }

  function setSelectedId(id: string | null) {
    return requestIntent({ type: 'setSelectedId', selectedId: id }, id !== selectedId)
  }

  function setStatusFilter(next: string) {
    const normalized = normalizeQuoteProductStatusFilter(next, 'all')
    return requestIntent(
      { type: 'setStatusFilter', status: normalized },
      normalized !== statusFilter
    )
  }

  function setSearch(value: string) {
    return requestIntent({ type: 'setSearch', search: value }, value !== search)
  }

  function startCreate() {
    if (editor.isCreatingNow() && !editor.isDirtyNow()) {
      feedback.clearFeedback()
      clearDeleteDialog()
      return true
    }

    return requestIntent({ type: 'startCreate' }, !editor.isCreatingNow())
  }

  function cancelEdit() {
    editor.cancel(editorSelected)
    guard.cancelDiscard()
    feedback.clearFeedback()
    clearDeleteDialog()
  }

  async function save() {
    const validated = editor.getValidatedDraft()
    if (!validated.ok) return false

    feedback.beginAction()
    try {
      if (editor.isCreating) {
        const created = await createQuoteProduct<QuoteProductRow>(validated.payload)
        resource.setData((current) => upsertProductIntoVisibleSlice(current, created.data, query))
        feedback.setSuccessNotice(created.notice ?? 'Product created.')
        clearDeleteDialog()
        setActiveFamilyState((created.data.family as ProductFamily | null) ?? activeFamily)
        setStatusFilterState('all')
        setSearchState('')
        setDebouncedSearch('')
        setSelectedIdState(created.data.id)
        setEditorSelected(created.data)
        editor.finishCreate(created.data)
        return true
      }

      if (!selectedId) return false

      const updated = await updateQuoteProduct<QuoteProductRow>(selectedId, validated.payload)
      resource.setData((current) =>
        upsertProductIntoVisibleSlice(current, updated.data, query, selectedId)
      )
      feedback.setSuccessNotice(updated.notice ?? 'Product saved.')
      clearDeleteDialog()
      setActiveFamilyState((updated.data.family as ProductFamily | null) ?? activeFamily)
      setSelectedIdState(updated.data.id)
      setEditorSelected(updated.data)
      editor.setDraftFromRow(updated.data)
      return true
    } catch (error) {
      feedback.setErrorMessage(error instanceof Error ? error.message : 'Failed to save product.')
      return false
    } finally {
      feedback.finishAction()
    }
  }

  function requestDelete() {
    if (!editorSelected || editor.isCreating || feedback.saving) return false
    setDeleteTarget(editorSelected)
    return true
  }

  async function confirmDelete() {
    if (!deleteTarget || feedback.saving) return false

    feedback.beginAction()
    try {
      await deleteQuoteProduct(deleteTarget.id)
      resource.setData((current) => removeProductFromVisibleSlice(current, deleteTarget.id))
      feedback.setSuccessNotice('Product deleted.')

      if (selectedId === deleteTarget.id) {
        setSelectedIdState(null)
      }

      if (editorSelected?.id === deleteTarget.id) {
        setEditorSelected(null)
      }

      clearDeleteDialog()
      return true
    } catch (error) {
      feedback.setErrorMessage(error instanceof Error ? error.message : 'Failed to delete product.')
      return false
    } finally {
      feedback.finishAction()
    }
  }

  return {
    resource,
    feedback,
    activeFamily,
    statusFilter,
    search,
    selectedId,
    selected,
    editorSelected,
    editor,
    setActiveFamily,
    setStatusFilter,
    setSearch,
    setSelectedId,
    startCreate,
    cancelEdit,
    save,
    requestDelete,
    confirmDelete,
    cancelDelete: clearDeleteDialog,
    confirmDiscard: () => guard.confirmDiscard(applyIntent),
    cancelDiscard: guard.cancelDiscard,
    discardVm: {
      isOpen: guard.discardVm.isOpen,
      status: guard.discardVm.status,
      transitionType: guard.discardVm.intentType as
        | DiscardCandidateTransition['type']
        | null,
    } satisfies QuoteProductDiscardVm,
    deleteVm: {
      isOpen: Boolean(deleteTarget),
      status: feedback.saving && deleteTarget ? 'deleting' : deleteTarget ? 'confirming' : 'idle',
      productName: deleteTarget?.name ?? null,
    } satisfies QuoteProductDeleteVm,
  }
}

export function useQuoteProductsPage() {
  const controller = useQuoteProductsController()

  const validation = controller.editor.validation
  const uiState = buildDenseQuotePageUiState({
    loading: controller.resource.loading,
    hasData:
      controller.resource.data.length > 0 ||
      (!controller.resource.loading && !controller.resource.error),
    loadError: controller.resource.error,
    actionError: controller.feedback.actionError,
    validationError: validation.ok ? null : validation.summary,
    notice: controller.feedback.notice,
    canRetry: !controller.resource.loading,
    canSave:
      !controller.feedback.saving &&
      validation.ok &&
      !controller.resource.error &&
      (controller.editor.isCreating || Boolean(controller.selectedId)),
    canDelete:
      Boolean(controller.editorSelected) &&
      !controller.editor.isCreating &&
      !controller.feedback.saving &&
      !controller.resource.error,
  })

  return {
    resource: controller.resource,
    uiState,
    catalogVm: {
      activeFamily: controller.activeFamily,
      families: QUOTE_PRODUCT_FAMILIES,
      statusFilter: controller.statusFilter,
      search: controller.search,
      products: controller.resource.data,
      selectedId: controller.selectedId,
      selected: controller.selected,
    } satisfies QuoteProductsCatalogVm,
    editorVm: {
      draft: controller.editor.draft,
      selected: controller.editorSelected,
      saving: controller.feedback.saving,
      isCreating: controller.editor.isCreating,
      isDirty: controller.editor.isDirty,
      validation,
      inlineValidation: uiState.inlineValidation,
      canSave: uiState.canSave,
      canDelete: uiState.canDelete,
    } satisfies QuoteProductsEditorVm,
    actions: {
      setActiveFamily: controller.setActiveFamily,
      setStatusFilter: controller.setStatusFilter,
      setSearch: controller.setSearch,
      setSelectedId: controller.setSelectedId,
      updateDraftField: controller.editor.updateDraftField,
      startCreate: controller.startCreate,
      cancelEdit: controller.cancelEdit,
      save: controller.save,
      requestDelete: controller.requestDelete,
      confirmDelete: controller.confirmDelete,
      cancelDelete: controller.cancelDelete,
      confirmDiscard: controller.confirmDiscard,
      cancelDiscard: controller.cancelDiscard,
    } satisfies QuoteProductsActions,
    discardVm: controller.discardVm,
    deleteVm: controller.deleteVm,
  }
}
