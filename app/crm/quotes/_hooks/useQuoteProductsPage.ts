'use client'

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
  selected: ReturnType<typeof useQuoteProductsSelectionState>['editorSelected']
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
  confirmDiscard: () => boolean | Promise<boolean>
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
    selected: selectionState.editorSelected,
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
      (editor.isCreating || Boolean(selectionState.selectedId)),
    canDelete:
      Boolean(selectionState.editorSelected) &&
      !editor.isCreating &&
      !feedback.saving &&
      !resource.error,
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
      selected: selectionState.editorSelected,
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
  }
}
