import { describe, expect, it } from 'vitest'
import {
  applyNavigationIntent,
  buildQuoteRatesSelectionSnapshot,
  getFilteredRows,
  getNextSelectedId,
} from '../quoteRatesPageNavigation'
import {
  DEFAULT_QUOTE_RATES_NAVIGATION,
  getDefaultRateCategory,
  transitionNeedsDiscardReset,
  type QuoteRatesNavigationState,
} from '../quoteRatesPageState'
import { RATE_SUBGROUPS } from '../quoteRatesPageConfig'
import type { RatesFlagsPayload } from '@/types/estimator/ratesFlags'

const payload: RatesFlagsPayload = {
  source: 'db',
  seeded: true,
  template_version: 2,
  categories: [
    {
      key: 'production_rates_walls',
      tab: 'rates',
      group: 'production_rates',
      label: 'Wall Production',
      table_title: 'Wall Production',
      description: 'Wall rates',
      columns: [],
      fields: [
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'display_name', label: 'Display Name', type: 'text', required: true },
      ],
      rows: [
        {
          id: 'wall-rate-1',
          display_name: 'Standard walls',
          notes: '',
          active: true,
          production_scope: 'walls',
          scope_id: 'scope-1',
          surface_type: 'paint',
          condition: 'normal',
          prep_sqft_per_hr: '100',
          sqft_per_hr: '100',
          primer_sqft_per_hr: '100',
        },
        {
          id: 'wall-rate-2',
          display_name: 'Tall walls',
          notes: '',
          active: false,
          production_scope: 'walls',
          scope_id: 'scope-2',
          surface_type: 'paint',
          condition: 'normal',
          prep_sqft_per_hr: '100',
          sqft_per_hr: '100',
          primer_sqft_per_hr: '100',
        },
      ],
    },
    {
      key: 'condition_modifiers',
      tab: 'flags',
      group: 'condition_modifiers',
      label: 'Condition Modifiers',
      table_title: 'Condition Modifiers',
      description: 'Flag rows',
      columns: [],
      fields: [
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'display_name', label: 'Display Name', type: 'text', required: true },
      ],
      rows: [
        {
          id: 'flag-1',
          display_name: 'High traffic',
          notes: '',
          active: true,
          wall_factor: '1',
          ceil_factor: '1',
          trim_factor: '1',
        },
      ],
    },
  ],
}

describe('quoteRatesPageNavigation invariants', () => {
  it('keeps preferred selection only when it remains visible in the filtered slice', () => {
    const rows = getFilteredRows(payload.categories[0], {
      search: '',
      statusFilter: 'active',
    })

    expect(getNextSelectedId(rows, 'wall-rate-2')).toBe('wall-rate-1')
    expect(getNextSelectedId(rows, 'wall-rate-1')).toBe('wall-rate-1')
  })

  it('rebuilds navigation with family-specific fallback categories on section switches', () => {
    const nextNavigation = applyNavigationIntent(DEFAULT_QUOTE_RATES_NAVIGATION, {
      type: 'setActiveTab',
      activeTab: 'flags',
    })
    expect(nextNavigation.activeTab).toBe('flags')

    const ratesNavigation = applyNavigationIntent(nextNavigation, {
      type: 'setRateSection',
      rateSection: 'unit_rates',
    })
    expect(ratesNavigation.activeTab).toBe('rates')
    expect(ratesNavigation.rateSection).toBe('unit_rates')
    expect(ratesNavigation.rateCategory).toBe('unit_rates_doors')
  })

  it('throws when a rate section has no configured subgroups', () => {
    const originalSubgroups = RATE_SUBGROUPS.production
    RATE_SUBGROUPS.production = []

    try {
      expect(() => getDefaultRateCategory('production')).toThrow(
        'No subgroups configured for rate section: production'
      )
    } finally {
      RATE_SUBGROUPS.production = originalSubgroups
    }
  })

  it('ignores setRateCategory intents with unknown category keys', () => {
    const nextNavigation = applyNavigationIntent(DEFAULT_QUOTE_RATES_NAVIGATION, {
      type: 'setRateCategory',
      rateCategory: 'not_a_real_category',
    })

    expect(nextNavigation).toBe(DEFAULT_QUOTE_RATES_NAVIGATION)
  })

  it('rebuilds the editor snapshot from the selected visible row', () => {
    const navigation: QuoteRatesNavigationState = {
      ...DEFAULT_QUOTE_RATES_NAVIGATION,
      statusFilter: 'all',
    }
    const selection = buildQuoteRatesSelectionSnapshot(payload, navigation, 'wall-rate-2')

    expect(selection.selectedId).toBe('wall-rate-2')
    expect(selection.filteredRows.map((row) => row.id)).toEqual(['wall-rate-1', 'wall-rate-2'])
    expect(selection.editor.selectedId).toBe('wall-rate-2')
    expect(selection.editor.editorMode).toBe('selection')
  })

  it('marks only reload and archive/reactivate intents as requiring discard reset', () => {
    expect(transitionNeedsDiscardReset({ type: 'reload', keepId: 'wall-rate-1' })).toBe(true)
    expect(transitionNeedsDiscardReset({ type: 'archiveOrReactivate', nextActive: false })).toBe(true)
    expect(transitionNeedsDiscardReset({ type: 'setSelectedId', selectedId: 'wall-rate-1' })).toBe(
      false
    )
  })

})
