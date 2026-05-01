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

describe('useQuoteRatesPage validation', () => {
  beforeEach(() => {
    loadRatesFlags.mockReset()
    mutateRatesFlags.mockReset()
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

  it('hides stale success notices behind validation and replaces them on mutation failure', async () => {
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
})
