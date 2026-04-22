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
      result.current.setFormState((current) => ({ ...current, name: 'Super Paint Pro' }))
    })

    await act(async () => {
      await result.current.save()
    })

    expect(updateQuoteProduct).toHaveBeenCalledWith(
      'paint-1',
      expect.objectContaining({ name: 'Super Paint Pro' })
    )
    expect(result.current.notice).toBe('Product saved.')

    await act(async () => {
      await result.current.remove()
    })

    expect(deleteQuoteProduct).toHaveBeenCalledWith('paint-1')
    expect(result.current.resource.data).toHaveLength(1)
  })
})
