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

describe('useQuoteRatesPage loading', () => {
  beforeEach(() => {
    loadRatesFlags.mockReset()
    mutateRatesFlags.mockReset()
  })

  it('treats a successful empty categories response as no data', async () => {
    loadRatesFlags.mockResolvedValueOnce({
      source: 'db',
      seeded: false,
      template_version: 2,
      categories: [],
    })

    const { result } = renderHook(() => useQuoteRatesPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    expect(result.current.uiState.hasData).toBe(false)
    expect(result.current.uiState.loadError).toBeNull()
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
})
