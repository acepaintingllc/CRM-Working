import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuoteProductsPage } from '../useQuoteProductsPage'

const {
  deleteQuoteProduct,
  loadQuoteProducts,
  updateQuoteProduct,
} = vi.hoisted(() => ({
  deleteQuoteProduct: vi.fn(),
  loadQuoteProducts: vi.fn(),
  updateQuoteProduct: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  deleteQuoteProduct,
  loadQuoteProducts,
  updateQuoteProduct,
}))

describe('useQuoteProductsPage', () => {
  beforeEach(() => {
    deleteQuoteProduct.mockReset()
    loadQuoteProducts.mockReset()
    updateQuoteProduct.mockReset()
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('loads, filters, saves, and deletes product rows', async () => {
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
    deleteQuoteProduct.mockResolvedValue({ data: true })

    const { result } = renderHook(() => useQuoteProductsPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    expect(result.current.selected?.id).toBe('paint-1')

    act(() => {
      result.current.setSearch('super')
    })
    expect(result.current.filtered).toHaveLength(1)

    act(() => {
      result.current.actions.updateDraftField('name', 'Super Paint Pro')
    })

    await act(async () => {
      await result.current.save()
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
      await result.current.remove()
    })

    expect(deleteQuoteProduct).toHaveBeenCalledWith('paint-1')
    expect(result.current.resource.data).toHaveLength(1)
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

    act(() => {
      result.current.actions.updateDraftField('name', '')
      result.current.actions.updateDraftField('efficiency_pct', '120')
    })

    expect(result.current.validation.ok).toBe(false)
    expect(result.current.validation.fields.name).toBe('Product name is required.')
    expect(result.current.validation.fields.efficiency_pct).toBe(
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

    expect(result.current.selected?.id).toBe('paint-1')
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
      await result.current.save()
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
      await result.current.save()
    })

    expect(result.current.uiState.notice).toBeNull()
    expect(result.current.uiState.actionError).toBe('Save exploded.')
    expect(result.current.uiState.pageBanner).toEqual({
      tone: 'error',
      message: 'Save exploded.',
    })
  })
})
