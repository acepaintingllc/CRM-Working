'use client'

import {
  QUOTE_PRODUCT_FAMILIES,
  areQuoteProductDraftSnapshotsEqual,
  createEmptyQuoteProductDraft,
  createQuoteProductDraftSnapshot,
  normalizeQuoteProductFamily,
  quoteProductRowToDraft,
  type ProductFamily,
  type QuoteProductDraft,
  type QuoteProductDraftSnapshot,
  type QuoteProductQuery,
  type QuoteProductRow,
  type QuoteProductStatusFilter,
} from '@/lib/quotes/productsForm'
import {
  chooseQuoteProductsFallbackId,
  findQuoteProductById,
} from './quoteProductsControllerUtils'

export type QuoteProductsPendingTransition =
  | { type: 'setSelectedId'; selectedId: string | null }
  | { type: 'setActiveFamily'; nextFamily: ProductFamily }
  | { type: 'setStatusFilter'; status: QuoteProductStatusFilter }
  | { type: 'setSearch'; search: string }
  | { type: 'startCreate' }

export type QuoteProductsWorkflowState = {
  navigation: {
    activeFamily: ProductFamily
    statusFilter: QuoteProductStatusFilter
    search: string
    debouncedSearch: string
  }
  selectedId: string | null
  editorMode: 'none' | 'edit' | 'create'
  draft: QuoteProductDraft
  cleanSnapshot: QuoteProductDraftSnapshot
  returnSelectionId: string | null
  discardStatus: 'idle' | 'confirming' | 'applying'
  pendingTransition: QuoteProductsPendingTransition | null
  deleteTargetId: string | null
  actionStatus: 'idle' | 'saving' | 'deleting'
  notice: string | null
  actionError: string | null
}

export type QuoteProductsResourceSnapshot = {
  visibleRows: QuoteProductRow[]
  knownRows: QuoteProductRow[]
}

export type QuoteProductsActionStatus = 'idle' | 'saving' | 'deleting'
export type QuoteProductsDiscardStatus = 'idle' | 'confirming' | 'applying'

export type QuoteProductsWorkflowAction =
  | { type: 'searchChanged'; search: string; committed?: boolean }
  | { type: 'draftChanged'; draft: QuoteProductDraft }
  | {
      type: 'mutationChanged'
      status: QuoteProductsActionStatus
      error?: string | null
    }
  | { type: 'feedbackChanged'; notice: string | null; error?: string | null }
  | {
      type: 'discardChanged'
      status: QuoteProductsDiscardStatus
      transition?: QuoteProductsPendingTransition | null
    }
  | { type: 'deleteTargetChanged'; id: string | null }
  | { type: 'intentApplied'; intent: QuoteProductsPendingTransition }
  | { type: 'editCanceled'; selectedId: string | null }
  | {
      type: 'resourceReconciled'
      selectedId: string | null
      draft: QuoteProductDraft
      cleanSnapshot: QuoteProductDraftSnapshot
      editorMode: 'none' | 'edit'
    }
  | {
      type: 'saveCommitted'
      row: QuoteProductRow
      notice: string | null
      navigation: QuoteProductsWorkflowState['navigation']
    }
  | {
      type: 'deleteCommitted'
      deletedId: string
      notice: string | null
      nextSelectedId: string | null
    }

const EMPTY_DRAFT = createEmptyQuoteProductDraft()
const EMPTY_DRAFT_SNAPSHOT = createQuoteProductDraftSnapshot(EMPTY_DRAFT)

export function createInitialQuoteProductsWorkflowState(): QuoteProductsWorkflowState {
  return {
    navigation: {
      activeFamily: QUOTE_PRODUCT_FAMILIES[0],
      statusFilter: 'all',
      search: '',
      debouncedSearch: '',
    },
    selectedId: null,
    editorMode: 'none',
    draft: EMPTY_DRAFT,
    cleanSnapshot: EMPTY_DRAFT_SNAPSHOT,
    returnSelectionId: null,
    discardStatus: 'idle',
    pendingTransition: null,
    deleteTargetId: null,
    actionStatus: 'idle',
    notice: null,
    actionError: null,
  }
}

export function buildQuoteProductsQuery(
  navigation: QuoteProductsWorkflowState['navigation']
): QuoteProductQuery {
  return {
    family: navigation.activeFamily,
    status: navigation.statusFilter,
    search: navigation.debouncedSearch || null,
  }
}

export function buildQuoteProductsResourceSyncAction(
  state: QuoteProductsWorkflowState,
  resource: QuoteProductsResourceSnapshot
) {
  return reconcileQuoteProductsStateFromResource(state, resource)
}

export function getQuoteProductsSelectedRow(
  rows: QuoteProductRow[],
  selectedId: string | null
): QuoteProductRow | null {
  return findQuoteProductById(rows, selectedId)
}

export function createQuoteProductsDraftFromRow(row: QuoteProductRow) {
  const draft = quoteProductRowToDraft(row)
  return {
    draft,
    cleanSnapshot: createQuoteProductDraftSnapshot(draft),
  }
}

export function createQuoteProductsCreateDraft(family: ProductFamily) {
  const draft = {
    ...createEmptyQuoteProductDraft(),
    family,
  }

  return {
    draft,
    cleanSnapshot: createQuoteProductDraftSnapshot(draft),
  }
}

export function getQuoteProductsHasUnsavedChanges(
  state: QuoteProductsWorkflowState
) {
  return (
    state.editorMode !== 'none' &&
    !areQuoteProductDraftSnapshotsEqual(
      createQuoteProductDraftSnapshot(state.draft),
      state.cleanSnapshot
    )
  )
}

export function buildQuoteProductsDraftFieldAction<
  K extends keyof QuoteProductDraft,
>(
  state: QuoteProductsWorkflowState,
  field: K,
  value: QuoteProductDraft[K]
): QuoteProductsWorkflowAction | null {
  if (state.editorMode === 'none') return null

  return {
    type: 'draftChanged',
    draft: {
      ...state.draft,
      [field]: value,
    },
  }
}

export function buildQuoteProductsSelection(params: {
  visibleRows: QuoteProductRow[]
  knownRows: QuoteProductRow[]
  selectedId: string | null
}) {
  const selected =
    findQuoteProductById(params.knownRows, params.selectedId) ??
    findQuoteProductById(params.visibleRows, params.selectedId)
  const nextSelectedId =
    selected?.id ?? chooseQuoteProductsFallbackId(params.visibleRows)
  const nextSelected =
    selected ??
    findQuoteProductById(params.knownRows, nextSelectedId) ??
    findQuoteProductById(params.visibleRows, nextSelectedId)

  return {
    selectedId: nextSelectedId,
    selected: nextSelected,
  }
}

export function buildQuoteProductsRestoreEditorActions(params: {
  state: QuoteProductsWorkflowState
  resource: QuoteProductsResourceSnapshot
}): QuoteProductsWorkflowAction[] {
  const selectedId =
    params.state.editorMode === 'create'
      ? params.state.returnSelectionId
      : params.state.selectedId
  const actions: QuoteProductsWorkflowAction[] = [
    {
      type: 'editCanceled',
      selectedId,
    },
  ]

  const selection = buildQuoteProductsSelection({
    visibleRows: params.resource.visibleRows,
    knownRows: params.resource.knownRows,
    selectedId,
  })

  if (!selection.selected) {
    return actions
  }

  const restored = createQuoteProductsDraftFromRow(selection.selected)
  actions.push({
    type: 'resourceReconciled',
    selectedId: selection.selected.id,
    editorMode: 'edit',
    draft: restored.draft,
    cleanSnapshot: restored.cleanSnapshot,
  })

  return actions
}

export function reconcileQuoteProductsStateFromResource(
  state: QuoteProductsWorkflowState,
  resource: QuoteProductsResourceSnapshot
) {
  if (state.editorMode === 'create') return null
  if (getQuoteProductsHasUnsavedChanges(state)) return null

  const selection = buildQuoteProductsSelection({
    visibleRows: resource.visibleRows,
    knownRows: resource.knownRows,
    selectedId: state.selectedId,
  })

  if (!selection.selected) {
    if (state.selectedId === null && state.editorMode === 'none') return null
    return {
      type: 'resourceReconciled' as const,
      selectedId: null,
      editorMode: 'none' as const,
      draft: createEmptyQuoteProductDraft(),
      cleanSnapshot: EMPTY_DRAFT_SNAPSHOT,
    }
  }

  const nextDraftState = createQuoteProductsDraftFromRow(selection.selected)
  const selectionChanged = selection.selectedId !== state.selectedId
  const modeChanged = state.editorMode !== 'edit'
  const draftChanged = !areQuoteProductDraftSnapshotsEqual(
    nextDraftState.cleanSnapshot,
    state.cleanSnapshot
  )

  if (!selectionChanged && !modeChanged && !draftChanged) return null

  return {
    type: 'resourceReconciled' as const,
    selectedId: selection.selectedId,
    editorMode: 'edit' as const,
    draft: nextDraftState.draft,
    cleanSnapshot: nextDraftState.cleanSnapshot,
  }
}

export function getQuoteProductsIntentChanged(
  state: QuoteProductsWorkflowState,
  intent: QuoteProductsPendingTransition
) {
  switch (intent.type) {
    case 'setActiveFamily':
      return intent.nextFamily !== state.navigation.activeFamily
    case 'setStatusFilter':
      return intent.status !== state.navigation.statusFilter
    case 'setSearch':
      return intent.search !== state.navigation.search
    case 'setSelectedId':
      return intent.selectedId !== state.selectedId
    case 'startCreate':
      return state.editorMode !== 'create'
    default:
      return false
  }
}

export function getQuoteProductsDiscardRestorePolicy(
  state: QuoteProductsWorkflowState,
  intent: QuoteProductsPendingTransition
) {
  return {
    shouldRestoreDraft:
      intent.type === 'setSelectedId' ||
      intent.type === 'startCreate' ||
      (state.editorMode === 'create' && intent.type !== 'setActiveFamily'),
    shouldApplySearchInput: intent.type === 'setSearch',
  }
}

export function buildQuoteProductsIntentState(
  state: QuoteProductsWorkflowState,
  intent: QuoteProductsPendingTransition
): QuoteProductsWorkflowState {
  switch (intent.type) {
    case 'setActiveFamily': {
      if (state.editorMode === 'create') {
        const nextDraft = {
          ...state.draft,
          family: intent.nextFamily,
        }
        return {
          ...state,
          navigation: {
            ...state.navigation,
            activeFamily: intent.nextFamily,
          },
          draft: nextDraft,
          cleanSnapshot: getQuoteProductsHasUnsavedChanges(state)
            ? state.cleanSnapshot
            : createQuoteProductsCreateDraft(intent.nextFamily).cleanSnapshot,
          deleteTargetId: null,
        }
      }

      return {
        ...state,
        navigation: {
          ...state.navigation,
          activeFamily: intent.nextFamily,
        },
        deleteTargetId: null,
      }
    }
    case 'setStatusFilter':
      return {
        ...state,
        navigation: {
          ...state.navigation,
          statusFilter: intent.status,
        },
        editorMode: state.editorMode === 'create' ? 'none' : state.editorMode,
        deleteTargetId: null,
      }
    case 'setSearch':
      return {
        ...state,
        navigation: {
          ...state.navigation,
          search: intent.search,
          debouncedSearch: intent.search.trim(),
        },
        editorMode: state.editorMode === 'create' ? 'none' : state.editorMode,
        deleteTargetId: null,
      }
    case 'setSelectedId':
      return {
        ...state,
        selectedId: intent.selectedId,
        editorMode: intent.selectedId ? 'edit' : 'none',
        deleteTargetId: null,
      }
    case 'startCreate': {
      const createDraft = createQuoteProductsCreateDraft(
        state.navigation.activeFamily
      )
      return {
        ...state,
        editorMode: 'create',
        draft: createDraft.draft,
        cleanSnapshot: createDraft.cleanSnapshot,
        returnSelectionId: state.selectedId,
        deleteTargetId: null,
        notice: null,
        actionError: null,
      }
    }
    default:
      return state
  }
}

export function quoteProductsPageReducer(
  state: QuoteProductsWorkflowState,
  action: QuoteProductsWorkflowAction
): QuoteProductsWorkflowState {
  switch (action.type) {
    case 'searchChanged':
      return {
        ...state,
        navigation: {
          ...state.navigation,
          search: action.committed ? state.navigation.search : action.search,
          debouncedSearch: action.committed
            ? action.search.trim()
            : state.navigation.debouncedSearch,
        },
      }
    case 'draftChanged':
      return {
        ...state,
        draft: action.draft,
      }
    case 'mutationChanged':
      return {
        ...state,
        actionStatus: action.status,
        notice:
          action.status === 'idle'
            ? action.error
              ? null
              : state.notice
            : null,
        actionError: action.status === 'idle' ? (action.error ?? null) : null,
      }
    case 'feedbackChanged':
      return {
        ...state,
        notice: action.notice,
        actionError: action.error ?? null,
      }
    case 'discardChanged':
      if (action.status === 'confirming') {
        if (state.pendingTransition) return state
        return {
          ...state,
          discardStatus: action.status,
          pendingTransition: action.transition ?? null,
        }
      }
      return {
        ...state,
        discardStatus: action.status,
        pendingTransition:
          action.status === 'idle'
            ? null
            : (action.transition ?? state.pendingTransition),
      }
    case 'deleteTargetChanged':
      return {
        ...state,
        deleteTargetId: action.id,
      }
    case 'intentApplied':
      return buildQuoteProductsIntentState(state, action.intent)
    case 'editCanceled':
      return {
        ...state,
        selectedId: action.selectedId,
        editorMode: action.selectedId ? 'edit' : 'none',
        deleteTargetId: null,
        discardStatus: 'idle',
        pendingTransition: null,
        notice: null,
        actionError: null,
      }
    case 'resourceReconciled':
      return {
        ...state,
        selectedId: action.selectedId,
        editorMode: action.editorMode,
        draft: action.draft,
        cleanSnapshot: action.cleanSnapshot,
        deleteTargetId:
          state.deleteTargetId === action.selectedId
            ? state.deleteTargetId
            : null,
      }
    case 'saveCommitted':
      return buildQuoteProductsSavedState({
        state: {
          ...state,
          navigation: action.navigation,
        },
        row: action.row,
        notice: action.notice,
      })
    case 'deleteCommitted':
      return buildQuoteProductsDeletedState({
        state,
        deletedId: action.deletedId,
        notice: action.notice,
        nextSelectedId: action.nextSelectedId,
      })
    default:
      return state
  }
}

export function buildQuoteProductsSavedState(params: {
  state: QuoteProductsWorkflowState
  row: QuoteProductRow
  notice: string | null
}) {
  const draftState = createQuoteProductsDraftFromRow(params.row)
  const nextFamily = normalizeQuoteProductFamily(
    params.row.family,
    params.state.navigation.activeFamily
  )
  const resetNavigation =
    params.state.editorMode === 'create'
      ? {
          activeFamily: nextFamily,
          statusFilter: 'all' as const,
          search: '',
          debouncedSearch: '',
        }
      : {
          ...params.state.navigation,
          activeFamily: nextFamily,
        }

  return {
    ...params.state,
    navigation: resetNavigation,
    selectedId: params.row.id,
    editorMode: 'edit' as const,
    draft: draftState.draft,
    cleanSnapshot: draftState.cleanSnapshot,
    returnSelectionId: null,
    deleteTargetId: null,
    actionStatus: 'idle' as const,
    notice: params.notice,
    actionError: null,
  }
}

export function buildQuoteProductsDeletedState(params: {
  state: QuoteProductsWorkflowState
  deletedId: string
  notice: string | null
  nextSelectedId: string | null
}) {
  const shouldResetEditor = params.state.selectedId === params.deletedId
  return {
    ...params.state,
    selectedId: shouldResetEditor
      ? params.nextSelectedId
      : params.state.selectedId,
    editorMode:
      shouldResetEditor && !params.nextSelectedId
        ? ('none' as const)
        : shouldResetEditor
          ? ('edit' as const)
          : params.state.editorMode,
    deleteTargetId: null,
    actionStatus: 'idle' as const,
    notice: params.notice,
    actionError: null,
  }
}
