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
import { chooseQuoteProductsFallbackId, findQuoteProductById } from './quoteProductsControllerUtils'

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

export type QuoteProductsWorkflowAction =
  | { type: 'setSearchInput'; search: string }
  | { type: 'commitSearch'; search: string }
  | { type: 'setDraft'; draft: QuoteProductDraft }
  | { type: 'beginAction'; status: 'saving' | 'deleting' }
  | { type: 'finishAction' }
  | { type: 'setNotice'; notice: string | null }
  | { type: 'setActionError'; error: string | null }
  | { type: 'clearFeedback' }
  | { type: 'openDiscard'; transition: QuoteProductsPendingTransition }
  | { type: 'setDiscardStatus'; status: 'idle' | 'confirming' | 'applying' }
  | { type: 'clearDiscard' }
  | { type: 'setDeleteTargetId'; id: string | null }
  | { type: 'applyIntent'; intent: QuoteProductsPendingTransition }
  | { type: 'cancelEdit'; selectedId: string | null }
  | {
      type: 'reconcileFromResource'
      selectedId: string | null
      draft: QuoteProductDraft
      cleanSnapshot: QuoteProductDraftSnapshot
      editorMode: 'none' | 'edit'
    }
  | {
      type: 'commitSave'
      row: QuoteProductRow
      notice: string | null
      navigation: QuoteProductsWorkflowState['navigation']
    }
  | {
      type: 'commitDelete'
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

export function getQuoteProductsHasUnsavedChanges(state: QuoteProductsWorkflowState) {
  return (
    state.editorMode !== 'none' &&
    !areQuoteProductDraftSnapshotsEqual(
      createQuoteProductDraftSnapshot(state.draft),
      state.cleanSnapshot
    )
  )
}

export function buildQuoteProductsSelection(params: {
  visibleRows: QuoteProductRow[]
  knownRows: QuoteProductRow[]
  selectedId: string | null
}) {
  const selected =
    findQuoteProductById(params.knownRows, params.selectedId) ??
    findQuoteProductById(params.visibleRows, params.selectedId)
  const nextSelectedId = selected?.id ?? chooseQuoteProductsFallbackId(params.visibleRows)
  const nextSelected =
    selected ??
    findQuoteProductById(params.knownRows, nextSelectedId) ??
    findQuoteProductById(params.visibleRows, nextSelectedId)

  return {
    selectedId: nextSelectedId,
    selected: nextSelected,
  }
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
      type: 'reconcileFromResource' as const,
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
    type: 'reconcileFromResource' as const,
    selectedId: selection.selectedId,
    editorMode: 'edit' as const,
    draft: nextDraftState.draft,
    cleanSnapshot: nextDraftState.cleanSnapshot,
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
      const createDraft = createQuoteProductsCreateDraft(state.navigation.activeFamily)
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
    selectedId: shouldResetEditor ? params.nextSelectedId : params.state.selectedId,
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
