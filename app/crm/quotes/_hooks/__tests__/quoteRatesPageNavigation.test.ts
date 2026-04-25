import { describe, expect, it } from 'vitest'
import {
  applyNavigationIntent,
  buildQuoteRatesResourceSyncAction,
  buildQuoteRatesSelectionSnapshot,
  buildQuoteRatesTransitionPlan,
  getQuoteRatesIntentChanged,
  getFilteredRows,
  getNextSelectedId,
} from '../quoteRatesPageNavigation'
import {
  DEFAULT_QUOTE_RATES_NAVIGATION,
  createInitialQuoteRatesWorkflowState,
  getDefaultRateCategory,
  quoteRatesPageReducer,
  transitionNeedsDiscardReset,
  type QuoteRatesNavigationState,
} from '../quoteRatesPageState'
import {
  FLAGS_SECTIONS,
  RATE_SUBGROUPS,
  ROOM_DEFAULTS_SECTIONS,
} from '../quoteRatesPageConfig'
import type { RatesFlagsPayload } from '@/types/estimator/ratesFlags'
import {
  ratesFlagsEditableCategoryKeys,
  ratesFlagsEditableCategoryRegistry,
} from '@/types/estimator/ratesFlags'

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
  it('places every editable category exactly once in the matching UI navigation group', () => {
    const uiEntries = [
      ...Object.entries(RATE_SUBGROUPS).flatMap(([group, items]) =>
        items.map((item) => ({ ...item, group }))
      ),
      ...FLAGS_SECTIONS.map((item) => ({ ...item, group: item.key })),
      ...ROOM_DEFAULTS_SECTIONS.map((item) => ({ ...item, group: item.key })),
    ]
    const uiKeys = uiEntries.map((entry) => entry.key)

    expect([...uiKeys].sort()).toEqual([...ratesFlagsEditableCategoryKeys].sort())

    for (const categoryKey of ratesFlagsEditableCategoryKeys) {
      const entries = uiEntries.filter((entry) => entry.key === categoryKey)
      const registration = ratesFlagsEditableCategoryRegistry.find(
        (category) => category.key === categoryKey
      )

      expect(entries, categoryKey).toHaveLength(1)
      expect(registration, categoryKey).toBeDefined()
      if (!registration) throw new Error(`Missing registry entry for ${categoryKey}`)

      expect(entries[0].group, categoryKey).toBe(registration.navigationGroup)
      expect(entries[0].label, categoryKey).toBe(registration.navigationLabel)
      if (registration.navigationGroup in RATE_SUBGROUPS) {
        expect(registration.tab, categoryKey).toBe('rates')
      } else if (FLAGS_SECTIONS.some((section) => section.key === registration.key)) {
        expect(registration.tab, categoryKey).toBe('flags')
      } else {
        expect(registration.tab, categoryKey).toBe('room_defaults')
      }
    }
  })

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

  it('detects whether a navigation intent would change the current workflow state', () => {
    const state = {
      ...createInitialQuoteRatesWorkflowState(),
      selectedId: 'wall-rate-1',
    }

    expect(getQuoteRatesIntentChanged(state, { type: 'setSearch', search: '' })).toBe(false)
    expect(getQuoteRatesIntentChanged(state, { type: 'setSearch', search: 'tall' })).toBe(true)
    expect(getQuoteRatesIntentChanged(state, { type: 'setSelectedId', selectedId: 'wall-rate-1' }))
      .toBe(false)
    expect(getQuoteRatesIntentChanged(state, { type: 'setSelectedId', selectedId: 'wall-rate-2' }))
      .toBe(true)
    expect(getQuoteRatesIntentChanged(state, { type: 'reload' })).toBe(true)
  })

  it('plans tab, filter, selection, reload, and activation intents without controller state', () => {
    expect(
      buildQuoteRatesTransitionPlan(DEFAULT_QUOTE_RATES_NAVIGATION, {
        type: 'setActiveTab',
        activeTab: 'flags',
      })
    ).toMatchObject({
      kind: 'navigation',
      navigation: { activeTab: 'flags' },
      preserveSelectedId: false,
    })

    expect(
      buildQuoteRatesTransitionPlan(DEFAULT_QUOTE_RATES_NAVIGATION, {
        type: 'setSearch',
        search: 'tall',
      })
    ).toMatchObject({
      kind: 'navigation',
      navigation: { search: 'tall' },
      preserveSelectedId: true,
    })

    expect(
      buildQuoteRatesTransitionPlan(DEFAULT_QUOTE_RATES_NAVIGATION, {
        type: 'setSelectedId',
        selectedId: 'wall-rate-2',
      })
    ).toEqual({ kind: 'selection', selectedId: 'wall-rate-2' })
    expect(buildQuoteRatesTransitionPlan(DEFAULT_QUOTE_RATES_NAVIGATION, { type: 'reload' }))
      .toEqual({ kind: 'reload', keepId: undefined })
    expect(
      buildQuoteRatesTransitionPlan(DEFAULT_QUOTE_RATES_NAVIGATION, {
        type: 'archiveOrReactivate',
        nextActive: false,
      })
    ).toEqual({ kind: 'archiveOrReactivate', nextActive: false })
  })

  it('preserves a create draft during ordinary resource sync', () => {
    const initialState = createInitialQuoteRatesWorkflowState()
    const initialSync = buildQuoteRatesResourceSyncAction(initialState, payload)
    expect(initialSync?.type).toBe('resourceReconciled')

    const selectedState = quoteRatesPageReducer(initialState, initialSync!)
    const createDraft = {
      ...selectedState.draft!,
      id: 'wall-rate-new',
      display_name: 'Unsaved create',
    } as NonNullable<typeof selectedState.draft>
    const createState = quoteRatesPageReducer(selectedState, {
      type: 'createStarted',
      draft: createDraft,
    })

    const refreshedPayload: RatesFlagsPayload = {
      ...payload,
      template_version: 3,
      categories: [
        {
          ...payload.categories[0],
          rows: [
            {
              ...payload.categories[0].rows[0],
              display_name: 'Server changed row',
            },
          ],
        },
        ...payload.categories.slice(1),
      ],
    }

    const syncAction = buildQuoteRatesResourceSyncAction(createState, refreshedPayload)

    expect(syncAction).toBeNull()
    expect(createState.editorMode).toBe('create')
    expect(createState.draft).toMatchObject({
      id: 'wall-rate-new',
      display_name: 'Unsaved create',
    })
  })

  it('force rehydrates a create draft from refreshed resource data', () => {
    const initialSync = buildQuoteRatesResourceSyncAction(
      createInitialQuoteRatesWorkflowState(),
      payload
    )
    const selectedState = quoteRatesPageReducer(createInitialQuoteRatesWorkflowState(), initialSync!)
    const createDraft = {
      ...selectedState.draft!,
      id: 'wall-rate-new',
      display_name: 'Unsaved create',
    } as NonNullable<typeof selectedState.draft>
    const createState = quoteRatesPageReducer(selectedState, {
      type: 'createStarted',
      draft: createDraft,
    })
    const refreshState = quoteRatesPageReducer(createState, {
      type: 'refreshRehydrateChanged',
      selectedId: 'wall-rate-1',
      force: true,
    })
    const refreshedPayload: RatesFlagsPayload = {
      ...payload,
      template_version: 4,
      categories: [
        {
          ...payload.categories[0],
          rows: [
            {
              ...payload.categories[0].rows[0],
              display_name: 'Force refreshed row',
            },
          ],
        },
        ...payload.categories.slice(1),
      ],
    }

    const syncAction = buildQuoteRatesResourceSyncAction(refreshState, refreshedPayload)

    expect(syncAction).toMatchObject({
      type: 'resourceReconciled',
      preserveCreateDraft: false,
    })

    const syncedState = quoteRatesPageReducer(refreshState, syncAction!)
    expect(syncedState.editorMode).toBe('selection')
    expect(syncedState.selectedId).toBe('wall-rate-1')
    expect(syncedState.draft).toMatchObject({
      display_name: 'Force refreshed row',
    })
  })
})
