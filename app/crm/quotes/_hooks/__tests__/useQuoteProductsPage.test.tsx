import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { QuoteProductQuery, QuoteProductRow } from '@/lib/quotes/productsForm'
import { useQuoteProductsPage } from '../useQuoteProductsPage'

const {
  createQuoteProduct,
  deleteQuoteProduct,
  loadQuoteProducts,
  updateQuoteProduct,
} = vi.hoisted(() => ({
  createQuoteProduct: vi.fn(),
  deleteQuoteProduct: vi.fn(),
  loadQuoteProducts: vi.fn(),
  updateQuoteProduct: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  createQuoteProduct,
  deleteQuoteProduct,
  loadQuoteProducts,
  updateQuoteProduct,
}))

function buildProduct(overrides: Partial<QuoteProductRow>): QuoteProductRow {
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

function matchesQuery(product: QuoteProductRow, query: QuoteProductQuery) {
  if (query.family && product.family !== query.family) return false
  if (query.status !== 'all' && product.status.toLowerCase() !== query.status) return false
  const search = String(query.search ?? '').trim().toLowerCase()
  if (!search) return true
  return `${product.name} ${product.base ?? ''} ${product.subtype ?? ''} ${product.notes ?? ''} ${product.status}`
    .toLowerCase()
    .includes(search)
}

describe('useQuoteProductsPage', () => {
  beforeEach(() => {
    createQuoteProduct.mockReset()
    deleteQuoteProduct.mockReset()
    loadQuoteProducts.mockReset()
    updateQuoteProduct.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads query-driven product slices, creates, saves, and deletes product rows', async () => {
    const products = [
      buildProduct({ id: 'paint-1', name: 'Super Paint' }),
      buildProduct({
        id: 'paint-2',
        name: 'Dormant Paint',
        base: 'B',
        cost_per_unit: 27,
        coverage_sqft_per_gal_per_coat: 300,
        efficiency_pct: 80,
        default_coats: 1,
        default_sheen: 'Flat',
        status: 'Inactive',
        created_at: '2026-01-02T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      }),
      buildProduct({
        id: 'primer-1',
        name: 'Prime Coat',
        family: 'Primer',
        base: 'B',
        subtype: 'Exterior',
        cost_per_unit: 25,
        coverage_sqft_per_gal_per_coat: 300,
        efficiency_pct: 85,
        default_coats: 1,
        default_sheen: 'Flat',
      }),
    ]

    loadQuoteProducts.mockImplementation(async (query: QuoteProductQuery) =>
      products.filter((product) => matchesQuery(product, query))
    )
    updateQuoteProduct.mockResolvedValue({
      data: buildProduct({ id: 'paint-1', name: 'Super Paint Pro' }),
      notice: 'Product saved.',
    })
    createQuoteProduct.mockResolvedValue({
      data: buildProduct({
        id: 'paint-3',
        name: 'Fresh Paint',
        base: 'C',
        subtype: 'Exterior',
        cost_per_unit: 40,
        coverage_sqft_per_gal_per_coat: 375,
        efficiency_pct: 95,
        default_sheen: 'Satin',
        status: 'Archived',
        created_at: '2026-01-03T00:00:00.000Z',
        updated_at: '2026-01-03T00:00:00.000Z',
      }),
      notice: 'Product created.',
    })
    deleteQuoteProduct.mockResolvedValue({ data: true })

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    expect(loadQuoteProducts).toHaveBeenCalledWith({ status: 'all', family: 'Paint', search: null })
    expect(result.current.catalogVm.products.map((product) => product.id)).toEqual(['paint-1', 'paint-2'])
    expect(result.current.catalogVm.selected?.id).toBe('paint-1')

    act(() => {
      result.current.actions.setStatusFilter('inactive')
    })

    await waitFor(() => {
      expect(result.current.catalogVm.products.map((product) => product.id)).toEqual(['paint-2'])
    })
    expect(loadQuoteProducts).toHaveBeenLastCalledWith({
      status: 'inactive',
      family: 'Paint',
      search: null,
    })

    act(() => {
      result.current.actions.setStatusFilter('all')
      result.current.actions.startCreate()
      result.current.actions.updateDraftField('name', 'Fresh Paint')
      result.current.actions.updateDraftField('base', 'C')
      result.current.actions.updateDraftField('subtype', 'Exterior')
      result.current.actions.updateDraftField('cost_per_unit', '40')
      result.current.actions.updateDraftField('coverage_sqft_per_gal_per_coat', '375')
      result.current.actions.updateDraftField('efficiency_pct', '95')
      result.current.actions.updateDraftField('default_coats', '2')
      result.current.actions.updateDraftField('default_sheen', 'Satin')
      result.current.actions.updateDraftField('default_scopes', ['Walls'])
      result.current.actions.updateDraftField('status', 'Archived')
    })

    await act(async () => {
      await result.current.actions.save()
    })

    expect(createQuoteProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Fresh Paint',
        status: 'Archived',
      })
    )
    expect(result.current.catalogVm.activeFamily).toBe('Paint')
    expect(result.current.catalogVm.statusFilter).toBe('all')
    expect(result.current.catalogVm.search).toBe('')
    expect(result.current.catalogVm.selectedId).toBe('paint-3')
    expect(result.current.catalogVm.products.map((product) => product.id)).toEqual([
      'paint-3',
      'paint-1',
      'paint-2',
    ])
    expect(result.current.uiState.notice).toBe('Product created.')

    act(() => {
      result.current.actions.setSelectedId('paint-1')
    })

    await waitFor(() => {
      expect(result.current.editorVm.draft.name).toBe('Super Paint')
    })

    act(() => {
      result.current.actions.updateDraftField('name', 'Super Paint Pro')
    })

    await act(async () => {
      await result.current.actions.save()
    })

    expect(updateQuoteProduct).toHaveBeenCalledWith(
      'paint-1',
      expect.objectContaining({ name: 'Super Paint Pro' })
    )
    expect(result.current.uiState.notice).toBe('Product saved.')
    expect(result.current.uiState.pageBanner).toEqual({
      tone: 'success',
      message: 'Product saved.',
    })

    act(() => {
      result.current.actions.requestDelete()
    })

    expect(result.current.deleteVm).toEqual({
      isOpen: true,
      status: 'confirming',
      productName: 'Super Paint Pro',
    })

    await act(async () => {
      await result.current.actions.confirmDelete()
    })

    expect(deleteQuoteProduct).toHaveBeenCalledWith('paint-1')
    expect(result.current.resource.data.map((product) => product.id)).toEqual(['paint-3', 'paint-2'])
    expect(result.current.uiState.notice).toBe('Product deleted.')
    expect(result.current.deleteVm.isOpen).toBe(false)
  })

  it('debounces search-driven reloads and keeps the raw input responsive', async () => {
    const products = [
      buildProduct({ id: 'paint-1', name: 'Super Paint' }),
      buildProduct({ id: 'paint-2', name: 'Dormant Paint', status: 'Inactive' }),
    ]
    loadQuoteProducts.mockImplementation(async (query: QuoteProductQuery) =>
      products.filter((product) => matchesQuery(product, query))
    )

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })
    const initialLoadCalls = loadQuoteProducts.mock.calls.length

    act(() => {
      result.current.actions.setSearch('super')
    })

    expect(result.current.catalogVm.search).toBe('super')
    expect(loadQuoteProducts).toHaveBeenCalledTimes(initialLoadCalls)
    expect(result.current.catalogVm.products.map((product) => product.id)).toEqual(['paint-1', 'paint-2'])

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 350))
    })

    await waitFor(() => {
      expect(loadQuoteProducts).toHaveBeenCalledTimes(2)
    })
    expect(loadQuoteProducts).toHaveBeenLastCalledWith({
      status: 'all',
      family: 'Paint',
      search: 'super',
    })
    await waitFor(() => {
      expect(result.current.catalogVm.products.map((product) => product.id)).toEqual(['paint-1'])
    })
  })

  it('preserves an explicit selection across a reordered reload', async () => {
    loadQuoteProducts
      .mockResolvedValueOnce([
        buildProduct({ id: 'paint-1', name: 'Super Paint' }),
        buildProduct({ id: 'paint-2', name: 'Dormant Paint', base: 'B' }),
      ])
      .mockResolvedValueOnce([
        buildProduct({ id: 'paint-2', name: 'Dormant Paint', base: 'B' }),
        buildProduct({ id: 'paint-1', name: 'Super Paint' }),
      ])

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.setSelectedId('paint-2')
    })

    await act(async () => {
      await result.current.resource.refresh()
    })

    expect(result.current.catalogVm.selectedId).toBe('paint-2')
    expect(result.current.catalogVm.selected?.id).toBe('paint-2')
    expect(result.current.editorVm.selected?.id).toBe('paint-2')
    expect(result.current.editorVm.draft.name).toBe('Dormant Paint')
  })

  it('keeps the editor on the explicit selection when search hides that row', async () => {
    const products = [
      buildProduct({ id: 'paint-1', name: 'Super Paint' }),
      buildProduct({ id: 'paint-2', name: 'Dormant Paint', status: 'Inactive' }),
    ]
    loadQuoteProducts.mockImplementation(async (query: QuoteProductQuery) =>
      products.filter((product) => matchesQuery(product, query))
    )

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.setSelectedId('paint-2')
    })

    await waitFor(() => {
      expect(result.current.editorVm.draft.name).toBe('Dormant Paint')
    })

    act(() => {
      result.current.actions.setSearch('super')
    })

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 350))
    })

    await waitFor(() => {
      expect(result.current.catalogVm.products.map((product) => product.id)).toEqual(['paint-1'])
    })

    expect(result.current.catalogVm.selectedId).toBe('paint-2')
    expect(result.current.catalogVm.selected).toBeNull()
    expect(result.current.editorVm.selected?.id).toBe('paint-2')
    expect(result.current.editorVm.draft.name).toBe('Dormant Paint')
  })

  it('exposes structured validation state for invalid draft values', async () => {
    loadQuoteProducts.mockResolvedValue([buildProduct({ id: 'paint-1' })])

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.updateDraftField('name', '')
      result.current.actions.updateDraftField('efficiency_pct', '120')
    })

    expect(result.current.editorVm.validation.ok).toBe(false)
    expect(result.current.editorVm.validation.fields.name).toBe('Product name is required.')
    expect(result.current.editorVm.validation.fields.efficiency_pct).toBe(
      'Efficiency must be 100 or less.'
    )
    expect(result.current.uiState.validationError).toBe('Product name is required.')
    expect(result.current.uiState.inlineValidation).toBe('Product name is required.')
    expect(result.current.uiState.canSave).toBe(false)
  })

  it('uses load errors as the shell-level status until retry succeeds', async () => {
    loadQuoteProducts
      .mockRejectedValueOnce(new Error('Products unavailable.'))
      .mockResolvedValueOnce([buildProduct({ id: 'paint-1' })])

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    expect(result.current.uiState.loadError).toBe('Products unavailable.')
    expect(result.current.uiState.pageBanner).toEqual({
      tone: 'error',
      message: 'Products unavailable.',
    })
    expect(result.current.uiState.canRetry).toBe(true)

    await act(async () => {
      await result.current.resource.refresh()
    })

    await waitFor(() => {
      expect(result.current.uiState.loadError).toBeNull()
    })

    expect(result.current.catalogVm.selected?.id).toBe('paint-1')
  })

  it('keeps selection coherent when query-driven rows disappear after delete', async () => {
    loadQuoteProducts.mockResolvedValue([
      buildProduct({ id: 'paint-2', name: 'Dormant Paint', status: 'Inactive' }),
    ])
    deleteQuoteProduct.mockResolvedValue({ data: true })

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.setStatusFilter('inactive')
    })

    await waitFor(() => {
      expect(result.current.catalogVm.selected?.id).toBe('paint-2')
    })

    act(() => {
      result.current.actions.requestDelete()
    })

    await act(async () => {
      await result.current.actions.confirmDelete()
    })

    expect(result.current.catalogVm.products).toEqual([])
    expect(result.current.catalogVm.selected).toBeNull()
    expect(result.current.catalogVm.selectedId).toBeNull()
  })

  it('falls back to the next visible row after deleting the explicit selection', async () => {
    loadQuoteProducts.mockResolvedValue([
      buildProduct({ id: 'paint-1', name: 'Super Paint' }),
      buildProduct({ id: 'paint-2', name: 'Dormant Paint', status: 'Inactive' }),
    ])
    deleteQuoteProduct.mockResolvedValue({ data: true })

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.setSelectedId('paint-2')
    })

    await waitFor(() => {
      expect(result.current.editorVm.selected?.id).toBe('paint-2')
    })

    act(() => {
      result.current.actions.requestDelete()
    })

    await act(async () => {
      await result.current.actions.confirmDelete()
    })

    await waitFor(() => {
      expect(result.current.catalogVm.selectedId).toBe('paint-1')
    })

    expect(result.current.catalogVm.products.map((product) => product.id)).toEqual(['paint-1'])
    expect(result.current.catalogVm.selected?.id).toBe('paint-1')
    expect(result.current.editorVm.selected?.id).toBe('paint-1')
    expect(result.current.editorVm.draft.name).toBe('Super Paint')
  })

  it('keeps the explicit selection stable when a save moves the row out of the filtered slice', async () => {
    loadQuoteProducts.mockResolvedValue([
      buildProduct({ id: 'paint-2', name: 'Dormant Paint', status: 'Inactive' }),
    ])
    updateQuoteProduct.mockResolvedValue({
      data: buildProduct({ id: 'paint-2', name: 'Dormant Paint', status: 'Archived' }),
      notice: 'Product saved.',
    })

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.setStatusFilter('inactive')
    })

    await waitFor(() => {
      expect(result.current.catalogVm.selected?.id).toBe('paint-2')
    })

    act(() => {
      result.current.actions.updateDraftField('status', 'Archived')
    })

    await act(async () => {
      await result.current.actions.save()
    })

    expect(result.current.catalogVm.products).toEqual([])
    expect(result.current.catalogVm.selected).toBeNull()
    expect(result.current.catalogVm.selectedId).toBe('paint-2')
    expect(result.current.editorVm.selected?.id).toBe('paint-2')
    expect(result.current.editorVm.draft.status).toBe('Archived')
    expect(result.current.editorVm.canDelete).toBe(true)
    expect(result.current.resource.data.find((product) => product.id === 'paint-2')).toBeUndefined()
  })

  it('keeps existing rows intact when a mutation fails', async () => {
    loadQuoteProducts.mockResolvedValue([buildProduct({ id: 'paint-1' })])
    updateQuoteProduct.mockRejectedValue(new Error('Save exploded.'))

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.updateDraftField('name', 'Broken Save Name')
    })

    await act(async () => {
      await result.current.actions.save()
    })

    expect(result.current.resource.data).toEqual([
      expect.objectContaining({
        id: 'paint-1',
        name: 'Super Paint',
      }),
    ])
    expect(result.current.catalogVm.selected?.name).toBe('Super Paint')
    expect(result.current.uiState.actionError).toBe('Save exploded.')
  })

  it('prompts to discard unsaved edits when selection changes', async () => {
    loadQuoteProducts.mockResolvedValue([
      buildProduct({ id: 'paint-1' }),
      buildProduct({ id: 'paint-2', name: 'Dormant Paint', base: 'B', status: 'Inactive' }),
    ])

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.updateDraftField('name', 'Edited Name')
      result.current.actions.setSelectedId('paint-2')
    })

    expect(result.current.discardVm.isOpen).toBe(true)
    expect(result.current.discardVm.status).toBe('confirming')
    expect(result.current.discardVm.transitionType).toBe('setSelectedId')
    expect(result.current.editorVm.draft.name).toBe('Edited Name')

    act(() => {
      result.current.actions.cancelDiscard()
    })

    expect(result.current.catalogVm.selected?.id).toBe('paint-1')
    expect(result.current.editorVm.isDirty).toBe(true)

    act(() => {
      result.current.actions.setSelectedId('paint-2')
    })

    act(() => void result.current.actions.confirmDiscard())

    expect(result.current.catalogVm.selected?.id).toBe('paint-2')
    expect(result.current.editorVm.draft.name).toBe('Dormant Paint')
    expect(result.current.editorVm.isDirty).toBe(false)
  })

  it('prompts to discard unsaved edits for family, status, and search transitions', async () => {
    loadQuoteProducts.mockResolvedValue([buildProduct({ id: 'paint-1' })])

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.updateDraftField('name', 'Edited Name')
      result.current.actions.setActiveFamily('Primer')
    })

    expect(result.current.discardVm.transitionType).toBe('setActiveFamily')
    expect(result.current.discardVm.status).toBe('confirming')

    act(() => result.current.actions.cancelDiscard())

    expect(result.current.catalogVm.activeFamily).toBe('Paint')
    expect(result.current.editorVm.isDirty).toBe(true)

    act(() => {
      result.current.actions.setStatusFilter('inactive')
    })
    expect(result.current.discardVm.transitionType).toBe('setStatusFilter')

    act(() => void result.current.actions.confirmDiscard())

    expect(result.current.catalogVm.statusFilter).toBe('inactive')

    act(() => {
      result.current.actions.updateDraftField('name', 'Dirty Name')
      result.current.actions.setSearch('prime')
    })

    expect(result.current.discardVm.transitionType).toBe('setSearch')

    act(() => result.current.actions.cancelDiscard())

    expect(result.current.catalogVm.search).toBe('')
    expect(result.current.editorVm.draft.name).toBe('Dirty Name')
  })

  it('prompts to discard unsaved edits before entering create mode', async () => {
    loadQuoteProducts.mockResolvedValue([buildProduct({ id: 'paint-1' })])

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.updateDraftField('name', 'Unsaved Name')
      result.current.actions.startCreate()
    })

    expect(result.current.discardVm.transitionType).toBe('startCreate')
    expect(result.current.discardVm.status).toBe('confirming')

    act(() => {
      result.current.actions.cancelDiscard()
    })

    expect(result.current.editorVm.isCreating).toBe(false)
    expect(result.current.editorVm.draft.name).toBe('Unsaved Name')

    act(() => {
      result.current.actions.startCreate()
    })

    act(() => void result.current.actions.confirmDiscard())

    expect(result.current.editorVm.isCreating).toBe(true)
    expect(result.current.editorVm.draft.name).toBe('')
    expect(result.current.editorVm.draft.family).toBe('Paint')
  })

  it('opens, cancels, and confirms delete with modal state instead of window.confirm', async () => {
    loadQuoteProducts.mockResolvedValue([buildProduct({ id: 'paint-1' })])
    deleteQuoteProduct.mockResolvedValue({ data: true })

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.requestDelete()
    })

    expect(result.current.deleteVm).toEqual({
      isOpen: true,
      status: 'confirming',
      productName: 'Super Paint',
    })

    act(() => {
      result.current.actions.cancelDelete()
    })

    expect(result.current.deleteVm.isOpen).toBe(false)
    expect(deleteQuoteProduct).not.toHaveBeenCalled()

    act(() => {
      result.current.actions.requestDelete()
    })

    await act(async () => {
      await result.current.actions.confirmDelete()
    })

    expect(deleteQuoteProduct).toHaveBeenCalledWith('paint-1')
    expect(result.current.deleteVm.isOpen).toBe(false)
    expect(result.current.catalogVm.selectedId).toBeNull()
  })

  it('applies a queued product transition only once', async () => {
    loadQuoteProducts.mockResolvedValue([buildProduct({ id: 'paint-1' })])

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.updateDraftField('name', 'Dirty Name')
      result.current.actions.setStatusFilter('inactive')
      result.current.actions.setStatusFilter('all')
    })

    expect(result.current.discardVm.transitionType).toBe('setStatusFilter')

    act(() => void result.current.actions.confirmDiscard())
    act(() => void result.current.actions.confirmDiscard())

    expect(result.current.catalogVm.statusFilter).toBe('inactive')
  })

  it('keeps only the first queued transition while the discard dialog is open', async () => {
    loadQuoteProducts.mockResolvedValue([
      buildProduct({ id: 'paint-1' }),
      buildProduct({ id: 'paint-2', family: 'Primer', name: 'Prime Coat' }),
    ])

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.updateDraftField('name', 'Dirty Name')
      result.current.actions.setActiveFamily('Primer')
      result.current.actions.setStatusFilter('inactive')
      result.current.actions.setSearch('prime')
    })

    expect(result.current.discardVm.transitionType).toBe('setActiveFamily')
    expect(result.current.catalogVm.activeFamily).toBe('Paint')
    expect(result.current.catalogVm.statusFilter).toBe('all')
    expect(result.current.catalogVm.search).toBe('')

    act(() => void result.current.actions.confirmDiscard())

    expect(result.current.catalogVm.activeFamily).toBe('Primer')
    expect(result.current.catalogVm.statusFilter).toBe('all')
    expect(result.current.catalogVm.search).toBe('')
    expect(result.current.editorVm.isDirty).toBe(true)
    expect(result.current.editorVm.draft.name).toBe('Dirty Name')
  })

  it('cancels a clean create draft before replaying selection and filter transitions', async () => {
    loadQuoteProducts.mockResolvedValue([
      buildProduct({ id: 'paint-1' }),
      buildProduct({ id: 'paint-2', name: 'Dormant Paint', base: 'B', status: 'Inactive' }),
    ])

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.startCreate()
      result.current.actions.setSelectedId('paint-2')
    })

    expect(result.current.editorVm.isCreating).toBe(false)
    expect(result.current.catalogVm.selected?.id).toBe('paint-2')
    expect(result.current.editorVm.draft.name).toBe('Dormant Paint')

    act(() => {
      result.current.actions.startCreate()
      result.current.actions.setStatusFilter('inactive')
    })

    expect(result.current.editorVm.isCreating).toBe(false)
    expect(result.current.catalogVm.statusFilter).toBe('inactive')
  })

  it('clears a prior notice when validation or mutation failure takes precedence', async () => {
    loadQuoteProducts.mockResolvedValue([buildProduct({ id: 'paint-1' })])
    updateQuoteProduct
      .mockResolvedValueOnce({
        data: buildProduct({ id: 'paint-1' }),
        notice: 'Product saved.',
      })
      .mockRejectedValueOnce(new Error('Save exploded.'))

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    await act(async () => {
      await result.current.actions.save()
    })

    expect(result.current.uiState.notice).toBe('Product saved.')
    expect(result.current.uiState.pageBanner?.tone).toBe('success')

    act(() => {
      result.current.actions.updateDraftField('name', '')
    })

    expect(result.current.uiState.notice).toBe('Product saved.')
    expect(result.current.uiState.pageBanner).toBeNull()
    expect(result.current.uiState.inlineValidation).toBe('Product name is required.')

    act(() => {
      result.current.actions.updateDraftField('name', 'Super Paint')
    })

    await act(async () => {
      await result.current.actions.save()
    })

    expect(result.current.uiState.notice).toBeNull()
    expect(result.current.uiState.actionError).toBe('Save exploded.')
    expect(result.current.uiState.pageBanner).toEqual({
      tone: 'error',
      message: 'Save exploded.',
    })
  })
})
