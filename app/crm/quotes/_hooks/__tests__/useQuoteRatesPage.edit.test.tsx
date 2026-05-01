import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuoteRatesPage } from '../useQuoteRatesPage'

import {
  getObjectValue,
} from './quoteRatesPageHook.testUtils'

const { loadRatesFlags, mutateRatesFlags } = vi.hoisted(() => ({
  loadRatesFlags: vi.fn(),
  mutateRatesFlags: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  loadRatesFlags,
  mutateRatesFlags,
}))

describe('useQuoteRatesPage editing', () => {
  beforeEach(() => {
    loadRatesFlags.mockReset()
    mutateRatesFlags.mockReset()
  })

  it('exposes a stable draft formatter through actions instead of the editor VM', async () => {
    loadRatesFlags.mockResolvedValueOnce({
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
          columns: [
            { key: 'display_name', label: 'Name' },
            { key: 'active', label: 'Status' },
          ],
          fields: [
            { key: 'id', label: 'ID', type: 'text', required: true },
            { key: 'display_name', label: 'Display Name', type: 'text', required: true },
            { key: 'sqft_per_hr', label: 'Sq Ft / Hr', type: 'number' },
          ],
          rows: [
            {
              id: 'WALL_RATE_1',
              display_name: 'Standard walls',
              notes: '',
              active: true,
              sqft_per_hr: '150',
            },
          ],
        },
      ],
    })

    const { result, rerender } = renderHook(() => useQuoteRatesPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    const formatDraftValue = result.current.actions.formatDraftValue

    expect('formatDraftValue' in result.current.editorVm).toBe(false)
    expect(formatDraftValue('sqft_per_hr')).toBe('150')

    rerender()

    expect(result.current.actions.formatDraftValue).toBe(formatDraftValue)
  })

  it('loads, filters, duplicates, and saves dense rates rows', async () => {
    loadRatesFlags
      .mockResolvedValueOnce({
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
            columns: [
              { key: 'display_name', label: 'Name' },
              { key: 'active', label: 'Status' },
            ],
            fields: [
              { key: 'id', label: 'ID', type: 'text', required: true },
              {
                key: 'production_scope',
                label: 'Production Scope',
                type: 'select',
                readOnly: true,
                options: ['walls'],
                writeDefault: 'walls',
              },
              { key: 'display_name', label: 'Display Name', type: 'text', required: true },
              { key: 'sqft_per_hr', label: 'Sq Ft / Hr', type: 'number' },
              { key: 'helper_allowed', label: 'Helper Allowed', type: 'select', options: ['Y', 'N'] },
            ],
            rows: [
              {
                id: 'wall-rate-1',
                display_name: 'Standard walls',
                notes: '',
                active: true,
                sqft_per_hr: '150',
                helper_allowed: 'Y',
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
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
            columns: [
              { key: 'display_name', label: 'Name' },
              { key: 'active', label: 'Status' },
            ],
            fields: [
              { key: 'id', label: 'ID', type: 'text', required: true },
              {
                key: 'production_scope',
                label: 'Production Scope',
                type: 'select',
                readOnly: true,
                options: ['walls'],
                writeDefault: 'walls',
              },
              { key: 'display_name', label: 'Display Name', type: 'text', required: true },
              { key: 'sqft_per_hr', label: 'Sq Ft / Hr', type: 'number' },
              { key: 'helper_allowed', label: 'Helper Allowed', type: 'select', options: ['Y', 'N'] },
            ],
            rows: [
              {
                id: 'wall-rate-1',
                display_name: 'Standard walls',
                notes: '',
                active: true,
                sqft_per_hr: '150',
                helper_allowed: 'Y',
              },
              {
                id: 'wall-rate-1_COPY',
                display_name: 'Duplicated walls',
                notes: '',
                active: true,
                sqft_per_hr: '175.5',
                helper_allowed: 'N',
              },
            ],
          },
        ],
      })
    mutateRatesFlags.mockResolvedValue({ data: true })

    const { result } = renderHook(() => useQuoteRatesPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    expect(result.current.tableVm.selectedRow?.id).toBe('wall-rate-1')

    act(() => {
      result.current.actions.setSearch('standard')
    })
    expect(result.current.tableVm.filteredRows).toHaveLength(1)

    act(() => {
      result.current.actions.setSearch('')
      result.current.actions.startDuplicate()
    })

    expect(result.current.tableVm.isCreating).toBe(true)
    const duplicateDraft = result.current.editorVm.draft
    expect(getObjectValue(duplicateDraft, 'id')).toBe('wall-rate-1_COPY')
    expect(getObjectValue(duplicateDraft, 'sqft_per_hr')).toBe(150)
    expect(getObjectValue(duplicateDraft, 'helper_allowed')).toBe(true)

    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Duplicated walls')
      result.current.actions.updateDraftValue('sqft_per_hr', '175.5')
      result.current.actions.updateDraftValue('helper_allowed', 'N')
    })

    await act(async () => {
      await result.current.actions.saveCurrent()
    })

    expect(mutateRatesFlags).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'production_rates_walls',
        action: 'create',
        values: expect.objectContaining({
          production_scope: 'walls',
          id: 'wall-rate-1_COPY',
          display_name: 'Duplicated walls',
          sqft_per_hr: '175.5',
          active: 'Y',
        }),
      })
    )
    expect(result.current.uiState.notice).toBe('Created Wall Production.')
    expect(result.current.uiState.pageBanner).toEqual({
      tone: 'success',
      message: 'Created Wall Production.',
    })
    await waitFor(() => {
      expect(result.current.tableVm.selectedId).toBe('wall-rate-1_COPY')
    })
    expect(result.current.tableVm.selectedRow?.id).toBe('wall-rate-1_COPY')
  })

  it('updates an existing row through the typed adapter mutation path', async () => {
    loadRatesFlags
      .mockResolvedValueOnce({
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
              {
                key: 'production_scope',
                label: 'Production Scope',
                type: 'select',
                readOnly: true,
                options: ['walls'],
                writeDefault: 'walls',
              },
              { key: 'display_name', label: 'Display Name', type: 'text', required: true },
              { key: 'sqft_per_hr', label: 'Sq Ft / Hr', type: 'number' },
            ],
            rows: [
              {
                id: 'wall-rate-1',
                display_name: 'Standard walls',
                notes: '',
                active: true,
                sqft_per_hr: '150',
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        source: 'db',
        seeded: true,
        template_version: 3,
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
              {
                key: 'production_scope',
                label: 'Production Scope',
                type: 'select',
                readOnly: true,
                options: ['walls'],
                writeDefault: 'walls',
              },
              { key: 'display_name', label: 'Display Name', type: 'text', required: true },
              { key: 'sqft_per_hr', label: 'Sq Ft / Hr', type: 'number' },
            ],
            rows: [
              {
                id: 'wall-rate-1',
                display_name: 'Updated walls',
                notes: '',
                active: true,
                sqft_per_hr: '165',
              },
            ],
          },
        ],
      })
    mutateRatesFlags.mockResolvedValue({ data: true })

    const { result } = renderHook(() => useQuoteRatesPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Updated walls')
      result.current.actions.updateDraftValue('sqft_per_hr', '165')
    })

    await act(async () => {
      await result.current.actions.saveCurrent()
    })

    expect(mutateRatesFlags).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'production_rates_walls',
        action: 'update',
        original_id: 'wall-rate-1',
        values: expect.objectContaining({
          production_scope: 'walls',
          id: 'wall-rate-1',
          display_name: 'Updated walls',
          sqft_per_hr: '165',
        }),
      })
    )
    expect(result.current.uiState.notice).toBe('Saved Wall Production.')
    expect(result.current.tableVm.selectedRow?.display_name).toBe('Updated walls')
  })

  it('switches rate sections with an explicit category fallback and selection reset', async () => {
    loadRatesFlags.mockResolvedValue({
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
          rows: [{ id: 'wall-rate-1', display_name: 'Standard walls', notes: '', active: true }],
        },
        {
          key: 'unit_rates_doors',
          tab: 'rates',
          group: 'unit_rates',
          label: 'Door Unit Rates',
          table_title: 'Door Unit Rates',
          description: 'Door unit rates',
          columns: [],
          fields: [
            { key: 'id', label: 'ID', type: 'text', required: true },
            { key: 'display_name', label: 'Display Name', type: 'text', required: true },
          ],
          rows: [{ id: 'door-rate-1', display_name: 'Standard door', notes: '', active: true }],
        },
      ],
    })

    const { result } = renderHook(() => useQuoteRatesPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    expect(result.current.filtersVm.rateCategory).toBe('production_rates_walls')
    expect(result.current.tableVm.selectedRow?.id).toBe('wall-rate-1')

    act(() => {
      result.current.actions.setRateSection('unit_rates')
    })

    expect(result.current.filtersVm.activeTab).toBe('rates')
    expect(result.current.filtersVm.rateSection).toBe('unit_rates')
    expect(result.current.filtersVm.rateCategory).toBe('unit_rates_doors')
    expect(result.current.tableVm.selectedRow?.id).toBe('door-rate-1')
  })

  it('searches across flags and room-default categories after explicit section switches', async () => {
    loadRatesFlags.mockResolvedValue({
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
          rows: [{ id: 'wall-rate-1', display_name: 'Standard walls', notes: '', active: true }],
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
          ],
          rows: [
            {
              id: 'template-bedroom',
              display_name: 'Bedroom reset',
              notes: 'Base template',
              active: true,
              room_type_id: 'room-bedroom',
              default_wall_rate_id: 'wall-rate-1',
              default_ceil_rate_id: '',
              default_complexity_id: '',
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
    })

    const { result } = renderHook(() => useQuoteRatesPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.setActiveTab('flags')
    })
    act(() => {
      result.current.actions.setSearch('1.2')
    })

    expect(result.current.tableVm.filteredRows.map((row) => row.id)).toEqual(['flag-high-traffic'])

    act(() => {
      result.current.actions.setRoomDefaultsSection('room_templates')
    })
    act(() => {
      result.current.actions.setSearch('room-bedroom')
    })

    expect(result.current.filtersVm.activeTab).toBe('room_defaults')
    expect(result.current.tableVm.filteredRows.map((row) => row.id)).toEqual(['template-bedroom'])
  })
})
