import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EstimateV2TrimTypePicker } from '../EstimateV2TrimTypePicker'
import type { EstimateV2TrimTypeOption } from '@/types/estimator/v2'

const baseStyles = {
  input: { border: '1px solid #333', background: '#111', color: '#fff', padding: 8, borderRadius: 6 },
  mono: { fontFamily: 'monospace', fontSize: 12 },
}

const mockOptions: EstimateV2TrimTypeOption[] = [
  {
    id: 'BASE_STD',
    label: 'Standard Baseboard',
    family: 'BASEBOARD',
    category: 'BASEBOARD',
    unit_type: 'LF',
    helper_allowed: true,
    default_production_rate_id: 'TRIM_BASE',
    trim_category: 'base',
    measurement_class: 'linear',
    picker_group: 'base_molding',
  },
  {
    id: 'CROWN_5',
    label: '5" Crown Molding',
    family: 'CROWN',
    category: 'CROWN',
    unit_type: 'LF',
    helper_allowed: true,
    default_production_rate_id: 'TRIM_CROWN',
    trim_category: 'crown',
    measurement_class: 'linear',
    picker_group: 'crown_molding',
  },
  {
    id: 'CASING_STD',
    label: 'Standard Casing',
    family: 'CASING',
    category: 'CASING',
    unit_type: 'LF',
    helper_allowed: false,
    default_production_rate_id: 'TRIM_CASING',
    trim_category: 'casing',
    measurement_class: 'linear',
    picker_group: 'casing',
  },
  {
    id: 'DOOR_PREHUNG',
    label: 'Prehung Door',
    family: 'DOOR',
    category: 'DOOR',
    unit_type: 'EA',
    helper_allowed: false,
    default_production_rate_id: 'TRIM_DOOR',
    trim_category: 'door_window',
    measurement_class: 'opening',
    picker_group: 'doors_windows',
  },
  {
    id: 'PANEL_WAINSCOT',
    label: 'Wainscot Panel',
    family: 'PANEL',
    category: 'PANEL',
    unit_type: 'SF',
    helper_allowed: false,
    default_production_rate_id: 'TRIM_PANEL',
    trim_category: 'panel',
    measurement_class: 'surface',
    picker_group: 'panels',
  },
  {
    id: 'CHAIR_RAIL',
    label: 'Chair Rail',
    family: 'RAIL',
    category: 'RAIL',
    unit_type: 'LF',
    helper_allowed: true,
    default_production_rate_id: 'TRIM_RAIL',
    trim_category: 'rail',
    measurement_class: 'linear',
    picker_group: 'rail',
  },
  {
    id: 'BUILTIN_BOOKCASE',
    label: 'Built-in Bookcase',
    family: 'FEATURE',
    category: 'FEATURE',
    unit_type: 'LF',
    helper_allowed: false,
    default_production_rate_id: 'TRIM_FEATURE',
    trim_category: 'feature',
    measurement_class: 'assembly',
    picker_group: 'features',
  },
  {
    id: 'MISC_TRIM',
    label: 'Miscellaneous Trim',
    family: 'OTHER',
    category: 'OTHER',
    unit_type: 'LF',
    helper_allowed: false,
    default_production_rate_id: null,
    trim_category: 'other',
    measurement_class: 'linear',
    picker_group: 'other',
  },
  {
    id: 'NO_META',
    label: 'Legacy Trim Item',
    family: null,
    category: null,
    unit_type: 'LF',
    helper_allowed: false,
    default_production_rate_id: null,
    trim_category: null,
    measurement_class: null,
    picker_group: null,
  },
]

describe('EstimateV2TrimTypePicker', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders trigger button with placeholder when no value selected', () => {
    const onChange = vi.fn()
    render(
      <EstimateV2TrimTypePicker
        value=""
        options={mockOptions}
        onChange={onChange}
        styles={baseStyles}
      />
    )
    expect(screen.getByText('-- select trim type --')).toBeInTheDocument()
  })

  it('renders trigger button with selected option label', () => {
    const onChange = vi.fn()
    render(
      <EstimateV2TrimTypePicker
        value="BASE_STD"
        options={mockOptions}
        onChange={onChange}
        styles={baseStyles}
      />
    )
    expect(screen.getByText('Standard Baseboard')).toBeInTheDocument()
  })

  it('shows category label next to selected option when trim_category is set', () => {
    const onChange = vi.fn()
    render(
      <EstimateV2TrimTypePicker
        value="CROWN_5"
        options={mockOptions}
        onChange={onChange}
        styles={baseStyles}
      />
    )
    expect(screen.queryByText('Standard Baseboard')).not.toBeInTheDocument()
    expect(screen.getByText('5" Crown Molding')).toBeInTheDocument()
    // The category label "Crown Molding" should appear next to the selected label
    expect(screen.getByText('Crown Molding')).toBeInTheDocument()
  })

  it('opens dropdown on click', () => {
    const onChange = vi.fn()
    render(
      <EstimateV2TrimTypePicker
        value=""
        options={mockOptions}
        onChange={onChange}
        styles={baseStyles}
      />
    )
    const trigger = screen.getByText('-- select trim type --').closest('button')!
    fireEvent.click(trigger)
    expect(screen.getByPlaceholderText('Search trim types...')).toBeInTheDocument()
  })

  it('displays category chips in the dropdown', () => {
    const onChange = vi.fn()
    render(
      <EstimateV2TrimTypePicker
        value=""
        options={mockOptions}
        onChange={onChange}
        styles={baseStyles}
      />
    )
    const trigger = screen.getByText('-- select trim type --').closest('button')!
    fireEvent.click(trigger)

    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Linear')).toBeInTheDocument()
    expect(screen.getByText('Base')).toBeInTheDocument()
    expect(screen.getByText('Crown')).toBeInTheDocument()
    expect(screen.getByText('Casing')).toBeInTheDocument()
    expect(screen.getByText('Doors/Windows')).toBeInTheDocument()
    expect(screen.getByText('Panel')).toBeInTheDocument()
    expect(screen.getAllByText('Features').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Other').length).toBeGreaterThan(0)
  })

  it('filters options by the Linear chip', () => {
    const onChange = vi.fn()
    render(
      <EstimateV2TrimTypePicker
        value=""
        options={mockOptions}
        onChange={onChange}
        styles={baseStyles}
      />
    )
    const trigger = screen.getByText('-- select trim type --').closest('button')!
    fireEvent.click(trigger)

    fireEvent.click(screen.getByText('Linear'))

    expect(screen.getByText('Standard Baseboard')).toBeInTheDocument()
    expect(screen.queryByText('Built-in Bookcase')).not.toBeInTheDocument()
    expect(screen.queryByText('Prehung Door')).not.toBeInTheDocument()
  })

  it('filters options by category chip', () => {
    const onChange = vi.fn()
    render(
      <EstimateV2TrimTypePicker
        value=""
        options={mockOptions}
        onChange={onChange}
        styles={baseStyles}
      />
    )
    const trigger = screen.getByText('-- select trim type --').closest('button')!
    fireEvent.click(trigger)

    // Click "Base" chip
    fireEvent.click(screen.getByText('Base'))
    // Should show Standard Baseboard but not Crown Molding
    expect(screen.getByText('Standard Baseboard')).toBeInTheDocument()
    expect(screen.queryByText('5" Crown Molding')).not.toBeInTheDocument()
  })

  it('infers canonical category for legacy fallback rows', () => {
    const onChange = vi.fn()
    render(
      <EstimateV2TrimTypePicker
        value=""
        options={[
          {
            id: 'LEGACY_BASE',
            label: 'Legacy Baseboard',
            family: 'BASEBOARD',
            category: 'BASEBOARD',
            unit_type: 'LF',
            helper_allowed: false,
            default_production_rate_id: 'TRIM_BASE',
          },
          {
            id: 'LEGACY_FIREPLACE',
            label: 'Fireplace Mantel',
            family: 'FEATURE',
            category: 'FEATURE',
            unit_type: 'LF',
            helper_allowed: false,
            default_production_rate_id: 'TRIM_FEATURE',
          },
        ]}
        onChange={onChange}
        styles={baseStyles}
      />
    )
    const trigger = screen.getByText('-- select trim type --').closest('button')!
    fireEvent.click(trigger)

    fireEvent.click(screen.getByText('Base'))
    expect(screen.getByText('Legacy Baseboard')).toBeInTheDocument()
    expect(screen.queryByText('Fireplace Mantel')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Features'))
    expect(screen.getByText('Fireplace Mantel')).toBeInTheDocument()
    expect(screen.getByText('Assembly')).toBeInTheDocument()
  })

  it('filters options by search query', () => {
    const onChange = vi.fn()
    render(
      <EstimateV2TrimTypePicker
        value=""
        options={mockOptions}
        onChange={onChange}
        styles={baseStyles}
      />
    )
    const trigger = screen.getByText('-- select trim type --').closest('button')!
    fireEvent.click(trigger)

    const searchInput = screen.getByPlaceholderText('Search trim types...')
    fireEvent.change(searchInput, { target: { value: 'crown' } })

    // Should show Crown Molding but not Standard Baseboard
    expect(screen.getByText('5" Crown Molding')).toBeInTheDocument()
    expect(screen.queryByText('Standard Baseboard')).not.toBeInTheDocument()
  })

  it('searches by production rate id', () => {
    const onChange = vi.fn()
    render(
      <EstimateV2TrimTypePicker
        value=""
        options={mockOptions}
        onChange={onChange}
        styles={baseStyles}
      />
    )
    const trigger = screen.getByText('-- select trim type --').closest('button')!
    fireEvent.click(trigger)

    const searchInput = screen.getByPlaceholderText('Search trim types...')
    fireEvent.change(searchInput, { target: { value: 'TRIM_BASE' } })

    expect(screen.getByText('Standard Baseboard')).toBeInTheDocument()
    expect(screen.queryByText('5" Crown Molding')).not.toBeInTheDocument()
  })

  it('calls onChange when an option is selected', () => {
    const onChange = vi.fn()
    render(
      <EstimateV2TrimTypePicker
        value=""
        options={mockOptions}
        onChange={onChange}
        styles={baseStyles}
      />
    )
    const trigger = screen.getByText('-- select trim type --').closest('button')!
    fireEvent.click(trigger)

    const option = screen.getByText('Standard Baseboard').closest('button')!
    fireEvent.click(option)

    expect(onChange).toHaveBeenCalledWith('BASE_STD')
  })

  it('closes dropdown after selection', () => {
    const onChange = vi.fn()
    render(
      <EstimateV2TrimTypePicker
        value=""
        options={mockOptions}
        onChange={onChange}
        styles={baseStyles}
      />
    )
    const trigger = screen.getByText('-- select trim type --').closest('button')!
    fireEvent.click(trigger)
    expect(screen.getByPlaceholderText('Search trim types...')).toBeInTheDocument()

    const option = screen.getByText('Standard Baseboard').closest('button')!
    fireEvent.click(option)

    // Dropdown should be closed
    expect(screen.queryByPlaceholderText('Search trim types...')).not.toBeInTheDocument()
  })

  it('shows grouped options with category headers', () => {
    const onChange = vi.fn()
    render(
      <EstimateV2TrimTypePicker
        value=""
        options={mockOptions}
        onChange={onChange}
        styles={baseStyles}
      />
    )
    const trigger = screen.getByText('-- select trim type --').closest('button')!
    fireEvent.click(trigger)

    // Category headers should be visible
    expect(screen.getByText('Base Molding')).toBeInTheDocument()
    expect(screen.getByText('Crown Molding')).toBeInTheDocument()
    expect(screen.getByText('Casing / Door')).toBeInTheDocument()
    expect(screen.getByText('Doors & Windows')).toBeInTheDocument()
    expect(screen.getByText('Panels / Wainscot')).toBeInTheDocument()
    expect(screen.getByText('Rail / Chair')).toBeInTheDocument()
    expect(screen.getAllByText('Features').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Other').length).toBeGreaterThan(0)
  })

  it('shows compact metadata (id, unit_type, rate id) for each option', () => {
    const onChange = vi.fn()
    render(
      <EstimateV2TrimTypePicker
        value=""
        options={mockOptions}
        onChange={onChange}
        styles={baseStyles}
      />
    )
    const trigger = screen.getByText('-- select trim type --').closest('button')!
    fireEvent.click(trigger)

    // Compact metadata should show id and rate
    expect(screen.getByText('BASE_STD')).toBeInTheDocument()
    expect(screen.getByText('rate: TRIM_BASE')).toBeInTheDocument()
  })

  it('shows measurement class label on the right side', () => {
    const onChange = vi.fn()
    render(
      <EstimateV2TrimTypePicker
        value=""
        options={mockOptions}
        onChange={onChange}
        styles={baseStyles}
      />
    )
    const trigger = screen.getByText('-- select trim type --').closest('button')!
    fireEvent.click(trigger)

    // Measurement class labels should be visible
    expect(screen.getAllByText('LF').length).toBeGreaterThan(0)
    expect(screen.getByText('Opening')).toBeInTheDocument()
    expect(screen.getAllByText('SF').length).toBeGreaterThan(0)
    expect(screen.getByText('Assembly')).toBeInTheDocument()
  })

  it('shows "No matching trim types" when filter yields no results', () => {
    const onChange = vi.fn()
    render(
      <EstimateV2TrimTypePicker
        value=""
        options={mockOptions}
        onChange={onChange}
        styles={baseStyles}
      />
    )
    const trigger = screen.getByText('-- select trim type --').closest('button')!
    fireEvent.click(trigger)

    const searchInput = screen.getByPlaceholderText('Search trim types...')
    fireEvent.change(searchInput, { target: { value: 'zzzzz_nonexistent' } })

    expect(screen.getByText('No matching trim types')).toBeInTheDocument()
  })

  it('closes on Escape key', () => {
    const onChange = vi.fn()
    render(
      <EstimateV2TrimTypePicker
        value=""
        options={mockOptions}
        onChange={onChange}
        styles={baseStyles}
      />
    )
    const trigger = screen.getByText('-- select trim type --').closest('button')!
    fireEvent.click(trigger)
    expect(screen.getByPlaceholderText('Search trim types...')).toBeInTheDocument()

    fireEvent.keyDown(trigger.closest('div')!, { key: 'Escape' })
    expect(screen.queryByPlaceholderText('Search trim types...')).not.toBeInTheDocument()
  })

  it('handles options without trim_category gracefully (legacy items)', () => {
    const onChange = vi.fn()
    render(
      <EstimateV2TrimTypePicker
        value="NO_META"
        options={mockOptions}
        onChange={onChange}
        styles={baseStyles}
      />
    )
    // Should render without crashing
    expect(screen.getByText('Legacy Trim Item')).toBeInTheDocument()
  })
})
