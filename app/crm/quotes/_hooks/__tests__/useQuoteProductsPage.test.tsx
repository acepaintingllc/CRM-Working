import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('useQuoteProductsPage', () => {
  beforeEach(() => {
    createQuoteProduct.mockReset()
    deleteQuoteProduct.mockReset()
    loadQuoteProducts.mockReset()
    updateQuoteProduct.mockReset()
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('loads, filters by status, creates, saves, and deletes product rows', async () => {
    loadQuoteProducts.mockResolvedValue([
      {
        id: 'paint-1',
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
      },
      {
        id: 'paint-2',
        name: 'Dormant Paint',
        family: 'Paint',
        base: 'B',
        subtype: 'Interior',
        cost_per_unit: 27,
        coverage_sqft_per_gal_per_coat: 300,
        efficiency_pct: 80,
        default_coats: 1,
        default_sheen: 'Flat',
        default_scopes: ['Walls'],
        notes: '',
        status: 'Inactive',
        created_at: '2026-01-02T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
      {
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
        default_scopes: ['Walls'],
        notes: '',
        status: 'Active',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ])
    updateQuoteProduct.mockResolvedValue({
      data: {
        id: 'paint-1',
        name: 'Super Paint Pro',
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
      },
        notice: 'Product saved.',
      })
    createQuoteProduct.mockResolvedValue({
      data: {
        id: 'paint-3',
        name: 'Fresh Paint',
        family: 'Paint',
        base: 'C',
        subtype: 'Exterior',
        cost_per_unit: 40,
        coverage_sqft_per_gal_per_coat: 375,
        efficiency_pct: 95,
        default_coats: 2,
        default_sheen: 'Satin',
        default_scopes: ['Walls'],
        notes: '',
        status: 'Archived',
        created_at: '2026-01-03T00:00:00.000Z',
        updated_at: '2026-01-03T00:00:00.000Z',
      },
      notice: 'Product created.',
    })
    deleteQuoteProduct.mockResolvedValue({ data: true })

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    expect(result.current.catalogVm.selected?.id).toBe('paint-1')
    expect(loadQuoteProducts).toHaveBeenCalledWith({ status: 'all' })

    act(() => {
      result.current.actions.setStatusFilter('inactive')
    })

    expect(result.current.catalogVm.filtered.map((product) => product.id)).toEqual(['paint-2'])

    act(() => {
      result.current.actions.setStatusFilter('all')
      result.current.actions.setSearch('super')
    })
    expect(result.current.catalogVm.filtered).toHaveLength(1)

    act(() => {
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
    expect(result.current.catalogVm.selectedId).toBe('paint-3')
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

    await act(async () => {
      await result.current.actions.requestRemove()
    })

    expect(deleteQuoteProduct).toHaveBeenCalledWith('paint-1')
    expect(result.current.resource.data.map((product) => product.id)).toEqual([
      'paint-3',
      'paint-2',
      'primer-1',
    ])
    expect(result.current.uiState.notice).toBe('Product deleted.')
  })

  it('exposes structured validation state for invalid draft values', async () => {
    loadQuoteProducts.mockResolvedValue([
      {
        id: 'paint-1',
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
      },
    ])

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    expect(result.current.editorVm.isCreating).toBe(false)

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
      .mockResolvedValueOnce([
        {
          id: 'paint-1',
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
        },
      ])

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    expect(result.current.uiState.loadError).toBe('Products unavailable.')
    expect(result.current.uiState.pageBanner).toEqual({
      tone: 'error',
      message: 'Products unavailable.',
    })
    expect(result.current.uiState.actionError).toBeNull()
    expect(result.current.uiState.canRetry).toBe(true)

    await act(async () => {
      await result.current.resource.refresh()
    })

    await waitFor(() => {
      expect(result.current.uiState.loadError).toBeNull()
    })

    expect(result.current.catalogVm.selected?.id).toBe('paint-1')
  })

  it('keeps the current filtered selection coherent when rows disappear', async () => {
    loadQuoteProducts.mockResolvedValue([
      {
        id: 'paint-1',
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
      },
      {
        id: 'paint-2',
        name: 'Dormant Paint',
        family: 'Paint',
        base: 'B',
        subtype: 'Interior',
        cost_per_unit: 25,
        coverage_sqft_per_gal_per_coat: 320,
        efficiency_pct: 82,
        default_coats: 1,
        default_sheen: 'Flat',
        default_scopes: ['Walls'],
        notes: '',
        status: 'Inactive',
        created_at: '2026-01-02T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ])
    deleteQuoteProduct.mockResolvedValue({ data: true })

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.setStatusFilter('inactive')
    })

    expect(result.current.catalogVm.selected?.id).toBe('paint-2')

    await act(async () => {
      await result.current.actions.requestRemove()
    })

    expect(result.current.catalogVm.filtered).toEqual([])
    expect(result.current.catalogVm.selected).toBeNull()
    expect(result.current.catalogVm.selectedId).toBeNull()
  })

  it('recomputes filtered selection coherently when an update changes the current status bucket', async () => {
    loadQuoteProducts.mockResolvedValue([
      {
        id: 'paint-1',
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
      },
      {
        id: 'paint-2',
        name: 'Dormant Paint',
        family: 'Paint',
        base: 'B',
        subtype: 'Interior',
        cost_per_unit: 25,
        coverage_sqft_per_gal_per_coat: 320,
        efficiency_pct: 82,
        default_coats: 1,
        default_sheen: 'Flat',
        default_scopes: ['Walls'],
        notes: '',
        status: 'Inactive',
        created_at: '2026-01-02T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ])
    updateQuoteProduct.mockResolvedValue({
      data: {
        id: 'paint-2',
        name: 'Dormant Paint',
        family: 'Paint',
        base: 'B',
        subtype: 'Interior',
        cost_per_unit: 25,
        coverage_sqft_per_gal_per_coat: 320,
        efficiency_pct: 82,
        default_coats: 1,
        default_sheen: 'Flat',
        default_scopes: ['Walls'],
        notes: '',
        status: 'Archived',
        created_at: '2026-01-02T00:00:00.000Z',
        updated_at: '2026-01-03T00:00:00.000Z',
      },
      notice: 'Product saved.',
    })

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.setStatusFilter('inactive')
    })

    expect(result.current.catalogVm.selected?.id).toBe('paint-2')

    act(() => {
      result.current.actions.updateDraftField('status', 'Archived')
    })

    await act(async () => {
      await result.current.actions.save()
    })

    expect(result.current.catalogVm.filtered).toEqual([])
    expect(result.current.catalogVm.selected).toBeNull()
    expect(result.current.catalogVm.selectedId).toBeNull()
    expect(result.current.resource.data.find((product) => product.id === 'paint-2')?.status).toBe(
      'Archived'
    )
  })

  it('keeps existing rows intact when a mutation fails', async () => {
    loadQuoteProducts.mockResolvedValue([
      {
        id: 'paint-1',
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
      },
    ])
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

  it('clears a prior notice when validation or mutation failure takes precedence', async () => {
    loadQuoteProducts.mockResolvedValue([
      {
        id: 'paint-1',
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
      },
    ])
    updateQuoteProduct
      .mockResolvedValueOnce({
        data: {
          id: 'paint-1',
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
        },
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
