import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import type { QuoteProductRow } from '@/lib/quotes/productsForm'
import { useQuoteProductEditorState } from '../useQuoteProductEditorState'

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

describe('useQuoteProductEditorState', () => {
  it('hydrates when the selected product changes', () => {
    const first = buildProduct({ id: 'paint-1', name: 'Super Paint' })
    const second = buildProduct({ id: 'paint-2', name: 'Dormant Paint' })
    const { result, rerender } = renderHook(
      ({ selected }) => useQuoteProductEditorState({ selected }),
      {
        initialProps: { selected: first as QuoteProductRow | null },
      }
    )

    expect(result.current.draft.name).toBe('Super Paint')

    rerender({ selected: second })

    expect(result.current.draft.name).toBe('Dormant Paint')
    expect(result.current.isDirty).toBe(false)
  })

  it('does not replace the draft when the effective selected product id is unchanged', () => {
    const first = buildProduct({ id: 'paint-1', name: 'Super Paint' })
    const { result, rerender } = renderHook(
      ({ selected }) => useQuoteProductEditorState({ selected }),
      {
        initialProps: { selected: first as QuoteProductRow | null },
      }
    )

    act(() => {
      result.current.updateDraftField('name', 'Edited Name')
    })

    rerender({
      selected: buildProduct({
        id: 'paint-1',
        name: 'Server Name',
        updated_at: '2026-02-01T00:00:00.000Z',
      }),
    })

    expect(result.current.draft.name).toBe('Edited Name')
    expect(result.current.isDirty).toBe(true)
  })

  it('keeps create mode isolated from background selection churn', () => {
    const first = buildProduct({ id: 'paint-1', name: 'Super Paint' })
    const second = buildProduct({ id: 'paint-2', name: 'Dormant Paint' })
    const { result, rerender } = renderHook(
      ({ selected }) => useQuoteProductEditorState({ selected }),
      {
        initialProps: { selected: first as QuoteProductRow | null },
      }
    )

    act(() => {
      result.current.startCreate('Paint')
      result.current.updateDraftField('name', 'Fresh Paint')
    })

    rerender({ selected: second })

    expect(result.current.isCreating).toBe(true)
    expect(result.current.draft.name).toBe('Fresh Paint')
  })

  it('cancel rehydrates from the resolved selection target', () => {
    const first = buildProduct({ id: 'paint-1', name: 'Super Paint' })
    const { result } = renderHook(() =>
      useQuoteProductEditorState({ selected: first })
    )

    act(() => {
      result.current.updateDraftField('name', 'Edited Name')
    })

    expect(result.current.isDirty).toBe(true)

    act(() => {
      result.current.cancel(first)
    })

    expect(result.current.draft.name).toBe('Super Paint')
    expect(result.current.isDirty).toBe(false)
  })
})
