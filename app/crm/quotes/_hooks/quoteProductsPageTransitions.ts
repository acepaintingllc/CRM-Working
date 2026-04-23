'use client'

import {
  normalizeQuoteProductFamily,
  quoteProductRowToDraft,
  type QuoteProductQuery,
  type QuoteProductRow,
} from '@/lib/quotes/productsForm'
import {
  createCreateEditor,
  createEditorFromRow,
  createEmptyEditor,
  getSelectedId,
  type QuoteProductsControllerState,
  type QuoteProductsPendingTransition,
} from './quoteProductsPageState'

export function hasUnsavedChanges(state: QuoteProductsControllerState) {
  return state.editor.dirty
}

export function buildCurrentQuery(state: QuoteProductsControllerState): QuoteProductQuery {
  return {
    status: state.statusFilter,
    family: state.activeFamily,
    search: state.debouncedSearch || null,
  }
}

export function getSelectionVisibility(
  state: QuoteProductsControllerState,
  selected: QuoteProductRow | null
) {
  if (state.editor.mode !== 'edit') return 'none' as const
  return selected ? ('visible' as const) : ('hidden' as const)
}

export function applyTransitionToState(
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
            cleanSnapshotKey: state.editor.dirty
              ? state.editor.cleanSnapshotKey
              : createCreateEditor(transition.nextFamily, state.editor.returnSelectionId).cleanSnapshotKey,
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

export function syncStateWithProducts(
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
    const nextSnapshotKey = createEditorFromRow(currentVisibleRow).cleanSnapshotKey

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

export function buildSaveSuccessState(
  state: QuoteProductsControllerState,
  row: QuoteProductRow | null,
  notice: string | null,
  products: QuoteProductRow[] = []
): QuoteProductsControllerState {
  const fallback = products[0] ?? null
  return {
    ...state,
    activeFamily: normalizeQuoteProductFamily(row?.family ?? state.activeFamily, state.activeFamily),
    statusFilter: state.editor.mode === 'create' ? 'all' : state.statusFilter,
    search: state.editor.mode === 'create' ? '' : state.search,
    debouncedSearch: state.editor.mode === 'create' ? '' : state.debouncedSearch,
    deleteTarget: null,
    feedback: {
      saving: false,
      notice,
      actionError: null,
    },
    editor: row ? createEditorFromRow(row) : fallback ? createEditorFromRow(fallback) : createEmptyEditor(),
  }
}
