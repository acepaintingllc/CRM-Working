import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import type { QuoteProductRow } from '@/lib/quotes/productsForm'
import { useQuoteProductsSelectionState } from '../useQuoteProductsSelectionState'

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

describe('useQuoteProductsSelectionState', () => {
  it('keeps the editor selection when the visible slice no longer contains the selected row', () => {
    const products = [
      buildProduct({ id: 'paint-1', name: 'Super Paint' }),
      buildProduct({ id: 'paint-2', name: 'Dormant Paint', status: 'Inactive' }),
    ]

    const { result, rerender } = renderHook(
      ({ nextProducts }) => useQuoteProductsSelectionState({ products: nextProducts }),
      {
        initialProps: {
          nextProducts: products,
        },
      }
    )

    act(() => {
      result.current.setSelectedIdState('paint-2')
    })

    expect(result.current.selected?.id).toBe('paint-2')
    expect(result.current.editorSelected?.id).toBe('paint-2')

    rerender({
      nextProducts: [products[0]],
    })

    expect(result.current.selected).toBeNull()
    expect(result.current.selectedId).toBe('paint-2')
    expect(result.current.editorSelected?.id).toBe('paint-2')
  })

  it('falls back to the first visible row after the explicit selection is cleared', () => {
    const products = [
      buildProduct({ id: 'paint-1', name: 'Super Paint' }),
      buildProduct({ id: 'paint-2', name: 'Dormant Paint', status: 'Inactive' }),
    ]

    const { result } = renderHook(() => useQuoteProductsSelectionState({ products }))

    expect(result.current.selectedId).toBe('paint-1')
    expect(result.current.editorSelected?.id).toBe('paint-1')

    act(() => {
      result.current.setSelectedIdState('paint-2')
    })

    expect(result.current.selectedId).toBe('paint-2')

    act(() => {
      result.current.setSelectedIdState(null)
    })

    expect(result.current.selectedId).toBe('paint-1')
    expect(result.current.selected?.id).toBe('paint-1')
    expect(result.current.editorSelected?.id).toBe('paint-1')
  })
})
