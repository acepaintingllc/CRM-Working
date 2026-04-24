'use client'

import type { QuoteProductDraft } from '@/lib/quotes/productsForm'
import { useQuoteProductsPageController } from './quoteProductsPageController'
import { buildQuoteProductsPageVm, type QuoteProductsActions } from './quoteProductsPageVm'

export type {
  QuoteProductDeleteVm,
  QuoteProductDiscardVm,
  QuoteProductsActions,
  QuoteProductsCatalogVm,
  QuoteProductsEditorVm,
} from './quoteProductsPageVm'

export function useQuoteProductsPage() {
  const controller = useQuoteProductsPageController()
  const pageVm = buildQuoteProductsPageVm({
    workflowState: controller.workflowState,
    resource: controller.resource,
    derived: controller.derived,
  })

  const actions: QuoteProductsActions = {
    setActiveFamily: controller.actions.setActiveFamily,
    setStatusFilter: controller.actions.setStatusFilter,
    setSearch: controller.actions.setSearch,
    setSelectedId: controller.actions.setSelectedId,
    updateDraftField: <K extends keyof QuoteProductDraft>(field: K, value: QuoteProductDraft[K]) =>
      controller.actions.updateDraftField(field, value),
    startCreate: controller.actions.startCreate,
    cancelEdit: controller.actions.cancelEdit,
    save: controller.actions.saveCurrent,
    requestDelete: controller.actions.requestDelete,
    confirmDelete: controller.actions.confirmDelete,
    cancelDelete: controller.actions.cancelDelete,
    confirmDiscard: controller.actions.confirmDiscard,
    cancelDiscard: controller.actions.cancelDiscard,
  }

  return {
    resource: controller.resource,
    uiState: pageVm.uiState,
    catalogVm: pageVm.catalogVm,
    editorVm: pageVm.editorVm,
    actions,
    discardVm: pageVm.discardVm,
    deleteVm: pageVm.deleteVm,
  }
}
