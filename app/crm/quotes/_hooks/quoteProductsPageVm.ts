'use client'

import { buildDenseQuotePageUiState } from '@/app/crm/quotes/_hooks/denseQuotePageUiState'
import { QUOTE_PRODUCT_FAMILIES, validateQuoteProductDraft, type QuoteProductDraft, type QuoteProductRow, type QuoteProductValidationState } from '@/lib/quotes/productsForm'
import { getSelectionVisibility } from './quoteProductsPageTransitions'
import { createEditorFromRow } from './quoteProductsPageState'
import type { QuoteProductsControllerState, QuoteProductsPendingTransition } from './quoteProductsPageState'
import type { QuoteProductsResourceAdapter } from './useQuoteProductsData'

export type QuoteProductsCatalogVm = {
  activeFamily: QuoteProductsControllerState['activeFamily']
  families: typeof QUOTE_PRODUCT_FAMILIES
  statusFilter: QuoteProductsControllerState['statusFilter']
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
  setActiveFamily: (nextFamily: QuoteProductsControllerState['activeFamily']) => boolean
  setStatusFilter: (next: string) => boolean
  setSearch: (value: string) => boolean
  setSelectedId: (id: string | null) => boolean
  updateDraftField: <K extends keyof QuoteProductDraft>(field: K, value: QuoteProductDraft[K]) => void
  startCreate: () => boolean
  cancelEdit: () => void
  save: () => Promise<boolean>
  requestDelete: () => boolean
  requestRemove: () => Promise<boolean>
  confirmDelete: () => Promise<boolean>
  cancelDelete: () => void
  confirmDiscard: () => boolean
  cancelDiscard: () => void
}

export type QuoteProductsPageController = {
  resource: QuoteProductsResourceAdapter
  uiState: ReturnType<typeof buildDenseQuotePageUiState>
  catalogVm: QuoteProductsCatalogVm
  editorVm: QuoteProductsEditorVm
  actions: QuoteProductsActions
  discardVm: QuoteProductDiscardVm
  deleteVm: QuoteProductDeleteVm
}

function buildDeleteStatus(params: {
  saving: boolean
  deleteTarget: QuoteProductsControllerState['deleteTarget']
}): QuoteProductDeleteVm['status'] {
  const { saving, deleteTarget } = params
  if (saving && deleteTarget) return 'deleting'
  if (deleteTarget) return 'confirming'
  return 'idle'
}

export function buildQuoteProductsPageVm(params: {
  state: QuoteProductsControllerState
  resource: QuoteProductsResourceAdapter
}) {
  const { state, resource } = params
  const effectiveEditor =
    state.editor.mode === 'none' && resource.data[0] ? createEditorFromRow(resource.data[0]) : state.editor
  const selectedId = effectiveEditor.mode === 'edit' ? effectiveEditor.targetId : null
  const selectedVisible = selectedId
    ? resource.data.find((product) => product.id === selectedId) ?? null
    : null
  const editorSelected = effectiveEditor.mode === 'edit' ? effectiveEditor.targetRow : null
  const selectionVisibility = getSelectionVisibility(state, selectedVisible)
  const validationResult = validateQuoteProductDraft(effectiveEditor.draft)
  const validation = validationResult.validation

  const uiState = buildDenseQuotePageUiState({
    loading: resource.loading,
    hasData: resource.data.length > 0 || (!resource.loading && !resource.error),
    loadError: resource.error,
    actionError: state.feedback.actionError,
    validationError: validation.ok ? null : validation.summary,
    notice: state.feedback.notice,
    canRetry: !resource.loading,
    canSave:
      !state.feedback.saving &&
      !resource.error &&
      validation.ok &&
      (effectiveEditor.mode === 'create' || effectiveEditor.mode === 'edit'),
    canDelete:
      !state.feedback.saving &&
      !resource.error &&
      effectiveEditor.mode === 'edit',
  })

  return {
    uiState,
    validationResult,
    selectedId,
    catalogVm: {
      activeFamily: state.activeFamily,
      families: QUOTE_PRODUCT_FAMILIES,
      statusFilter: state.statusFilter,
      search: state.search,
      products: resource.data,
      selectedId,
      selected: selectedVisible,
    },
    editorVm: {
      draft: effectiveEditor.draft,
      selected: editorSelected,
      saving: state.feedback.saving,
      isCreating: effectiveEditor.mode === 'create',
      isDirty: effectiveEditor.dirty,
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
      isOpen: state.discard.status === 'confirming' && Boolean(state.discard.transition),
      status: state.discard.status,
      transitionType: state.discard.transition?.type ?? null,
    },
    deleteVm: {
      isOpen: Boolean(state.deleteTarget),
      status: buildDeleteStatus({
        saving: state.feedback.saving,
        deleteTarget: state.deleteTarget,
      }),
      productName: state.deleteTarget?.name ?? null,
    },
  }
}
