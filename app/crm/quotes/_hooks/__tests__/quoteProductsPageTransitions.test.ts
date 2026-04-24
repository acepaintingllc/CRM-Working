import { describe, expect, it } from 'vitest'
import type { QuoteProductRow } from '@/lib/quotes/productsForm'
import {
  mergeKnownQuoteProducts,
  upsertProductIntoVisibleSlice,
} from '../quoteProductsControllerUtils'
import {
  buildQuoteProductsIntentState,
  buildQuoteProductsQuery,
  buildQuoteProductsSavedState,
  createInitialQuoteProductsWorkflowState,
  createQuoteProductsCreateDraft,
  createQuoteProductsDraftFromRow,
  reconcileQuoteProductsStateFromResource,
} from '../quoteProductsPageState'

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
      buildQuoteProductsQuery({
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
    const createDraft = createQuoteProductsCreateDraft('Paint')
    const nextState = buildQuoteProductsIntentState(
      {
        ...createInitialQuoteProductsWorkflowState(),
        selectedId: 'product-2',
        editorMode: 'create',
        draft: createDraft.draft,
        cleanSnapshot: createDraft.cleanSnapshot,
        returnSelectionId: 'product-2',
      },
      { type: 'setActiveFamily', nextFamily: 'Primer' }
    )

    expect(nextState.navigation.activeFamily).toBe('Primer')
    expect(nextState.editorMode).toBe('create')
    expect(nextState.draft.family).toBe('Primer')
    expect(nextState.returnSelectionId).toBe('product-2')
  })

  it('never rehydrates a dirty selected editor from refreshed resource rows', () => {
    const row = buildProduct()
    const draftState = createQuoteProductsDraftFromRow(row)
    const dirtyState = {
      ...createInitialQuoteProductsWorkflowState(),
      selectedId: row.id,
      editorMode: 'edit' as const,
      draft: {
        ...draftState.draft,
        name: 'Local draft',
      },
      cleanSnapshot: draftState.cleanSnapshot,
    }

    const nextState = reconcileQuoteProductsStateFromResource(dirtyState, {
      visibleRows: [
        buildProduct({
          id: 'product-1',
          name: 'Server rename',
          updated_at: '2026-01-05T00:00:00.000Z',
        }),
      ],
      knownRows: [
        buildProduct({
          id: 'product-1',
          name: 'Server rename',
          updated_at: '2026-01-05T00:00:00.000Z',
        }),
      ],
    })

    expect(nextState).toBeNull()
    expect(dirtyState.draft.name).toBe('Local draft')
  })

  it('preserves the explicit hidden selection after a save moves the row out of the filtered slice', () => {
    const selected = buildProduct({
      id: 'paint-2',
      name: 'Dormant Paint',
      status: 'Inactive',
    })
    const nextKnownRows = mergeKnownQuoteProducts([], [selected])
    const nextVisibleRows = upsertProductIntoVisibleSlice(
      [selected],
      buildProduct({
        id: 'paint-2',
        name: 'Dormant Paint',
        status: 'Archived',
      }),
      { family: 'Paint', status: 'inactive', search: null },
      'paint-2'
    )

    expect(nextKnownRows[0]?.id).toBe('paint-2')
    expect(nextVisibleRows).toEqual([])

    const nextState = buildQuoteProductsSavedState({
      state: {
        ...createInitialQuoteProductsWorkflowState(),
        navigation: {
          activeFamily: 'Paint',
          statusFilter: 'inactive',
          search: '',
          debouncedSearch: '',
        },
        selectedId: 'paint-2',
        editorMode: 'edit',
        draft: createQuoteProductsDraftFromRow(selected).draft,
        cleanSnapshot: createQuoteProductsDraftFromRow(selected).cleanSnapshot,
      },
      row: buildProduct({
        id: 'paint-2',
        name: 'Dormant Paint',
        status: 'Archived',
      }),
      notice: 'Product saved.',
    })

    expect(nextState.navigation.statusFilter).toBe('inactive')
    expect(nextState.editorMode).toBe('edit')
    expect(nextState.selectedId).toBe('paint-2')
    expect(nextState.draft.status).toBe('Archived')
    expect(nextState.notice).toBe('Product saved.')
  })
})
