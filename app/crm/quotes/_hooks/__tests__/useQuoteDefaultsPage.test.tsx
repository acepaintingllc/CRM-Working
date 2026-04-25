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
      { id: 'paint-1', name: 'Paint', family: 'Paint', status: 'Active' },
      { id: 'primer-1', name: 'Primer', family: 'Primer', status: 'Active' },
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
    expect(loadQuoteProducts).toHaveBeenCalledWith({ status: 'all' })

    act(() => {
      result.current.actions.setSettings({
        ...result.current.form.settings,
        walls_paint_id: ' paint-1 ',
        override_labor_rate: 70,
      })
    })

    expect(result.current.form.canSave).toBe(true)

    await act(async () => {
      await result.current.actions.save()
    })

    expect(saveQuoteDefaults).toHaveBeenCalledWith(
      expect.objectContaining({
        walls_paint_id: 'paint-1',
        override_labor_rate: 70,
      })
    )
    expect(result.current.feedback.notice).toBe('Quote defaults saved.')
    expect(result.current.form.settings.override_labor_rate).toBe(70)
    expect(result.current.form.canSave).toBe(false)
  })

  it('does not mark the page dirty when only the loaded product catalog changes on reload', async () => {
    loadQuoteProducts
      .mockResolvedValueOnce([{ id: 'paint-1', name: 'Paint', family: 'paint' }])
      .mockResolvedValueOnce([
        { id: 'paint-1', name: 'Paint', family: 'Paint', status: 'Active' },
        { id: 'paint-2', name: 'Trim Paint', family: 'Paint', status: 'Active' },
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
      { id: 'paint-1', name: 'Paint', family: 'Paint', status: 'Active' },
      { id: 'primer-1', name: 'Primer', family: 'Primer', status: 'Active' },
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

  it('keeps dirty edits and surfaces an action error when save fails', async () => {
    loadQuoteProducts.mockResolvedValue([
      { id: 'paint-1', name: 'Paint', family: 'Paint', status: 'Active' },
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
    saveQuoteDefaults.mockRejectedValue(new Error('Server unavailable.'))

    const { result } = renderHook(() => useQuoteDefaultsPage())

    await waitFor(() => {
      expect(result.current.feedback.hasLoaded).toBe(true)
    })

    act(() => {
      result.current.actions.setSettings({
        ...result.current.form.settings,
        override_labor_rate: 75,
      })
    })

    await act(async () => {
      await result.current.actions.save()
    })

    expect(result.current.feedback.actionError).toBe('Server unavailable.')
    expect(result.current.form.settings.override_labor_rate).toBe(75)
    expect(result.current.form.canSave).toBe(true)
  })

  it('keeps inactive saved selections visible while blocking save', async () => {
    loadQuoteProducts.mockResolvedValue([
      { id: 'paint-1', name: 'Paint', family: 'Paint', status: 'Active' },
      { id: 'paint-inactive', name: 'Old Paint', family: 'Paint', status: 'Inactive' },
    ])
    loadQuoteDefaults.mockResolvedValue({
      walls_paint_id: 'paint-inactive',
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

    expect(result.current.form.productDefaultFields[0].options[0]).toEqual(
      expect.objectContaining({ id: 'paint-inactive', status: 'Inactive' })
    )
    expect(result.current.form.validationError).toMatch(/inactive/i)
    expect(result.current.form.canSave).toBe(false)

    act(() => {
      result.current.actions.setSettings({
        ...result.current.form.settings,
        override_labor_rate: 70,
      })
    })

    await act(async () => {
      await result.current.actions.save()
    })

    expect(saveQuoteDefaults).not.toHaveBeenCalled()
  })

  it('renders missing saved selections as missing options and requires a fix before save', async () => {
    loadQuoteProducts.mockResolvedValue([
      { id: 'paint-1', name: 'Paint', family: 'Paint', status: 'Active' },
    ])
    loadQuoteDefaults.mockResolvedValue({
      walls_paint_id: 'deleted-paint',
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

    expect(result.current.form.productDefaultFields[0].options[0]).toEqual(
      expect.objectContaining({
        id: 'deleted-paint',
        name: 'Missing product (deleted-paint)',
        missing: true,
      })
    )
    expect(result.current.form.productDefaultErrors.walls_paint_id).toMatch(/no longer exists/)
    expect(result.current.form.canSave).toBe(false)

    act(() => {
      result.current.actions.setSettings({
        ...result.current.form.settings,
        walls_paint_id: 'paint-1',
      })
    })

    expect(result.current.form.validationError).toBe(null)
    expect(result.current.form.canSave).toBe(true)
  })

  it('blocks wrong-family selections and labor rates over the shared cap', async () => {
    loadQuoteProducts.mockResolvedValue([
      { id: 'primer-1', name: 'Primer', family: 'Primer', status: 'Active' },
    ])
    loadQuoteDefaults.mockResolvedValue({
      walls_paint_id: 'primer-1',
      walls_primer_id: null,
      ceiling_paint_id: null,
      ceiling_primer_id: null,
      trim_paint_id: null,
      trim_primer_id: null,
      override_labor_rate: 10001,
    })

    const { result } = renderHook(() => useQuoteDefaultsPage())

    await waitFor(() => {
      expect(result.current.feedback.hasLoaded).toBe(true)
    })

    expect(result.current.form.productDefaultFields[0].options[0]).toEqual(
      expect.objectContaining({ id: 'primer-1', family: 'Primer' })
    )
    expect(result.current.form.productDefaultErrors.walls_paint_id).toMatch(
      /must use a paint product/
    )
    expect(result.current.form.productDefaultErrors.override_labor_rate).toBe(
      'Labor rate must be between 0 and 10000.'
    )
    expect(result.current.form.canSave).toBe(false)
  })
})
