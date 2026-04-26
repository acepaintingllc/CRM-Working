'use client'

import { buildDenseQuotePageUiState } from '@/app/crm/quotes/_hooks/denseQuotePageUiState'
import {
  QUOTE_PRODUCT_FAMILIES,
  QUOTE_PRODUCT_SCOPE_FILTERS,
  type QuoteProductDraft,
  type QuoteProductRow,
  type QuoteProductValidationState,
} from '@/lib/quotes/productsForm'
import type { QuoteProductsPendingTransition, QuoteProductsWorkflowState } from './quoteProductsPageState'
import type { QuoteProductsResourceAdapter } from './useQuoteProductsData'

export type QuoteProductsCatalogVm = {
  activeFamily: QuoteProductsWorkflowState['navigation']['activeFamily']
  families: typeof QUOTE_PRODUCT_FAMILIES
  statusFilter: QuoteProductsWorkflowState['navigation']['statusFilter']
  scopeFilters: typeof QUOTE_PRODUCT_SCOPE_FILTERS
  scopeFilter: QuoteProductsWorkflowState['navigation']['scopeFilter']
  search: string
  products: QuoteProductRow[]
  selectedId: string | null
  selected: QuoteProductRow | null
}

export type QuoteProductsEditorVm = {
  draft: QuoteProductDraft
  selected: QuoteProductRow | null
  saving: boolean
  isCreating: boolean
  isDirty: boolean
  validation: QuoteProductValidationState
  inlineValidation: string | null
  canSave: boolean
  canDelete: boolean
  selectionVisibility: 'none' | 'visible' | 'hidden'
  selectionNotice: string | null
}

export type QuoteProductDiscardVm = {
  isOpen: boolean
  status: 'idle' | 'confirming' | 'applying'
  transitionType: QuoteProductsPendingTransition['type'] | null
}

export type QuoteProductDeleteVm = {
  isOpen: boolean
  status: 'idle' | 'confirming' | 'deleting'
  productName: string | null
}

export type QuoteProductsActions = {
  setActiveFamily: (nextFamily: QuoteProductsWorkflowState['navigation']['activeFamily']) => boolean
  setStatusFilter: (next: string) => boolean
  setScopeFilter: (next: string) => boolean
  setSearch: (value: string) => boolean
  setSelectedId: (id: string | null) => boolean
  updateDraftField: <K extends keyof QuoteProductDraft>(field: K, value: QuoteProductDraft[K]) => void
  startCreate: () => boolean
  cancelEdit: () => void
  save: () => Promise<boolean>
  requestDelete: () => boolean
  confirmDelete: () => Promise<boolean>
  cancelDelete: () => void
  confirmDiscard: () => boolean
  cancelDiscard: () => void
}

function buildDeleteStatus(params: {
  actionStatus: QuoteProductsWorkflowState['actionStatus']
  deleteTargetId: string | null
}): QuoteProductDeleteVm['status'] {
  const { actionStatus, deleteTargetId } = params
  if (actionStatus === 'deleting' && deleteTargetId) return 'deleting'
  if (deleteTargetId) return 'confirming'
  return 'idle'
}

export function buildQuoteProductsPageVm(params: {
  workflowState: QuoteProductsWorkflowState
  resource: QuoteProductsResourceAdapter
  derived: {
    selectedRow: QuoteProductRow | null
    visibleSelectedRow: QuoteProductRow | null
    validationResult:
      | ReturnType<typeof import('@/lib/quotes/productsForm').validateQuoteProductDraft>
      | null
    validationError: string | null
    isDirty: boolean
  }
}) {
  const { workflowState, resource, derived } = params
  const validation =
    derived.validationResult?.validation ?? ({
      ok: true,
      summary: null,
      fields: {},
    } satisfies QuoteProductValidationState)
  const selectionVisibility =
    workflowState.editorMode !== 'edit'
      ? ('none' as const)
      : derived.visibleSelectedRow
        ? ('visible' as const)
        : ('hidden' as const)

  const hasData = resource.data.length > 0
  const uiState = buildDenseQuotePageUiState({
    loading: resource.loading,
    hasData,
    loadError: resource.error,
    actionError: workflowState.actionError,
    validationError: validation.ok ? null : derived.validationError,
    notice: workflowState.notice,
    canRetry: !resource.loading,
    canSave:
      workflowState.actionStatus === 'idle' &&
      !resource.error &&
      validation.ok &&
      workflowState.editorMode !== 'none',
    canDelete:
      workflowState.actionStatus === 'idle' &&
      !resource.error &&
      workflowState.editorMode === 'edit' &&
      derived.selectedRow?.status !== 'Archived',
  })

  return {
    uiState,
    catalogVm: {
      activeFamily: workflowState.navigation.activeFamily,
      families: QUOTE_PRODUCT_FAMILIES,
      statusFilter: workflowState.navigation.statusFilter,
      scopeFilters: QUOTE_PRODUCT_SCOPE_FILTERS,
      scopeFilter: workflowState.navigation.scopeFilter,
      search: workflowState.navigation.search,
      products: resource.data,
      selectedId: workflowState.selectedId,
      selected: derived.visibleSelectedRow,
    },
    editorVm: {
      draft: workflowState.draft,
      selected: derived.selectedRow,
      saving: workflowState.actionStatus === 'saving',
      isCreating: workflowState.editorMode === 'create',
      isDirty: derived.isDirty,
      validation,
      inlineValidation: uiState.inlineValidation,
      canSave: uiState.canSave,
      canDelete: uiState.canDelete,
      selectionVisibility,
      selectionNotice:
        selectionVisibility === 'hidden'
          ? 'Selected product is hidden by the current family, filter, or search.'
          : null,
    },
    discardVm: {
      isOpen:
        workflowState.discardStatus === 'confirming' && Boolean(workflowState.pendingTransition),
      status: workflowState.discardStatus,
      transitionType: workflowState.pendingTransition?.type ?? null,
    },
    deleteVm: {
      isOpen: Boolean(workflowState.deleteTargetId),
      status: buildDeleteStatus({
        actionStatus: workflowState.actionStatus,
        deleteTargetId: workflowState.deleteTargetId,
      }),
      productName:
        workflowState.deleteTargetId == null
          ? null
          : resource.allKnownData.find((product) => product.id === workflowState.deleteTargetId)?.name ??
            null,
    },
  }
}
