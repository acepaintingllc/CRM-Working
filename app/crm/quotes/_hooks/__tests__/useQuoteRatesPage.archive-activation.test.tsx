import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuoteRatesPage } from '../useQuoteRatesPage'

import {
  buildRatesPayload,
  buildWallRateRow,
  createDeferred,
} from './quoteRatesPageHook.testUtils'

const { loadRatesFlags, mutateRatesFlags } = vi.hoisted(() => ({
  loadRatesFlags: vi.fn(),
  mutateRatesFlags: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  loadRatesFlags,
  mutateRatesFlags,
}))

describe('useQuoteRatesPage archive and activation', () => {
  beforeEach(() => {
    loadRatesFlags.mockReset()
    mutateRatesFlags.mockReset()
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

  it('queues discard before archiving a row with unsaved draft changes', async () => {
    loadRatesFlags
      .mockResolvedValueOnce(buildRatesPayload())
      .mockResolvedValueOnce(
        buildRatesPayload({
          rows: [buildWallRateRow({ active: false })],
          templateVersion: 3,
        })
      )
    mutateRatesFlags.mockResolvedValue({ data: true })

    const { result } = renderHook(() => useQuoteRatesPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Unsaved before archive')
    })

    let archiveResult: boolean | Promise<boolean> = true
    act(() => {
      archiveResult = result.current.actions.archiveOrReactivate(false)
    })

    expect(archiveResult).toBe(false)
    expect(result.current.discardVm.isOpen).toBe(true)
    expect(result.current.discardVm.transitionType).toBe('archiveOrReactivate')
    expect(result.current.editorVm.draft).toMatchObject({
      display_name: 'Unsaved before archive',
    })
    expect(mutateRatesFlags).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.actions.confirmDiscard()
    })

    expect(mutateRatesFlags).toHaveBeenCalledWith({
      category: 'production_rates_walls',
      action: 'archive',
      rowId: 'wall-rate-1',
    })
    expect(result.current.discardVm.isOpen).toBe(false)
    expect(result.current.uiState.notice).toBe('Archived row.')
    expect(result.current.editorVm.isDirty).toBe(false)
    expect(result.current.resource.data.categories[0]?.rows[0]?.active).toBe(false)
  })

  it('blocks save attempts while an archive mutation is active', async () => {
    loadRatesFlags.mockResolvedValue(buildRatesPayload())
    const mutation = createDeferred<{ data: boolean }>()
    mutateRatesFlags.mockReturnValue(mutation.promise)

    const { result } = renderHook(() => useQuoteRatesPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    let archiveResult: boolean | Promise<boolean> = false
    act(() => {
      archiveResult = result.current.actions.archiveOrReactivate(false)
    })

    await waitFor(() => {
      expect(result.current.workflowVm.actionStatus).toBe('archiving')
    })

    expect(result.current.uiState.canSave).toBe(false)

    await act(async () => {
      await result.current.actions.saveCurrent()
    })

    expect(mutateRatesFlags).toHaveBeenCalledTimes(1)
    expect(mutateRatesFlags).toHaveBeenCalledWith({
      category: 'production_rates_walls',
      action: 'archive',
      rowId: 'wall-rate-1',
    })

    await act(async () => {
      mutation.resolve({ data: true })
      await archiveResult
    })
  })

  it('blocks archive attempts while a save mutation is active', async () => {
    loadRatesFlags.mockResolvedValue(buildRatesPayload())
    const mutation = createDeferred<{ data: boolean }>()
    mutateRatesFlags.mockReturnValue(mutation.promise)

    const { result } = renderHook(() => useQuoteRatesPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Pre-save edit')
    })

    let saveResult: void | Promise<void>
    act(() => {
      saveResult = result.current.actions.saveCurrent()
    })

    await waitFor(() => {
      expect(result.current.workflowVm.actionStatus).toBe('saving')
    })

    expect(result.current.tableVm.canArchiveToggle).toBe(false)

    let archiveResult: boolean | Promise<boolean> = true
    act(() => {
      archiveResult = result.current.actions.archiveOrReactivate(false)
    })

    expect(archiveResult).toBe(false)
    expect(mutateRatesFlags).toHaveBeenCalledTimes(1)
    expect(mutateRatesFlags).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'production_rates_walls',
        action: 'update',
      })
    )

    await act(async () => {
      mutation.resolve({ data: true })
      await saveResult
    })
  })
})
