'use client'

import { createQuoteProductDraftSnapshot } from '@/lib/quotes/productsForm'
import {
  createEditorFromRow,
  createEmptyEditor,
  type QuoteProductsControllerAction,
  type QuoteProductsControllerState,
} from './quoteProductsPageState'
import {
  applyTransitionToState,
  buildSaveSuccessState,
  syncStateWithProducts,
} from './quoteProductsPageTransitions'

export function quoteProductsPageReducer(
  state: QuoteProductsControllerState,
  action: QuoteProductsControllerAction
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
          notice: action.notice === undefined ? state.feedback.notice : action.notice,
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
    case 'saveSuccess':
      return buildSaveSuccessState(state, action.row, action.notice, action.products)
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
