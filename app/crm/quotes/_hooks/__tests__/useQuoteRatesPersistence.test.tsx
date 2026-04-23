import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuoteRatesPersistence } from '../useQuoteRatesPersistence'

const { mutateRatesFlags } = vi.hoisted(() => ({
  mutateRatesFlags: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  mutateRatesFlags,
}))

function createFeedback() {
  return {
    beginAction: vi.fn(),
    finishAction: vi.fn(),
    setErrorMessage: vi.fn(),
    setSuccessNotice: vi.fn(),
  }
}

describe('useQuoteRatesPersistence', () => {
  beforeEach(() => {
    mutateRatesFlags.mockReset()
  })

  it('reloads the retained row id after a successful save', async () => {
    const feedback = createFeedback()
    const refresh = vi.fn().mockResolvedValue(true)
    mutateRatesFlags.mockResolvedValue({ data: true })

    const { result } = renderHook(() =>
      useQuoteRatesPersistence({ refresh, feedback: feedback as never })
    )

    const ok = await result.current.saveMutation({
      request: {
        category: 'production_rates_walls',
        action: 'update',
        original_id: 'WALL_STD',
        values: {
          production_scope: 'walls',
          id: 'WALL_STD',
          scope_id: 'WALLS',
          display_name: 'Walls',
          surface_type: '',
          condition: '',
          prep_sqft_per_hr: '',
          sqft_per_hr: '120',
          primer_sqft_per_hr: '',
          notes: '',
          active: 'Y',
        },
      },
      keepId: 'WALL_STD',
      notice: 'Saved Wall Production.',
    })

    expect(ok).toBe(true)
    expect(refresh).toHaveBeenCalledWith('WALL_STD')
    expect(feedback.setSuccessNotice).toHaveBeenCalledWith('Saved Wall Production.')
  })

  it('replaces success flow with an action error when the mutation fails', async () => {
    const feedback = createFeedback()
    const refresh = vi.fn()
    mutateRatesFlags.mockRejectedValue(new Error('Archive failed.'))

    const { result } = renderHook(() =>
      useQuoteRatesPersistence({ refresh, feedback: feedback as never })
    )

    const ok = await result.current.archiveToggle({
      request: {
        category: 'production_rates_walls',
        action: 'archive',
        rowId: 'WALL_STD',
      },
    })

    expect(ok).toBe(false)
    expect(refresh).not.toHaveBeenCalled()
    expect(feedback.setErrorMessage).toHaveBeenCalledWith('Archive failed.')
  })
})
