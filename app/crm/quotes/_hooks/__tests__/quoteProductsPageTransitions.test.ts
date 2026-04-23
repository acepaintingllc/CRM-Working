import { describe, expect, it } from 'vitest'
import type { QuoteProductRow } from '@/lib/quotes/productsForm'
import {
  applyTransitionToState,
  buildCurrentQuery,
  buildSaveSuccessState,
  syncStateWithProducts,
} from '../quoteProductsPageTransitions'
import { createCreateEditor, createEditorFromRow, initialQuoteProductsPageState } from '../quoteProductsPageState'
import type { QuoteProductEditorState } from '../quoteProductsPageState'

function buildProduct(overrides: Partial<QuoteProductRow> = {}): QuoteProductRow {
  return {
    id: 'product-1',
    name: 'Super Paint',
    family: 'Paint',
    base: 'A',
    subtype: 'Interior',
    cost_per_unit: 30,
    coverage_sqft_per_gal_per_coat: 350,
    efficiency_pct: 90,
    default_coats: 2,
    default_sheen: 'Eggshell',
    default_scopes: ['Walls'],
    notes: '',
    status: 'Active',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('quoteProductsPageTransitions invariants', () => {
  it('builds the resource query from debounced search only', () => {
    expect(
      buildCurrentQuery({
        ...initialQuoteProductsPageState,
        activeFamily: 'Primer',
        statusFilter: 'inactive',
        search: 'raw input',
        debouncedSearch: 'committed',
      })
    ).toEqual({
      family: 'Primer',
      status: 'inactive',
      search: 'committed',
    })
  })

  it('keeps a clean create editor aligned to the next family transition', () => {
    const createEditor = createCreateEditor('Paint', 'product-2')
    const nextState = applyTransitionToState(
      {
        ...initialQuoteProductsPageState,
        editor: createEditor,
      },
      { type: 'setActiveFamily', nextFamily: 'Primer' },
      []
    )

    expect(nextState.activeFamily).toBe('Primer')
    expect(nextState.editor.mode).toBe('create')
    if (nextState.editor.mode !== 'create') throw new Error('Expected create editor')
    expect(nextState.editor.draft.family).toBe('Primer')
    expect(nextState.editor.dirty).toBe(false)
    expect(nextState.editor.returnSelectionId).toBe('product-2')
  })

  it('never rehydrates a dirty selected editor from refreshed resource rows', () => {
    const row = buildProduct()
    const editor = createEditorFromRow(row)
    const dirtyEditor: Extract<QuoteProductEditorState, { mode: 'edit' }> = {
      mode: 'edit',
      targetId: row.id,
      targetRow: row,
      dirty: true,
      cleanSnapshotKey: editor.cleanSnapshotKey,
      draft: {
        ...editor.draft,
        name: 'Local draft',
      },
    }
    const dirtyState = {
      ...initialQuoteProductsPageState,
      editor: dirtyEditor,
    }

    const nextState = syncStateWithProducts(dirtyState, [
      buildProduct({
        id: 'product-1',
        name: 'Server rename',
        updated_at: '2026-01-05T00:00:00.000Z',
      }),
    ])

    expect(nextState.editor).toBe(dirtyState.editor)
    if (nextState.editor.mode !== 'edit') throw new Error('Expected edit editor')
    expect(nextState.editor.draft.name).toBe('Local draft')
  })

  it('preserves the explicit hidden selection after a save moves the row out of the filtered slice', () => {
    const selected = buildProduct({
      id: 'paint-2',
      name: 'Dormant Paint',
      status: 'Inactive',
    })
    const state = {
      ...initialQuoteProductsPageState,
      statusFilter: 'inactive' as const,
      editor: createEditorFromRow(selected),
    }

    const nextState = buildSaveSuccessState(
      state,
      buildProduct({
        id: 'paint-2',
        name: 'Dormant Paint',
        status: 'Archived',
      }),
      'Product saved.'
    )

    expect(nextState.statusFilter).toBe('inactive')
    expect(nextState.editor.mode).toBe('edit')
    if (nextState.editor.mode !== 'edit') throw new Error('Expected edit editor')
    expect(nextState.editor.targetId).toBe('paint-2')
    expect(nextState.editor.draft.status).toBe('Archived')
    expect(nextState.feedback.notice).toBe('Product saved.')
  })
})
