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
import { useQuoteProductsCatalogState } from './useQuoteProductsCatalogState'
import { useQuoteProductsData } from './useQuoteProductsData'

export type QuoteProductsCatalogVm = {
  activeFamily: ProductFamily
  families: readonly ProductFamily[]
  statusFilter: QuoteProductStatusFilter
  search: string
  filtered: ReturnType<typeof useQuoteProductsCatalogState>['filtered']
  selectedId: string | null
  selected: ReturnType<typeof useQuoteProductsCatalogState>['selected']
}

export type QuoteProductsEditorVm = {
  draft: ReturnType<typeof useQuoteProductEditorState>['draft']
  selected: ReturnType<typeof useQuoteProductsCatalogState>['selected']
  saving: boolean
  isCreating: boolean
  validation: ReturnType<typeof useQuoteProductEditorState>['validation']
  inlineValidation: string | null
  canSave: boolean
  canDelete: boolean
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
}

export function useQuoteProductsPage() {
  const resource = useQuoteProductsData()
  const feedback = useDenseQuoteAdminFeedback()

  const catalog = useQuoteProductsCatalogState({
    products: resource.data,
  })

  const editor = useQuoteProductEditorState({
    selected: catalog.selected,
  })

  const mutations = useQuoteProductMutations({
    setData: resource.setData,
    feedback,
  })

  const controllerActions = useQuoteProductsControllerActions({
    catalog,
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
      (editor.isCreating || Boolean(catalog.selected)),
    canDelete: Boolean(catalog.selected) && !editor.isCreating && !feedback.saving && !resource.error,
  })

  return {
    resource,
    uiState,
    catalogVm: {
      activeFamily: catalog.activeFamily,
      families: QUOTE_PRODUCT_FAMILIES,
      statusFilter: catalog.statusFilter,
      search: catalog.search,
      filtered: catalog.filtered,
      selectedId: catalog.selectedId,
      selected: catalog.selected,
    } satisfies QuoteProductsCatalogVm,
    editorVm: {
      draft: editor.draft,
      selected: catalog.selected,
      saving: feedback.saving,
      isCreating: editor.isCreating,
      validation,
      inlineValidation: uiState.inlineValidation,
      canSave: uiState.canSave,
      canDelete: uiState.canDelete,
    } satisfies QuoteProductsEditorVm,
    actions: {
      setActiveFamily: controllerActions.setActiveFamily,
      setStatusFilter: catalog.setStatusFilter,
      setSearch: catalog.setSearch,
      setSelectedId: controllerActions.setSelectedId,
      updateDraftField: editor.updateDraftField,
      startCreate: controllerActions.startCreate,
      cancelEdit: controllerActions.cancelEdit,
      save: controllerActions.save,
      requestRemove: controllerActions.requestRemove,
    } satisfies QuoteProductsActions,
  }
}
