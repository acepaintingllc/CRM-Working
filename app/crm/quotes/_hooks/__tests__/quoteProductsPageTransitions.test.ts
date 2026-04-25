import { describe, expect, it } from 'vitest'
import type { QuoteProductRow } from '@/lib/quotes/productsForm'
import {
  buildArchivedQuoteProductResourcePatch,
  buildCreatedQuoteProductResourcePatch,
  buildUpdatedQuoteProductResourcePatch,
  chooseQuoteProductsFallbackId,
  findQuoteProductById,
  mergeKnownQuoteProducts,
  removeProductFromVisibleSlice,
  upsertProductIntoVisibleSlice,
} from '../quoteProductsControllerUtils'
import {
  buildQuoteProductsIntentState,
  buildQuoteProductsQuery,
  buildQuoteProductsRestoreEditorActions,
  buildQuoteProductsSavedState,
  createInitialQuoteProductsWorkflowState,
  createQuoteProductsCreateDraft,
  createQuoteProductsDraftFromRow,
  getQuoteProductsDiscardRestorePolicy,
  getQuoteProductsIntentChanged,
  quoteProductsPageReducer,
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

  it('reduces raw and committed search state independently', () => {
    const searchedState = quoteProductsPageReducer(createInitialQuoteProductsWorkflowState(), {
      type: 'searchChanged',
      search: '  trim later  ',
    })

    expect(searchedState.navigation.search).toBe('  trim later  ')
    expect(searchedState.navigation.debouncedSearch).toBe('')

    const committedState = quoteProductsPageReducer(searchedState, {
      type: 'searchChanged',
      search: searchedState.navigation.search,
      committed: true,
    })

    expect(committedState.navigation.search).toBe('  trim later  ')
    expect(committedState.navigation.debouncedSearch).toBe('trim later')
  })

  it('keeps the first pending discard transition in the products reducer', () => {
    const firstQueuedState = quoteProductsPageReducer(createInitialQuoteProductsWorkflowState(), {
      type: 'discardChanged',
      status: 'confirming',
      transition: { type: 'setStatusFilter', status: 'inactive' },
    })

    const secondQueuedState = quoteProductsPageReducer(firstQueuedState, {
      type: 'discardChanged',
      status: 'confirming',
      transition: { type: 'setSearch', search: 'primer' },
    })

    expect(secondQueuedState).toBe(firstQueuedState)
    expect(secondQueuedState.discardStatus).toBe('confirming')
    expect(secondQueuedState.pendingTransition).toEqual({
      type: 'setStatusFilter',
      status: 'inactive',
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

  it('computes product intent changed status without controller state branches', () => {
    const state = createInitialQuoteProductsWorkflowState()

    expect(
      getQuoteProductsIntentChanged(state, {
        type: 'setActiveFamily',
        nextFamily: 'Paint',
      })
    ).toBe(false)
    expect(
      getQuoteProductsIntentChanged(state, {
        type: 'setStatusFilter',
        status: 'inactive',
      })
    ).toBe(true)
    expect(
      getQuoteProductsIntentChanged(
        {
          ...state,
          selectedId: 'product-1',
        },
        {
          type: 'setSelectedId',
          selectedId: 'product-1',
        }
      )
    ).toBe(false)
  })

  it('computes discard restore policy for product transitions', () => {
    const editState = {
      ...createInitialQuoteProductsWorkflowState(),
      selectedId: 'product-1',
      editorMode: 'edit' as const,
    }
    const createState = {
      ...createInitialQuoteProductsWorkflowState(),
      editorMode: 'create' as const,
      returnSelectionId: 'product-1',
    }

    expect(
      getQuoteProductsDiscardRestorePolicy(editState, {
        type: 'setSelectedId',
        selectedId: 'product-2',
      })
    ).toEqual({
      shouldRestoreDraft: true,
      shouldApplySearchInput: false,
    })
    expect(
      getQuoteProductsDiscardRestorePolicy(createState, {
        type: 'setSearch',
        search: 'primer',
      })
    ).toEqual({
      shouldRestoreDraft: true,
      shouldApplySearchInput: true,
    })
    expect(
      getQuoteProductsDiscardRestorePolicy(createState, {
        type: 'setActiveFamily',
        nextFamily: 'Primer',
      })
    ).toEqual({
      shouldRestoreDraft: false,
      shouldApplySearchInput: false,
    })
  })

  it('builds restore editor actions from known hidden selected rows', () => {
    const hiddenSelected = buildProduct({
      id: 'paint-2',
      name: 'Dormant Paint',
      status: 'Inactive',
    })
    const actions = buildQuoteProductsRestoreEditorActions({
      state: {
        ...createInitialQuoteProductsWorkflowState(),
        selectedId: 'paint-2',
        editorMode: 'edit',
        draft: {
          ...createQuoteProductsDraftFromRow(hiddenSelected).draft,
          name: 'Unsaved local edit',
        },
      },
      resource: {
        visibleRows: [buildProduct({ id: 'paint-1', name: 'Visible Paint' })],
        knownRows: [hiddenSelected],
      },
    })

    expect(actions).toEqual([
      {
        type: 'editCanceled',
        selectedId: 'paint-2',
      },
      expect.objectContaining({
        type: 'resourceReconciled',
        selectedId: 'paint-2',
        editorMode: 'edit',
        draft: expect.objectContaining({
          name: 'Dormant Paint',
        }),
      }),
    ])
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

  it('builds a create resource patch that resets filters and keeps matching known rows visible', () => {
    const existingActive = buildProduct({ id: 'paint-1', name: 'Existing Paint' })
    const existingInactive = buildProduct({
      id: 'paint-2',
      name: 'Dormant Paint',
      status: 'Inactive',
    })
    const created = buildProduct({ id: 'paint-3', name: 'Fresh Paint' })

    const patch = buildCreatedQuoteProductResourcePatch({
      knownRows: [existingActive, existingInactive],
      createdRow: created,
      navigation: {
        activeFamily: 'Paint',
        statusFilter: 'inactive',
        search: 'dormant',
        debouncedSearch: 'dormant',
      },
    })

    expect(patch.navigation).toEqual({
      activeFamily: 'Paint',
      statusFilter: 'all',
      search: '',
      debouncedSearch: '',
    })
    expect(patch.visibleRows.map((product) => product.id)).toEqual([
      'paint-3',
      'paint-1',
      'paint-2',
    ])
    expect(patch.knownRows.map((product) => product.id)).toEqual([
      'paint-1',
      'paint-2',
      'paint-3',
    ])
  })

  it('builds an update resource patch that hides rows no longer matching the filter', () => {
    const selected = buildProduct({
      id: 'paint-2',
      name: 'Dormant Paint',
      status: 'Inactive',
    })

    const patch = buildUpdatedQuoteProductResourcePatch({
      visibleRows: [selected],
      knownRows: [selected],
      updatedRow: buildProduct({
        id: 'paint-2',
        name: 'Dormant Paint',
        status: 'Archived',
      }),
      navigation: {
        activeFamily: 'Paint',
        statusFilter: 'inactive',
        search: '',
        debouncedSearch: '',
      },
      previousId: 'paint-2',
    })

    expect(patch.visibleRows).toEqual([])
    expect(patch.knownRows).toEqual([
      expect.objectContaining({
        id: 'paint-2',
        status: 'Archived',
      }),
    ])
  })

  it('builds an archive resource patch that keeps the archived row known when hidden', () => {
    const selected = buildProduct({
      id: 'paint-2',
      name: 'Dormant Paint',
      status: 'Inactive',
    })

    const patch = buildArchivedQuoteProductResourcePatch({
      visibleRows: [selected],
      knownRows: [selected],
      archivedRow: buildProduct({
        id: 'paint-2',
        name: 'Dormant Paint',
        status: 'Archived',
      }),
      navigation: {
        activeFamily: 'Paint',
        statusFilter: 'inactive',
        search: '',
        debouncedSearch: '',
      },
      archivedId: 'paint-2',
    })

    expect(patch.visibleRows).toEqual([])
    expect(patch.knownRows).toEqual([
      expect.objectContaining({
        id: 'paint-2',
        status: 'Archived',
      }),
    ])
  })

  it('removes a product from the visible slice when the id is present', () => {
    const product = buildProduct({ id: 'product-1', name: 'First Product' })
    const remainingProduct = buildProduct({ id: 'product-2', name: 'Second Product' })

    expect(removeProductFromVisibleSlice([product, remainingProduct], 'product-1')).toEqual([
      remainingProduct,
    ])
  })

  it('leaves the visible slice unchanged when the removed id is not present', () => {
    const products = [
      buildProduct({ id: 'product-1', name: 'First Product' }),
      buildProduct({ id: 'product-2', name: 'Second Product' }),
    ]

    expect(removeProductFromVisibleSlice(products, 'product-3')).toEqual(products)
  })

  it('returns an empty visible slice when removing from an empty list', () => {
    expect(removeProductFromVisibleSlice([], 'product-1')).toEqual([])
  })

  it('chooses the first product id as the fallback selection', () => {
    expect(
      chooseQuoteProductsFallbackId([
        buildProduct({ id: 'product-1' }),
        buildProduct({ id: 'product-2' }),
      ])
    ).toBe('product-1')
  })

  it('returns null when choosing a fallback selection from an empty list', () => {
    expect(chooseQuoteProductsFallbackId([])).toBeNull()
  })

  it('finds a quote product by id', () => {
    const product = buildProduct({ id: 'product-1' })
    const matchingProduct = buildProduct({ id: 'product-2', name: 'Matching Product' })

    expect(findQuoteProductById([product, matchingProduct], 'product-2')).toBe(matchingProduct)
  })

  it('returns null when no quote product id matches', () => {
    expect(findQuoteProductById([buildProduct({ id: 'product-1' })], 'product-2')).toBeNull()
  })

  it('returns null when finding a quote product with a null id', () => {
    expect(findQuoteProductById([buildProduct({ id: 'product-1' })], null)).toBeNull()
  })

  it('returns null when finding a quote product with an undefined id', () => {
    expect(findQuoteProductById([buildProduct({ id: 'product-1' })], undefined)).toBeNull()
  })

  it('returns null when finding a quote product in an empty list', () => {
    expect(findQuoteProductById([], 'product-1')).toBeNull()
  })
})
