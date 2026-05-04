import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  QuoteRatesActions,
  QuoteRatesEditorVm,
} from '@/app/crm/quotes/_hooks/useQuoteRatesPage'
import type { RatesFlagsCategory, RatesFlagsRow } from '@/types/estimator/ratesFlags'
import { QuoteRatesEditorSection } from '../QuoteRatesEditorSection'

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
} satisfies RatesFlagsCategory

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

const actions = {
  saveCurrent: vi.fn(async () => undefined),
  cancelEdit: vi.fn(),
  setDraftActive: vi.fn(),
  updateDraftValue: vi.fn(),
  activateDraft: vi.fn(),
  formatDraftValue: vi.fn((fieldKey: string) =>
    fieldKey === 'display_name' ? 'Standard walls' : 'wall-rate-1'
  ),
} satisfies Pick<
  QuoteRatesActions,
  | 'saveCurrent'
  | 'cancelEdit'
  | 'setDraftActive'
  | 'updateDraftValue'
  | 'formatDraftValue'
  | 'activateDraft'
>

function buildEditorVm(overrides: Partial<QuoteRatesEditorVm> = {}): QuoteRatesEditorVm {
  return {
    draft: null,
    draftActive: true,
    isDirty: false,
    saving: false,
    busy: false,
    activeCategory: editableCategory,
    canEditCategory: true,
    showLegacyCategoryNotice: false,
    selectedRow: editableRow,
    isCreating: false,
    inlineValidation: null,
    canSave: true,
    activeSettingSet: null,
    draftSettingSet: null,
    editingSettingSet: null,
    canActivateDraft: false,
    activating: false,
    ...overrides,
  }
}

describe('QuoteRatesEditorSection', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders editor controls for editable categories', () => {
    render(
      <QuoteRatesEditorSection
        vm={buildEditorVm()}
        templateVersion={2}
        actions={actions}
      />
    )

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(screen.getByLabelText('Display Name *')).toHaveValue('Standard walls')
    expect(
      screen.queryByText('This category is a legacy data type and cannot be edited here.')
    ).not.toBeInTheDocument()
  })

  it('renders the legacy notice instead of editor controls for non-editable categories', () => {
    render(
      <QuoteRatesEditorSection
        vm={buildEditorVm({
          activeCategory: legacyCategory,
          canEditCategory: false,
          showLegacyCategoryNotice: true,
          selectedRow: null,
        })}
        templateVersion={2}
        actions={actions}
      />
    )

    expect(
      screen.getByText('This category is a legacy data type and cannot be edited here.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Display Name *')).not.toBeInTheDocument()
  })

  it('does not show the legacy notice when create mode is active', () => {
    render(
      <QuoteRatesEditorSection
        vm={buildEditorVm({
          activeCategory: legacyCategory,
          canEditCategory: false,
          showLegacyCategoryNotice: false,
          selectedRow: null,
          isCreating: true,
        })}
        templateVersion={2}
        actions={actions}
      />
    )

    expect(screen.getByRole('button', { name: 'Create row' })).toBeEnabled()
    expect(screen.getByLabelText('Display Name *')).toHaveValue('Standard walls')
    expect(
      screen.queryByText('This category is a legacy data type and cannot be edited here.')
    ).not.toBeInTheDocument()
  })

  it('renders checkbox group fields and serializes checked values in option order', () => {
    const category = {
      ...editableCategory,
      fields: [
        { key: 'scope', label: 'Applies To', type: 'checkbox_group', required: true, options: ['room', 'wall', 'ceiling', 'trim'] },
      ],
    } satisfies RatesFlagsCategory
    const checkboxActions = {
      ...actions,
      formatDraftValue: vi.fn(() => 'wall,trim'),
    }

    render(
      <QuoteRatesEditorSection
        vm={buildEditorVm({ activeCategory: category })}
        templateVersion={2}
        actions={checkboxActions}
      />
    )

    expect(screen.getByRole('checkbox', { name: 'wall' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'ceiling' })).not.toBeChecked()

    fireEvent.click(screen.getByRole('checkbox', { name: 'ceiling' }))

    expect(checkboxActions.updateDraftValue).toHaveBeenCalledWith(
      'scope',
      'wall,ceiling,trim'
    )
  })
})
