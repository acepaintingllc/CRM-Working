import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuoteRatesPage } from '../useQuoteRatesPage'

const { loadRatesFlags, mutateRatesFlags } = vi.hoisted(() => ({
  loadRatesFlags: vi.fn(),
  mutateRatesFlags: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  loadRatesFlags,
  mutateRatesFlags,
}))

describe('useQuoteRatesPage', () => {
  beforeEach(() => {
    loadRatesFlags.mockReset()
    mutateRatesFlags.mockReset()
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
    const duplicateDraft = result.current.editorVm.draft as unknown as {
      id: string
      sqft_per_hr: number | null
      helper_allowed: boolean
    }
    expect(duplicateDraft.id).toBe('wall-rate-1_COPY')
    expect(duplicateDraft.sqft_per_hr).toBe(150)
    expect(duplicateDraft.helper_allowed).toBe(true)

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

  it('exposes validation state instead of a generic error for invalid drafts', async () => {
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
          rows: [
            {
              id: 'wall-rate-1',
              display_name: 'Standard walls',
              notes: '',
              active: true,
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
      result.current.actions.startDuplicate()
      result.current.actions.updateDraftValue('display_name', '')
    })

    await act(async () => {
      await result.current.actions.saveCurrent()
    })

    expect(result.current.uiState.actionError).toBeNull()
    expect(result.current.uiState.validationError).toBe('Display Name is required.')
    expect(result.current.uiState.inlineValidation).toBe('Display Name is required.')
    expect(result.current.uiState.canSave).toBe(false)
    expect(mutateRatesFlags).not.toHaveBeenCalled()
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

  it('uses load errors as the shell-level status until retry succeeds', async () => {
    loadRatesFlags
      .mockRejectedValueOnce(new Error('Rates unavailable.'))
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
            fields: [],
            rows: [],
          },
        ],
      })

    const { result } = renderHook(() => useQuoteRatesPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    expect(result.current.uiState.loadError).toBe('Rates unavailable.')
    expect(result.current.uiState.pageBanner).toEqual({
      tone: 'error',
      message: 'Rates unavailable.',
    })
    expect(result.current.uiState.actionError).toBeNull()
    expect(result.current.uiState.canRetry).toBe(true)

    await act(async () => {
      await result.current.actions.reload()
    })

    await waitFor(() => {
      expect(result.current.uiState.loadError).toBeNull()
    })
  })

  it('keeps an explicit selection when reload is asked to retain a row id', async () => {
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
            fields: [],
            rows: [
              { id: 'wall-rate-1', display_name: 'Standard walls', notes: '', active: true },
              { id: 'wall-rate-2', display_name: 'Tall walls', notes: '', active: true },
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
            columns: [],
            fields: [],
            rows: [
              { id: 'wall-rate-2', display_name: 'Tall walls', notes: '', active: true },
              { id: 'wall-rate-1', display_name: 'Standard walls', notes: '', active: true },
            ],
          },
        ],
      })

    const { result } = renderHook(() => useQuoteRatesPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.setSelectedId('wall-rate-2')
    })

    await act(async () => {
      await result.current.actions.reload('wall-rate-2')
    })

    expect(result.current.tableVm.selectedId).toBe('wall-rate-2')
    expect(result.current.tableVm.selectedRow?.id).toBe('wall-rate-2')
  })

  it('hides stale success notices behind validation and replaces them on mutation failure', async () => {
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
          rows: [
            {
              id: 'wall-rate-1',
              display_name: 'Standard walls',
              notes: '',
              active: true,
            },
          ],
        },
      ],
    })
    mutateRatesFlags
      .mockResolvedValueOnce({ data: true })
      .mockRejectedValueOnce(new Error('Archive failed.'))

    const { result } = renderHook(() => useQuoteRatesPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.startDuplicate()
      result.current.actions.updateDraftValue('id', 'wall-rate-2')
      result.current.actions.updateDraftValue('display_name', 'Wall rate 2')
    })

    await act(async () => {
      await result.current.actions.saveCurrent()
    })

    expect(result.current.uiState.notice).toBe('Created Wall Production.')
    expect(result.current.uiState.pageBanner?.tone).toBe('success')

    act(() => {
      result.current.actions.updateDraftValue('display_name', '')
    })

    expect(result.current.uiState.notice).toBe('Created Wall Production.')
    expect(result.current.uiState.pageBanner).toBeNull()
    expect(result.current.uiState.inlineValidation).toBe('Display Name is required.')

    act(() => {
      result.current.actions.cancelEdit()
    })

    await act(async () => {
      await result.current.actions.archiveOrReactivate(false)
    })

    expect(mutateRatesFlags).toHaveBeenLastCalledWith({
      category: 'production_rates_walls',
      action: 'archive',
      rowId: 'wall-rate-1',
    })
    expect(result.current.uiState.notice).toBeNull()
    expect(result.current.uiState.actionError).toBe('Archive failed.')
    expect(result.current.uiState.pageBanner).toEqual({
      tone: 'error',
      message: 'Archive failed.',
    })
  })

  it('reactivates an archived row through the typed activation mutation path', async () => {
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
            fields: [],
            rows: [
              {
                id: 'wall-rate-1',
                display_name: 'Archived walls',
                notes: '',
                active: false,
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
            fields: [],
            rows: [
              {
                id: 'wall-rate-1',
                display_name: 'Archived walls',
                notes: '',
                active: true,
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
      result.current.actions.setStatusFilter('archived')
    })

    await act(async () => {
      await result.current.actions.archiveOrReactivate(true)
    })

    expect(mutateRatesFlags).toHaveBeenCalledWith({
      category: 'production_rates_walls',
      action: 'reactivate',
      rowId: 'wall-rate-1',
    })
    expect(result.current.uiState.notice).toBe('Reactivated row.')
    expect(result.current.resource.data.categories[0]?.rows[0]?.active).toBe(true)
  })

  it('exposes discard state and protects row selection changes until confirmed', async () => {
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
          rows: [
            { id: 'wall-rate-1', display_name: 'Standard walls', notes: '', active: true },
            { id: 'wall-rate-2', display_name: 'Tall walls', notes: '', active: true },
          ],
        },
      ],
    })

    const { result } = renderHook(() => useQuoteRatesPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Edited walls')
      result.current.actions.setSelectedId('wall-rate-2')
    })

    expect(result.current.discardVm.isOpen).toBe(true)
    expect(result.current.discardVm.transitionType).toBe('setSelectedId')
    expect(result.current.tableVm.selectedId).toBe('wall-rate-1')
    expect(result.current.editorVm.isDirty).toBe(true)

    act(() => {
      result.current.actions.cancelDiscard()
    })

    expect(result.current.discardVm.isOpen).toBe(false)
    expect(result.current.tableVm.selectedId).toBe('wall-rate-1')
    expect(result.current.editorVm.draft).toMatchObject({
      display_name: 'Edited walls',
    })

    act(() => {
      result.current.actions.setSelectedId('wall-rate-2')
    })

    await act(async () => {
      await result.current.actions.confirmDiscard()
    })

    expect(result.current.tableVm.selectedId).toBe('wall-rate-2')
    expect(result.current.editorVm.isDirty).toBe(false)
    expect(result.current.editorVm.draft).toMatchObject({
      display_name: 'Tall walls',
    })
  })

  it('protects category and filter transitions until discard is confirmed', async () => {
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
          ],
          rows: [{ id: 'flag-1', display_name: 'High traffic', notes: '', active: true }],
        },
      ],
    })

    const { result } = renderHook(() => useQuoteRatesPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Dirty walls')
      result.current.actions.setActiveTab('flags')
    })

    expect(result.current.discardVm.transitionType).toBe('setActiveTab')
    expect(result.current.filtersVm.activeTab).toBe('rates')

    await act(async () => {
      await result.current.actions.confirmDiscard()
    })

    expect(result.current.filtersVm.activeTab).toBe('flags')
    expect(result.current.editorVm.isDirty).toBe(false)
    expect(result.current.editorVm.selectedRow?.id).toBe('flag-1')

    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Dirty flag')
      result.current.actions.setStatusFilter('archived')
    })

    expect(result.current.discardVm.transitionType).toBe('setStatusFilter')
    expect(result.current.filtersVm.statusFilter).toBe('active')

    act(() => {
      result.current.actions.cancelDiscard()
    })

    expect(result.current.filtersVm.statusFilter).toBe('active')
    expect(result.current.editorVm.draft).toMatchObject({
      display_name: 'Dirty flag',
    })
  })
})
