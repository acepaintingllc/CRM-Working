import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuoteRatesPage } from '../useQuoteRatesPage'

import {
  buildRatesPayload,
  buildWallRateRow,
} from './quoteRatesPageHook.testUtils'

const { loadRatesFlags, mutateRatesFlags } = vi.hoisted(() => ({
  loadRatesFlags: vi.fn(),
  mutateRatesFlags: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  loadRatesFlags,
  mutateRatesFlags,
}))

describe('useQuoteRatesPage saving', () => {
  beforeEach(() => {
    loadRatesFlags.mockReset()
    mutateRatesFlags.mockReset()
  })

  it('commits a clean draft snapshot after a successful save', async () => {
    loadRatesFlags
      .mockResolvedValueOnce(buildRatesPayload())
      .mockResolvedValueOnce(
        buildRatesPayload({
          rows: [buildWallRateRow({ display_name: 'Clean saved walls', sqft_per_hr: '180' })],
          templateVersion: 3,
        })
      )
    mutateRatesFlags.mockResolvedValue({ data: true })

    const { result } = renderHook(() => useQuoteRatesPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Clean saved walls')
      result.current.actions.updateDraftValue('sqft_per_hr', '180')
    })

    expect(result.current.editorVm.isDirty).toBe(true)

    await act(async () => {
      await result.current.actions.saveCurrent()
    })

    expect(result.current.uiState.notice).toBe('Saved Wall Production.')
    expect(result.current.editorVm.isDirty).toBe(false)
    expect(result.current.editorVm.draft).toMatchObject({
      display_name: 'Clean saved walls',
      sqft_per_hr: 180,
    })
    expect(result.current.workflowVm.actionStatus).toBe('idle')
  })

  it('leaves the current draft editable when save fails', async () => {
    loadRatesFlags.mockResolvedValue(buildRatesPayload())
    mutateRatesFlags.mockRejectedValue(new Error('Save failed.'))

    const { result } = renderHook(() => useQuoteRatesPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Still editable')
      result.current.actions.updateDraftValue('sqft_per_hr', '190')
    })

    await act(async () => {
      await result.current.actions.saveCurrent()
    })

    expect(result.current.uiState.actionError).toBe('Save failed.')
    expect(result.current.workflowVm.actionStatus).toBe('idle')
    expect(result.current.editorVm.isDirty).toBe(true)
    expect(result.current.editorVm.canSave).toBe(true)
    expect(result.current.editorVm.draft).toMatchObject({
      display_name: 'Still editable',
      sqft_per_hr: 190,
    })
  })

  it('keeps a successful save explicit when refresh verification fails', async () => {
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
    loadRatesFlags.mockRejectedValueOnce(new Error('verification failed'))
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

    expect(result.current.tableVm.selectedRow?.display_name).toBe('Updated walls')
    expect(result.current.resource.data.categories[0]?.rows[0]).toMatchObject({
      id: 'wall-rate-1',
      display_name: 'Updated walls',
      sqft_per_hr: '165',
    })
    expect(result.current.uiState.notice).toBe(
      'Saved Wall Production, but refresh failed. Showing locally updated data. verification failed'
    )
    expect(result.current.uiState.pageBanner).toEqual({
      tone: 'warning',
      message:
        'Saved Wall Production, but refresh failed. Showing locally updated data. verification failed',
    })
    expect(result.current.uiState.actionError).toBeNull()
  })
})
