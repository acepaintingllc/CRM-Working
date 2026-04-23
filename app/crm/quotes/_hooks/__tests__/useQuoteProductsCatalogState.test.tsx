import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import type { QuoteProductRow } from '@/lib/quotes/productsForm'
import { useQuoteProductsSelectionState } from '../useQuoteProductsCatalogState'

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
  it('auto-selects the first row when products load without an explicit selection', async () => {
    const { result, rerender } = renderHook(
      ({ products }) => useQuoteProductsSelectionState({ products }),
      {
        initialProps: { products: [] as QuoteProductRow[] },
      }
    )

    rerender({
      products: [buildProduct({ id: 'paint-1' }), buildProduct({ id: 'paint-2', name: 'Dormant Paint' })],
    })

    await waitFor(() => {
      expect(result.current.selectedId).toBe('paint-1')
    })

    expect(result.current.selected?.id).toBe('paint-1')
    expect(result.current.editorSelected?.id).toBe('paint-1')
  })

  it('preserves an explicit selection across reordered reloads', async () => {
    const first = buildProduct({ id: 'paint-1' })
    const second = buildProduct({ id: 'paint-2', name: 'Dormant Paint' })
    const { result, rerender } = renderHook(
      ({ products }) => useQuoteProductsSelectionState({ products }),
      {
        initialProps: { products: [first, second] },
      }
    )

    await waitFor(() => {
      expect(result.current.selectedId).toBe('paint-1')
    })

    act(() => {
      result.current.setSelectedId('paint-2')
    })

    rerender({
      products: [
        buildProduct({ id: 'paint-2', name: 'Dormant Paint v2', updated_at: '2026-02-01T00:00:00.000Z' }),
        buildProduct({ id: 'paint-1', updated_at: '2026-02-01T00:00:00.000Z' }),
      ],
    })

    expect(result.current.selectedId).toBe('paint-2')
    expect(result.current.selected?.id).toBe('paint-2')
    expect(result.current.editorSelected?.id).toBe('paint-2')
  })

  it('retains the explicit selected id and editor target when filters hide the row', async () => {
    const first = buildProduct({ id: 'paint-1' })
    const second = buildProduct({ id: 'paint-2', name: 'Dormant Paint' })
    const { result, rerender } = renderHook(
      ({ products }) => useQuoteProductsSelectionState({ products }),
      {
        initialProps: { products: [first, second] },
      }
    )

    await waitFor(() => {
      expect(result.current.selectedId).toBe('paint-1')
    })

    act(() => {
      result.current.setSelectedId('paint-2')
    })

    rerender({
      products: [first],
    })

    expect(result.current.selectedId).toBe('paint-2')
    expect(result.current.selected).toBeNull()
    expect(result.current.editorSelected?.id).toBe('paint-2')
  })

  it('falls back to the first visible row only after the explicit selection is intentionally cleared', async () => {
    const first = buildProduct({ id: 'paint-1' })
    const second = buildProduct({ id: 'paint-2', name: 'Dormant Paint' })
    const { result } = renderHook(() =>
      useQuoteProductsSelectionState({ products: [first, second] })
    )

    await waitFor(() => {
      expect(result.current.selectedId).toBe('paint-1')
    })

    act(() => {
      result.current.setSelectedId('paint-2')
      result.current.setSelectedId(null)
    })

    await waitFor(() => {
      expect(result.current.selectedId).toBe('paint-1')
    })

    expect(result.current.selected?.id).toBe('paint-1')
    expect(result.current.editorSelected?.id).toBe('paint-1')
  })

  it('clears selection when no rows remain after the explicit selection is cleared', async () => {
    const first = buildProduct({ id: 'paint-1' })
    const { result, rerender } = renderHook(
      ({ products }) => useQuoteProductsSelectionState({ products }),
      {
        initialProps: { products: [first] },
      }
    )

    await waitFor(() => {
      expect(result.current.selectedId).toBe('paint-1')
    })

    rerender({ products: [] })

    act(() => {
      result.current.setSelectedId(null)
    })

    expect(result.current.selectedId).toBeNull()
    expect(result.current.selected).toBeNull()
    expect(result.current.editorSelected).toBeNull()
  })
})
