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
    mutateRatesFlags.mockResolvedValue({ data: true })

    const { result } = renderHook(() => useQuoteRatesPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    expect(result.current.selectedRow?.id).toBe('wall-rate-1')

    act(() => {
      result.current.setSearch('standard')
    })
    expect(result.current.filteredRows).toHaveLength(1)

    act(() => {
      result.current.startDuplicate()
    })

    expect(result.current.isCreating).toBe(true)
    expect(result.current.draft.id).toBe('wall-rate-1_COPY')
    expect(result.current.draft.sqft_per_hr).toBe(150)
    expect(result.current.draft.helper_allowed).toBe(true)

    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Duplicated walls')
      result.current.actions.updateDraftValue('sqft_per_hr', '175.5')
      result.current.actions.updateDraftValue('helper_allowed', 'N')
    })

    await act(async () => {
      await result.current.saveCurrent()
    })

    expect(mutateRatesFlags).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'production_rates_walls',
        action: 'create',
        values: expect.objectContaining({
          id: 'wall-rate-1_COPY',
          display_name: 'Duplicated walls',
          sqft_per_hr: '175.5',
          helper_allowed: 'N',
          active: 'Y',
        }),
      })
    )
    expect(result.current.uiState.notice).toBe('Created Wall Production.')
    expect(result.current.uiState.pageBanner).toEqual({
      tone: 'success',
      message: 'Created Wall Production.',
    })
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
      result.current.startDuplicate()
      result.current.actions.updateDraftValue('display_name', '')
    })

    await act(async () => {
      await result.current.saveCurrent()
    })

    expect(result.current.uiState.actionError).toBeNull()
    expect(result.current.uiState.validationError).toBe('Display Name is required.')
    expect(result.current.uiState.inlineValidation).toBe('Display Name is required.')
    expect(result.current.uiState.canSave).toBe(false)
    expect(mutateRatesFlags).not.toHaveBeenCalled()
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
      result.current.startDuplicate()
      result.current.actions.updateDraftValue('id', 'wall-rate-2')
      result.current.actions.updateDraftValue('display_name', 'Wall rate 2')
    })

    await act(async () => {
      await result.current.saveCurrent()
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
      await result.current.archiveOrReactivate(false)
    })

    expect(result.current.uiState.notice).toBeNull()
    expect(result.current.uiState.actionError).toBe('Archive failed.')
    expect(result.current.uiState.pageBanner).toEqual({
      tone: 'error',
      message: 'Archive failed.',
    })
  })
})
