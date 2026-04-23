import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useQuoteRatesControllerActions } from '../useQuoteRatesControllerActions'
import type { RatesFlagsEditableCategory } from '@/types/estimator/ratesFlags'

const category: RatesFlagsEditableCategory<'production_rates_walls'> = {
  key: 'production_rates_walls',
  tab: 'rates',
  group: 'production_rates',
  label: 'Wall Production',
  table_title: 'Wall Production',
  description: 'Wall rates',
  columns: [],
  fields: [],
  rows: [
    {
      id: 'WALL_STD',
      display_name: 'Standard walls',
      notes: '',
      active: true,
      production_scope: 'walls',
      scope_id: 'WALLS',
      surface_type: '',
      condition: '',
      prep_sqft_per_hr: '',
      sqft_per_hr: '120',
      primer_sqft_per_hr: '',
    },
  ],
}

describe('useQuoteRatesControllerActions', () => {
  it('archives through the typed activation request contract', async () => {
    const archiveToggle = vi.fn().mockResolvedValue(true)
    const { result } = renderHook(() =>
      useQuoteRatesControllerActions({
        filters: { activeCategory: category } as never,
        editor: { selectedRow: category.rows[0] } as never,
        persistence: { archiveToggle } as never,
        feedback: { clearFeedback: vi.fn() } as never,
        reload: vi.fn(),
      })
    )

    await result.current.archiveOrReactivate(false)

    expect(archiveToggle).toHaveBeenCalledWith({
      request: {
        category: 'production_rates_walls',
        action: 'archive',
        rowId: 'WALL_STD',
      },
    })
  })
})
