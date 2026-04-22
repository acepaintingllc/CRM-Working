import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuoteDefaultsPage } from '../useQuoteDefaultsPage'

const {
  loadQuoteDefaults,
  loadQuoteProducts,
  saveQuoteDefaults,
} = vi.hoisted(() => ({
  loadQuoteDefaults: vi.fn(),
  loadQuoteProducts: vi.fn(),
  saveQuoteDefaults: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  loadQuoteDefaults,
  loadQuoteProducts,
  saveQuoteDefaults,
}))

describe('useQuoteDefaultsPage', () => {
  beforeEach(() => {
    loadQuoteDefaults.mockReset()
    loadQuoteProducts.mockReset()
    saveQuoteDefaults.mockReset()
  })

  it('loads product defaults and saves validated changes', async () => {
    loadQuoteProducts.mockResolvedValue([
      { id: 'paint-1', name: 'Paint', family: 'paint' },
      { id: 'primer-1', name: 'Primer', family: 'primer' },
    ])
    loadQuoteDefaults.mockResolvedValue({
      walls_paint_id: 'paint-1',
      walls_primer_id: 'primer-1',
      override_labor_rate: 65,
    })
    saveQuoteDefaults.mockResolvedValue({
      data: {
        walls_paint_id: 'paint-1',
        walls_primer_id: 'primer-1',
        override_labor_rate: 70,
      },
      notice: 'Quote defaults saved.',
    })

    const { result } = renderHook(() => useQuoteDefaultsPage())

    await waitFor(() => {
      expect(result.current.resource.hasLoaded).toBe(true)
    })

    expect(result.current.productDefaultFields[0].options).toHaveLength(1)

    act(() => {
      result.current.resource.setData((current) => ({
        ...current,
        settings: {
          ...current.settings,
          override_labor_rate: 70,
        },
      }))
    })

    expect(result.current.canSave).toBe(true)

    await act(async () => {
      await result.current.resource.saveChanges()
    })

    expect(saveQuoteDefaults).toHaveBeenCalled()
    expect(result.current.resource.notice).toBe('Quote defaults saved.')
    expect(result.current.resource.data.settings.override_labor_rate).toBe(70)
  })
})
