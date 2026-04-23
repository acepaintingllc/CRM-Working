'use client'

import { useEffect, useMemo, useReducer, useRef } from 'react'
import { buildDenseQuotePageUiState } from '@/app/crm/quotes/_hooks/denseQuotePageUiState'
import { useQuoteProductsData } from '@/app/crm/quotes/_hooks/useQuoteProductsData'
import {
  QUOTE_PRODUCT_FAMILIES,
  createEmptyQuoteProductDraft,
  createQuoteProductDraftSnapshot,
  normalizeQuoteProductFamily,
  normalizeQuoteProductStatusFilter,
  quoteProductMatchesQuery,
  quoteProductRowToDraft,
  validateQuoteProductDraft,
  type ProductFamily,
  type QuoteProductDraft,
  type QuoteProductQuery,
  type QuoteProductRow,
  type QuoteProductStatusFilter,
  type QuoteProductValidationState,
} from '@/lib/quotes/productsForm'
import { createQuoteProduct, deleteQuoteProduct, updateQuoteProduct } from '@/lib/quotes/client'
import { removeProductFromVisibleSlice, upsertProductIntoVisibleSlice } from './quoteProductsControllerUtils'

type QuoteProductsPendingTransition =
  | { type: 'setSelectedId'; selectedId: string | null }
  | { type: 'setActiveFamily'; nextFamily: ProductFamily }
  | { type: 'setStatusFilter'; status: QuoteProductStatusFilter }
  | { type: 'setSearch'; search: string }
  | { type: 'startCreate' }

type QuoteProductEditorState =
  | {
      mode: 'none'
      draft: QuoteProductDraft
      cleanSnapshotKey: string
      dirty: false
    }
  | {
      mode: 'edit'
      targetId: string
      targetRow: QuoteProductRow
      draft: QuoteProductDraft
      cleanSnapshotKey: string
      dirty: boolean
    }
  | {
      mode: 'create'
      draft: QuoteProductDraft
      cleanSnapshotKey: string
      dirty: boolean
      returnSelectionId: string | null
    }

type QuoteProductsControllerState = {
  activeFamily: ProductFamily
  statusFilter: QuoteProductStatusFilter
  search: string
  debouncedSearch: string
  editor: QuoteProductEditorState
  discard: {
    status: 'idle' | 'confirming' | 'applying'
    transition: QuoteProductsPendingTransition | null
  }
  deleteTarget: QuoteProductRow | null
  feedback: {
    saving: boolean
    notice: string | null
    actionError: string | null
  }
}

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
  setActiveFamily: (nextFamily: ProductFamily) => boolean
  setStatusFilter: (next: string) => boolean
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

type QuoteProductsAction =
  | { type: 'setSearchInput'; search: string }
  | { type: 'commitDebouncedSearch'; search: string }
  | { type: 'updateDraft'; draft: QuoteProductDraft }
  | { type: 'setFeedback'; saving?: boolean; notice?: string | null; actionError?: string | null }
  | { type: 'queueDiscard'; transition: QuoteProductsPendingTransition }
  | { type: 'setDiscardStatus'; status: 'idle' | 'confirming' | 'applying' }
  | { type: 'clearDiscard' }
  | { type: 'setDeleteTarget'; target: QuoteProductRow | null }
  | { type: 'applyTransition'; transition: QuoteProductsPendingTransition; products: QuoteProductRow[] }
  | { type: 'cancelEdit'; products: QuoteProductRow[] }
  | { type: 'syncProducts'; products: QuoteProductRow[] }
  | { type: 'saveSuccess'; row: QuoteProductRow; notice: string | null }
  | {
      type: 'deleteSuccess'
      deletedId: string
      notice: string | null
      products: QuoteProductRow[]
    }

export type QuoteProductsPageController = {
  resource: ReturnType<typeof useQuoteProductsData>
  uiState: ReturnType<typeof buildDenseQuotePageUiState>
  catalogVm: QuoteProductsCatalogVm
  editorVm: QuoteProductsEditorVm
  actions: QuoteProductsActions
  discardVm: QuoteProductDiscardVm
  deleteVm: QuoteProductDeleteVm
}

const EMPTY_DRAFT = createEmptyQuoteProductDraft()
const EMPTY_DRAFT_SNAPSHOT_KEY = createQuoteProductDraftSnapshot(EMPTY_DRAFT).key

const initialState: QuoteProductsControllerState = {
  activeFamily: QUOTE_PRODUCT_FAMILIES[0],
  statusFilter: 'all',
  search: '',
  debouncedSearch: '',
  editor: {
    mode: 'none',
    draft: EMPTY_DRAFT,
    cleanSnapshotKey: EMPTY_DRAFT_SNAPSHOT_KEY,
    dirty: false,
  },
  discard: {
    status: 'idle',
    transition: null,
  },
  deleteTarget: null,
  feedback: {
    saving: false,
    notice: null,
    actionError: null,
  },
}

function createEditorFromRow(row: QuoteProductRow): QuoteProductEditorState {
  const draft = quoteProductRowToDraft(row)
  return {
    mode: 'edit',
    targetId: row.id,
    targetRow: row,
    draft,
    cleanSnapshotKey: createQuoteProductDraftSnapshot(draft).key,
    dirty: false,
  }
}

function createCreateEditor(
  family: ProductFamily,
  returnSelectionId: string | null
): QuoteProductEditorState {
  const draft = {
    ...createEmptyQuoteProductDraft(),
    family,
  }
  return {
    mode: 'create',
    draft,
    cleanSnapshotKey: createQuoteProductDraftSnapshot(draft).key,
    dirty: false,
    returnSelectionId,
  }
}

function createEmptyEditor(): QuoteProductEditorState {
  return {
    mode: 'none',
    draft: createEmptyQuoteProductDraft(),
    cleanSnapshotKey: EMPTY_DRAFT_SNAPSHOT_KEY,
    dirty: false,
  }
}

function getSelectedId(editor: QuoteProductEditorState) {
  return editor.mode === 'edit' ? editor.targetId : null
}

function getSelectionVisibility(editor: QuoteProductEditorState, selected: QuoteProductRow | null) {
  if (editor.mode !== 'edit') return 'none' as const
  return selected ? ('visible' as const) : ('hidden' as const)
}

function hasUnsavedChanges(state: QuoteProductsControllerState) {
  return state.editor.dirty
}

function buildCurrentQuery(state: QuoteProductsControllerState): QuoteProductQuery {
  return {
    status: state.statusFilter,
    family: state.activeFamily,
    search: state.debouncedSearch || null,
  }
}

function applyTransitionToState(
  state: QuoteProductsControllerState,
  transition: QuoteProductsPendingTransition,
  products: QuoteProductRow[]
): QuoteProductsControllerState {
  switch (transition.type) {
    case 'setActiveFamily': {
      if (state.editor.mode === 'create') {
        const draft = {
          ...state.editor.draft,
          family: transition.nextFamily,
        }
        return {
          ...state,
          activeFamily: transition.nextFamily,
          deleteTarget: null,
          editor: {
            ...state.editor,
            draft,
            cleanSnapshotKey: createQuoteProductDraftSnapshot(draft).key,
          },
        }
      }

      return {
        ...state,
        activeFamily: transition.nextFamily,
        deleteTarget: null,
      }
    }
    case 'setSelectedId': {
      if (!transition.selectedId) {
        const fallback = products[0] ?? null
        return {
          ...state,
          deleteTarget: null,
          editor: fallback ? createEditorFromRow(fallback) : createEmptyEditor(),
        }
      }

      const nextRow = products.find((product) => product.id === transition.selectedId) ?? null
      if (!nextRow) return state

      return {
        ...state,
        deleteTarget: null,
        editor: createEditorFromRow(nextRow),
      }
    }
    case 'setStatusFilter':
      return {
        ...state,
        statusFilter: transition.status,
        deleteTarget: null,
        editor: state.editor.mode === 'create' ? createEmptyEditor() : state.editor,
      }
    case 'setSearch':
      return {
        ...state,
        search: transition.search,
        deleteTarget: null,
        editor: state.editor.mode === 'create' ? createEmptyEditor() : state.editor,
      }
    case 'startCreate':
      return {
        ...state,
        deleteTarget: null,
        feedback: {
          ...state.feedback,
          notice: null,
          actionError: null,
        },
        editor: createCreateEditor(state.activeFamily, getSelectedId(state.editor)),
      }
    default:
      return state
  }
}

function syncStateWithProducts(
  state: QuoteProductsControllerState,
  products: QuoteProductRow[]
): QuoteProductsControllerState {
  const editor = state.editor
  if (editor.mode === 'create') return state

  if (editor.mode === 'edit') {
    const currentVisibleRow = products.find((product) => product.id === editor.targetId) ?? null

    if (!currentVisibleRow) {
      return state
    }

    if (editor.dirty) {
      return state
    }

    const nextDraft = quoteProductRowToDraft(currentVisibleRow)
    const nextSnapshotKey = createQuoteProductDraftSnapshot(nextDraft).key

    if (
      editor.targetRow.updated_at === currentVisibleRow.updated_at &&
      editor.cleanSnapshotKey === nextSnapshotKey
    ) {
      return state
    }

    return {
      ...state,
      editor: {
        mode: 'edit',
        targetId: currentVisibleRow.id,
        targetRow: currentVisibleRow,
        draft: nextDraft,
        cleanSnapshotKey: nextSnapshotKey,
        dirty: false,
      },
    }
  }

  const fallback = products[0] ?? null
  if (!fallback) return state

  return {
    ...state,
    editor: createEditorFromRow(fallback),
  }
}

function quoteProductsReducer(
  state: QuoteProductsControllerState,
  action: QuoteProductsAction
): QuoteProductsControllerState {
  switch (action.type) {
    case 'setSearchInput':
      return {
        ...state,
        search: action.search,
      }
    case 'commitDebouncedSearch':
      return {
        ...state,
        debouncedSearch: action.search.trim(),
      }
    case 'updateDraft': {
      if (state.editor.mode === 'none') return state

      const nextSnapshotKey = createQuoteProductDraftSnapshot(action.draft).key
      return {
        ...state,
        editor: {
          ...state.editor,
          draft: action.draft,
          dirty: nextSnapshotKey !== state.editor.cleanSnapshotKey,
        },
      }
    }
    case 'setFeedback':
      return {
        ...state,
        feedback: {
          saving: action.saving ?? state.feedback.saving,
          notice:
            action.notice === undefined ? state.feedback.notice : action.notice,
          actionError:
            action.actionError === undefined ? state.feedback.actionError : action.actionError,
        },
      }
    case 'queueDiscard':
      if (state.discard.transition) return state
      return {
        ...state,
        discard: {
          status: 'confirming',
          transition: action.transition,
        },
      }
    case 'setDiscardStatus':
      return {
        ...state,
        discard: {
          ...state.discard,
          status: action.status,
        },
      }
    case 'clearDiscard':
      return {
        ...state,
        discard: {
          status: 'idle',
          transition: null,
        },
      }
    case 'setDeleteTarget':
      return {
        ...state,
        deleteTarget: action.target,
      }
    case 'applyTransition':
      return applyTransitionToState(state, action.transition, action.products)
    case 'cancelEdit': {
      if (state.editor.mode === 'create') {
        const createEditor = state.editor
        const restored =
          action.products.find((product) => product.id === createEditor.returnSelectionId) ??
          action.products[0] ??
          null
        return {
          ...state,
          deleteTarget: null,
          discard: {
            status: 'idle',
            transition: null,
          },
          feedback: {
            ...state.feedback,
            notice: null,
            actionError: null,
          },
          editor: restored ? createEditorFromRow(restored) : createEmptyEditor(),
        }
      }

      if (state.editor.mode === 'edit') {
        return {
          ...state,
          deleteTarget: null,
          discard: {
            status: 'idle',
            transition: null,
          },
          feedback: {
            ...state.feedback,
            notice: null,
            actionError: null,
          },
          editor: createEditorFromRow(state.editor.targetRow),
        }
      }

      return state
    }
    case 'syncProducts':
      return syncStateWithProducts(state, action.products)
    case 'saveSuccess': {
      return {
        ...state,
        activeFamily: normalizeQuoteProductFamily(action.row.family, state.activeFamily),
        statusFilter: state.editor.mode === 'create' ? 'all' : state.statusFilter,
        search: state.editor.mode === 'create' ? '' : state.search,
        debouncedSearch: state.editor.mode === 'create' ? '' : state.debouncedSearch,
        deleteTarget: null,
        feedback: {
          saving: false,
          notice: action.notice,
          actionError: null,
        },
        editor: createEditorFromRow(action.row),
      }
    }
    case 'deleteSuccess': {
      const shouldClearEditor =
        state.editor.mode === 'edit' && state.editor.targetId === action.deletedId
      const fallback = action.products[0] ?? null

      return {
        ...state,
        deleteTarget: null,
        feedback: {
          saving: false,
          notice: action.notice,
          actionError: null,
        },
        editor: shouldClearEditor
          ? fallback
            ? createEditorFromRow(fallback)
            : createEmptyEditor()
          : state.editor,
      }
    }
    default:
      return state
  }
}

export function useQuoteProductsPage(): QuoteProductsPageController {
  const [state, dispatch] = useReducer(quoteProductsReducer, initialState)
  const stateRef = useRef(state)

  function applyAction(action: QuoteProductsAction) {
    stateRef.current = quoteProductsReducer(stateRef.current, action)
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
  const resource = useQuoteProductsData({ query })

  useEffect(() => {
    applyAction({ type: 'syncProducts', products: resource.data })
  }, [resource.data])

  const selectedId = getSelectedId(state.editor)
  const selectedVisible = selectedId
    ? resource.data.find((product) => product.id === selectedId) ?? null
    : null
  const editorSelected = state.editor.mode === 'edit' ? state.editor.targetRow : null
  const selectionVisibility = getSelectionVisibility(state.editor, selectedVisible)
  const validationResult = validateQuoteProductDraft(state.editor.draft)
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
      (state.editor.mode === 'create' || state.editor.mode === 'edit'),
    canDelete:
      !state.feedback.saving &&
      !resource.error &&
      state.editor.mode === 'edit',
  })

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

    applyAction({ type: 'updateDraft', draft: validationResult.draft })
    if (!validationResult.ok) return false

    applyAction({
      type: 'setFeedback',
      saving: true,
      notice: null,
      actionError: null,
    })

    try {
      if (currentState.editor.mode === 'create') {
        const created = await createQuoteProduct<QuoteProductRow>(validationResult.payload)
        const postCreateQuery: QuoteProductQuery = {
          family: normalizeQuoteProductFamily(created.data.family, currentState.activeFamily),
          status: 'all',
          search: null,
        }

        resource.setData((existing) => [
          created.data,
          ...existing.filter(
            (product) =>
              product.id !== created.data.id && quoteProductMatchesQuery(product, postCreateQuery)
          ),
        ])

        applyAction({
          type: 'saveSuccess',
          row: created.data,
          notice: created.notice ?? 'Product created.',
        })
        return true
      }

      const editEditor = currentState.editor
      if (editEditor.mode !== 'edit') return false

      const updated = await updateQuoteProduct<QuoteProductRow>(editEditor.targetId, validationResult.payload)

      resource.setData((existing) =>
        upsertProductIntoVisibleSlice(
          existing,
          updated.data,
          buildCurrentQuery(currentState),
          editEditor.targetId
        )
      )

      applyAction({
        type: 'saveSuccess',
        row: updated.data,
        notice: updated.notice ?? 'Product saved.',
      })
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
      await deleteQuoteProduct(deleteTarget.id)
      const nextProducts = removeProductFromVisibleSlice(resource.data, deleteTarget.id)
      resource.setData(() => nextProducts)
      applyAction({
        type: 'deleteSuccess',
        deletedId: deleteTarget.id,
        notice: 'Product deleted.',
        products: nextProducts,
      })
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
    uiState,
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
      draft: state.editor.draft,
      selected: editorSelected,
      saving: state.feedback.saving,
      isCreating: state.editor.mode === 'create',
      isDirty: state.editor.dirty,
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
    actions,
    discardVm: {
      isOpen: state.discard.status === 'confirming' && Boolean(state.discard.transition),
      status: state.discard.status,
      transitionType: state.discard.transition?.type ?? null,
    },
    deleteVm: {
      isOpen: Boolean(state.deleteTarget),
      status:
        state.feedback.saving && state.deleteTarget
          ? 'deleting'
          : state.deleteTarget
            ? 'confirming'
            : 'idle',
      productName: state.deleteTarget?.name ?? null,
    },
  }
}
