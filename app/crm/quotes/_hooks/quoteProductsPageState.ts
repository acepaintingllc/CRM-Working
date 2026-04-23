'use client'

import {
  QUOTE_PRODUCT_FAMILIES,
  createEmptyQuoteProductDraft,
  createQuoteProductDraftSnapshot,
  quoteProductRowToDraft,
  type ProductFamily,
  type QuoteProductDraft,
  type QuoteProductRow,
  type QuoteProductStatusFilter,
} from '@/lib/quotes/productsForm'

export type QuoteProductsPendingTransition =
  | { type: 'setSelectedId'; selectedId: string | null }
  | { type: 'setActiveFamily'; nextFamily: ProductFamily }
  | { type: 'setStatusFilter'; status: QuoteProductStatusFilter }
  | { type: 'setSearch'; search: string }
  | { type: 'startCreate' }

export type QuoteProductEditorState =
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

export type QuoteProductsControllerState = {
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

export type QuoteProductsControllerAction =
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

const EMPTY_DRAFT = createEmptyQuoteProductDraft()
const EMPTY_DRAFT_SNAPSHOT_KEY = createQuoteProductDraftSnapshot(EMPTY_DRAFT).key

export const initialQuoteProductsPageState: QuoteProductsControllerState = {
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

export function createEditorFromRow(row: QuoteProductRow): QuoteProductEditorState {
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

export function createCreateEditor(
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

export function createEmptyEditor(): QuoteProductEditorState {
  return {
    mode: 'none',
    draft: createEmptyQuoteProductDraft(),
    cleanSnapshotKey: EMPTY_DRAFT_SNAPSHOT_KEY,
    dirty: false,
  }
}

export function getSelectedId(editor: QuoteProductEditorState) {
  return editor.mode === 'edit' ? editor.targetId : null
}
