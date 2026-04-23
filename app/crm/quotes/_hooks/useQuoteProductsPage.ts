'use client'

import { buildDenseQuotePageUiState } from '@/app/crm/quotes/_hooks/denseQuotePageUiState'
import {
  QUOTE_PRODUCT_FAMILIES,
  normalizeQuoteProductStatusFilter,
  type ProductFamily,
  type QuoteProductRow,
  type QuoteProductStatusFilter,
} from '@/lib/quotes/productsForm'
import { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'
import { useQuoteProductEditorState } from './useQuoteProductEditorState'
import {
  type QuoteProductPendingTransition,
  useQuoteProductsDiscardGuard,
} from './useQuoteProductsDiscardGuard'
import { useQuoteProductsData } from './useQuoteProductsData'
import { useQuoteProductsMutations } from './useQuoteProductsMutations'
import { useQuoteProductsQueryState } from './useQuoteProductsQueryState'
import { useQuoteProductsSelectionState } from './useQuoteProductsSelectionState'

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
  transitionType: QuoteProductPendingTransition['type'] | null
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

function useQuoteProductsController() {
  const feedback = useDenseQuoteAdminFeedback()
  const queryState = useQuoteProductsQueryState()
  const resource = useQuoteProductsData({ query: queryState.query })
  const selection = useQuoteProductsSelectionState({ products: resource.data })
  const editor = useQuoteProductEditorState({
    selected: selection.editorSelected,
  })

  function discardCreateDraftIfNeeded() {
    if (!editor.isCreatingNow()) return
    editor.cancel(selection.editorSelected)
  }

  const mutations = useQuoteProductsMutations({
    resource,
    feedback,
    editor,
    selection,
    queryState,
  })

  function applyTransition(transition: QuoteProductPendingTransition) {
    mutations.clearDeleteDialog()

    switch (transition.type) {
      case 'setActiveFamily':
        queryState.setActiveFamilyState(transition.nextFamily)
        if (editor.isCreatingNow()) {
          editor.updateDraftField('family', transition.nextFamily)
        }
        return true
      case 'setSelectedId':
        discardCreateDraftIfNeeded()
        selection.setSelectedIdState(transition.selectedId)
        return true
      case 'setStatusFilter':
        discardCreateDraftIfNeeded()
        queryState.setStatusFilterState(normalizeQuoteProductStatusFilter(transition.status, 'all'))
        return true
      case 'setSearch':
        discardCreateDraftIfNeeded()
        queryState.setSearchState(transition.search)
        return true
      case 'startCreate':
        editor.startCreate(queryState.activeFamily)
        feedback.clearFeedback()
        mutations.clearDeleteDialog()
        return true
      default:
        return false
    }
  }

  const discard = useQuoteProductsDiscardGuard({
    hasUnsavedChanges: editor.isDirty,
    getHasUnsavedChanges: editor.isDirtyNow,
    applyTransition,
  })

  function setActiveFamily(nextFamily: ProductFamily) {
    return discard.requestTransition(
      { type: 'setActiveFamily', nextFamily },
      nextFamily !== queryState.activeFamily
    )
  }

  function setSelectedId(id: string | null) {
    return discard.requestTransition(
      { type: 'setSelectedId', selectedId: id },
      id !== selection.selectedId
    )
  }

  function setStatusFilter(next: string) {
    const normalized = normalizeQuoteProductStatusFilter(next, 'all')
    return discard.requestTransition(
      { type: 'setStatusFilter', status: normalized },
      normalized !== queryState.statusFilter
    )
  }

  function setSearch(value: string) {
    return discard.requestTransition({ type: 'setSearch', search: value }, value !== queryState.search)
  }

  function startCreate() {
    if (editor.isCreatingNow() && !editor.isDirtyNow()) {
      feedback.clearFeedback()
      mutations.clearDeleteDialog()
      return true
    }

    return discard.requestTransition({ type: 'startCreate' }, !editor.isCreatingNow())
  }

  function cancelEdit() {
    editor.cancel(selection.editorSelected)
    discard.cancelDiscard()
    feedback.clearFeedback()
    mutations.clearDeleteDialog()
  }

  return {
    resource,
    feedback,
    queryState,
    selection,
    editor,
    mutations,
    actions: {
      setActiveFamily,
      setStatusFilter,
      setSearch,
      setSelectedId,
      startCreate,
      cancelEdit,
      save: mutations.save,
      requestDelete: mutations.requestDelete,
      confirmDelete: mutations.confirmDelete,
      cancelDelete: mutations.cancelDelete,
      confirmDiscard: discard.confirmDiscard,
      cancelDiscard: discard.cancelDiscard,
    } satisfies Omit<QuoteProductsActions, 'updateDraftField'>,
    discardVm: discard.discardVm satisfies QuoteProductDiscardVm,
    deleteVm: mutations.deleteVm satisfies QuoteProductDeleteVm,
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
      (controller.editor.isCreating || Boolean(controller.selection.selectedId)),
    canDelete:
      Boolean(controller.selection.editorSelected) &&
      !controller.editor.isCreating &&
      !controller.feedback.saving &&
      !controller.resource.error,
  })

  return {
    resource: controller.resource,
    uiState,
    catalogVm: {
      activeFamily: controller.queryState.activeFamily,
      families: QUOTE_PRODUCT_FAMILIES,
      statusFilter: controller.queryState.statusFilter,
      search: controller.queryState.search,
      products: controller.resource.data,
      selectedId: controller.selection.selectedId,
      selected: controller.selection.selected,
    } satisfies QuoteProductsCatalogVm,
    editorVm: {
      draft: controller.editor.draft,
      selected: controller.selection.editorSelected,
      saving: controller.feedback.saving,
      isCreating: controller.editor.isCreating,
      isDirty: controller.editor.isDirty,
      validation,
      inlineValidation: uiState.inlineValidation,
      canSave: uiState.canSave,
      canDelete: uiState.canDelete,
    } satisfies QuoteProductsEditorVm,
    actions: {
      ...controller.actions,
      updateDraftField: controller.editor.updateDraftField,
    } satisfies QuoteProductsActions,
    discardVm: controller.discardVm,
    deleteVm: controller.deleteVm,
  }
}
