import { describe, expect, it } from 'vitest'
import type {
  RatesFlagsCategory,
  RatesFlagsEditableCategory,
  RatesFlagsRow,
} from '@/types/estimator/ratesFlags'
import type { QuoteRatesDataResource } from '../useQuoteRatesData'
import { buildQuoteRatesPageVm } from '../quoteRatesPageVm'
import {
  createInitialQuoteRatesWorkflowState,
  type QuoteRatesDerivedState,
  type QuoteRatesWorkflowState,
} from '../quoteRatesPageState'

const editableRow = {
  id: 'wall-rate-1',
  display_name: 'Standard walls',
  notes: '',
  active: true,
  production_scope: 'walls',
  scope_id: 'walls',
  surface_type: 'standard',
  condition: 'good',
  prep_sqft_per_hr: '100',
  sqft_per_hr: '150',
  primer_sqft_per_hr: '120',
} satisfies RatesFlagsRow

const editableCategory = {
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
  rows: [editableRow],
} satisfies RatesFlagsEditableCategory<'production_rates_walls'>

const legacyCategory = {
  key: 'unit_rates',
  tab: 'rates',
  group: 'legacy',
  label: 'Legacy Unit Rates',
  table_title: 'Legacy Unit Rates',
  description: 'Legacy rates',
  columns: [],
  fields: [
    { key: 'id', label: 'ID', type: 'text', required: true },
    { key: 'display_name', label: 'Display Name', type: 'text', required: true },
  ],
  rows: [],
} satisfies RatesFlagsCategory

function buildResource(category: RatesFlagsCategory): QuoteRatesDataResource {
  return {
    data: {
      source: 'db',
      seeded: true,
      template_version: 2,
      categories: [category],
    },
    setData: () => undefined,
    loading: false,
    error: null,
    setError: () => undefined,
    refresh: async () => true,
    attemptRefresh: async () => ({ ok: true, error: null, data: null }),
  }
}

function buildDerived(
  activeCategory: RatesFlagsCategory,
  editableActiveCategory: QuoteRatesDerivedState['editableActiveCategory']
): QuoteRatesDerivedState {
  return {
    activeCategory,
    editableActiveCategory,
    filteredRows: activeCategory.rows,
    selectedRow: activeCategory.rows[0] ?? null,
    adapter: null,
    validationResult: editableActiveCategory ? { ok: true } : null,
    validationError: null,
    isDirty: false,
  }
}

function buildVm(
  category: RatesFlagsCategory,
  derived: QuoteRatesDerivedState,
  workflowState: QuoteRatesWorkflowState = createInitialQuoteRatesWorkflowState()
) {
  return buildQuoteRatesPageVm({
    resource: buildResource(category),
    workflowState,
    derived,
  })
}

describe('quoteRatesPageVm', () => {
  it('marks editable categories as editable without showing the legacy notice', () => {
    const vm = buildVm(
      editableCategory,
      buildDerived(editableCategory, editableCategory)
    )

    expect(vm.editorVm.canEditCategory).toBe(true)
    expect(vm.editorVm.showLegacyCategoryNotice).toBe(false)
  })

  it('shows the legacy notice for selected non-editable categories', () => {
    const vm = buildVm(legacyCategory, buildDerived(legacyCategory, null))

    expect(vm.editorVm.canEditCategory).toBe(false)
    expect(vm.editorVm.showLegacyCategoryNotice).toBe(true)
  })

  it('does not show the legacy notice while create mode is active', () => {
    const workflowState = {
      ...createInitialQuoteRatesWorkflowState(),
      editorMode: 'create',
    } satisfies QuoteRatesWorkflowState

    const vm = buildVm(legacyCategory, buildDerived(legacyCategory, null), workflowState)

    expect(vm.editorVm.canEditCategory).toBe(false)
    expect(vm.editorVm.showLegacyCategoryNotice).toBe(false)
  })
})
