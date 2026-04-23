import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import type { RatesFlagsPayload } from '@/types/estimator/ratesFlags'
import { useQuoteRatesFilters } from '../useQuoteRatesFilters'

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
        { key: 'notes', label: 'Notes', type: 'text' },
        { key: 'surface_type', label: 'Surface Type', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' },
        { key: 'sqft_per_hr', label: 'Sq Ft / Hr', type: 'number' },
      ],
      rows: [
        {
          id: 'wall-rate-1',
          display_name: 'Standard walls',
          notes: 'Main interior rate',
          active: true,
          production_scope: 'walls',
          scope_id: 'walls',
          surface_type: 'smooth',
          condition: 'occupied',
          prep_sqft_per_hr: '100',
          sqft_per_hr: '150',
          primer_sqft_per_hr: '120',
        },
        {
          id: 'wall-rate-2',
          display_name: 'Archive walls',
          notes: 'Legacy rate',
          active: false,
          production_scope: 'walls',
          scope_id: 'walls',
          surface_type: 'textured',
          condition: 'vacant',
          prep_sqft_per_hr: '90',
          sqft_per_hr: '130',
          primer_sqft_per_hr: '110',
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
        { key: 'notes', label: 'Notes', type: 'text' },
        { key: 'wall_factor', label: 'Wall Factor', type: 'number' },
      ],
      rows: [
        {
          id: 'flag-high-traffic',
          display_name: 'High traffic',
          notes: 'Heavy wear',
          active: true,
          wall_factor: '1.2',
          ceil_factor: '1.1',
          trim_factor: '1.05',
        },
      ],
    },
    {
      key: 'room_templates',
      tab: 'room_defaults',
      group: 'room_templates',
      label: 'Room Templates',
      table_title: 'Room Templates',
      description: 'Template rows',
      columns: [],
      fields: [
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'display_name', label: 'Display Name', type: 'text', required: true },
        { key: 'notes', label: 'Notes', type: 'text' },
        { key: 'room_type_id', label: 'Room Type', type: 'text' },
        { key: 'default_wall_rate_id', label: 'Wall Rate', type: 'text' },
      ],
      rows: [
        {
          id: 'template-bedroom',
          display_name: 'Bedroom reset',
          notes: 'Base template',
          active: true,
          room_type_id: 'room-bedroom',
          default_wall_rate_id: 'wall-rate-standard',
          default_ceil_rate_id: 'ceil-rate-standard',
          default_complexity_id: 'complexity-standard',
          default_wall_mode: 'two_coat',
          include_walls: 'Y',
          include_ceilings: 'Y',
          include_trim: 'N',
          include_doors: 'Y',
          include_drywall: 'N',
        },
      ],
    },
  ],
}

describe('useQuoteRatesFilters', () => {
  it('matches explicit row values without depending on serialized property names', () => {
    const { result } = renderHook(() => useQuoteRatesFilters({ payload }))

    act(() => {
      result.current.setSearch('occupied')
    })
    expect(result.current.filteredRows.map((row) => row.id)).toEqual(['wall-rate-1'])

    act(() => {
      result.current.setSearch('sqft_per_hr')
    })
    expect(result.current.filteredRows).toHaveLength(0)
  })

  it('applies status filtering before search matching', () => {
    const { result } = renderHook(() => useQuoteRatesFilters({ payload }))

    act(() => {
      result.current.setStatusFilter('archived')
    })
    expect(result.current.filteredRows.map((row) => row.id)).toEqual(['wall-rate-2'])

    act(() => {
      result.current.setSearch('active')
    })
    expect(result.current.filteredRows).toHaveLength(0)

    act(() => {
      result.current.setSearch('archived')
    })
    expect(result.current.filteredRows.map((row) => row.id)).toEqual(['wall-rate-2'])

    act(() => {
      result.current.setStatusFilter('all')
      result.current.setSearch('legacy rate')
    })
    expect(result.current.filteredRows.map((row) => row.id)).toEqual(['wall-rate-2'])
  })

  it('searches across flags and room-default categories using explicit fields', () => {
    const { result } = renderHook(() => useQuoteRatesFilters({ payload }))

    act(() => {
      result.current.setActiveTab('flags')
      result.current.setSearch('1.2')
    })
    expect(result.current.filteredRows.map((row) => row.id)).toEqual(['flag-high-traffic'])

    act(() => {
      result.current.setActiveTab('room_defaults')
      result.current.setRoomDefaultsSection('room_templates')
      result.current.setSearch('room-bedroom')
    })
    expect(result.current.filteredRows.map((row) => row.id)).toEqual(['template-bedroom'])
  })
})
