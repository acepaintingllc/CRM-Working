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
      expect(result.current.feedback.hasLoaded).toBe(true)
    })

    expect(result.current.form.productDefaultFields[0].options).toHaveLength(1)

    act(() => {
      result.current.actions.setSettings({
        ...result.current.form.settings,
        override_labor_rate: 70,
      })
    })

    expect(result.current.form.canSave).toBe(true)

    await act(async () => {
      await result.current.actions.save()
    })

    expect(saveQuoteDefaults).toHaveBeenCalled()
    expect(result.current.feedback.notice).toBe('Quote defaults saved.')
    expect(result.current.form.settings.override_labor_rate).toBe(70)
    expect(result.current.form.canSave).toBe(false)
  })

  it('does not mark the page dirty when only the loaded product catalog changes on reload', async () => {
    loadQuoteProducts
      .mockResolvedValueOnce([{ id: 'paint-1', name: 'Paint', family: 'paint' }])
      .mockResolvedValueOnce([
        { id: 'paint-1', name: 'Paint', family: 'paint' },
        { id: 'paint-2', name: 'Trim Paint', family: 'paint' },
      ])
    loadQuoteDefaults.mockResolvedValue({
      walls_paint_id: 'paint-1',
      walls_primer_id: null,
      ceiling_paint_id: null,
      ceiling_primer_id: null,
      trim_paint_id: null,
      trim_primer_id: null,
      override_labor_rate: 65,
    })

    const { result } = renderHook(() => useQuoteDefaultsPage())

    await waitFor(() => {
      expect(result.current.feedback.hasLoaded).toBe(true)
    })

    expect(result.current.form.canSave).toBe(false)

    await act(async () => {
      await result.current.actions.reload()
    })

    expect(result.current.form.canSave).toBe(false)
    expect(result.current.form.productDefaultFields[0].options).toHaveLength(2)
  })

  it('tracks dirty state from settings changes only and clears it after save', async () => {
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
        override_labor_rate: 72,
      },
      notice: 'Quote defaults saved.',
    })

    const { result } = renderHook(() => useQuoteDefaultsPage())

    await waitFor(() => {
      expect(result.current.feedback.hasLoaded).toBe(true)
    })

    act(() => {
      result.current.actions.setSettings({
        ...result.current.form.settings,
        override_labor_rate: 72,
      })
    })

    expect(result.current.form.canSave).toBe(true)

    await act(async () => {
      await result.current.actions.save()
    })

    expect(result.current.form.canSave).toBe(false)
  })
})
