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
          ],
          rows: [
            {
              id: 'wall-rate-1',
              display_name: 'Standard walls',
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

    act(() => {
      result.current.setDraft((current) => ({
        ...current,
        display_name: 'Duplicated walls',
      }))
    })

    await act(async () => {
      await result.current.saveCurrent()
    })

    expect(mutateRatesFlags).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'production_rates_walls',
        action: 'create',
      })
    )
  })
})
