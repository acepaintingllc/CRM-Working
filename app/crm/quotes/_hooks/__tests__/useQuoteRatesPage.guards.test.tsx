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

describe('useQuoteRatesPage guards', () => {
  beforeEach(() => {
    loadRatesFlags.mockReset()
    mutateRatesFlags.mockReset()
  })

  it('blocks reload attempts while a save mutation is active', async () => {
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

    expect(result.current.uiState.canRetry).toBe(false)

    let reloadResult: boolean | Promise<boolean> = true
    act(() => {
      reloadResult = result.current.actions.reload('wall-rate-1')
    })

    expect(reloadResult).toBe(false)
    expect(loadRatesFlags).toHaveBeenCalledTimes(1)

    await act(async () => {
      mutation.resolve({ data: true })
      await saveResult
    })
  })

  it('blocks create and duplicate transitions while a mutation is active', async () => {
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

    let createResult: boolean | Promise<boolean> = true
    let duplicateResult: boolean | Promise<boolean> = true
    act(() => {
      createResult = result.current.actions.startCreate()
      duplicateResult = result.current.actions.startDuplicate()
    })

    expect(createResult).toBe(false)
    expect(duplicateResult).toBe(false)
    expect(result.current.workflowVm.editorMode).toBe('selection')
    expect(result.current.tableVm.isCreating).toBe(false)
    expect(result.current.tableVm.canDuplicate).toBe(false)
    expect(mutateRatesFlags).toHaveBeenCalledTimes(1)

    await act(async () => {
      mutation.resolve({ data: true })
      await saveResult
    })
  })

  it('blocks selection, navigation, and draft active changes while a mutation is active', async () => {
    loadRatesFlags.mockResolvedValue(
      buildRatesPayload({
        rows: [
          buildWallRateRow({ id: 'wall-rate-1', sqft_per_hr: '150' }),
          buildWallRateRow({
            id: 'wall-rate-2',
            display_name: 'Tall walls',
            scope_id: 'scope-2',
            sqft_per_hr: '175',
          }),
        ],
      })
    )
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

    let selectionResult: boolean | Promise<boolean> = true
    let searchResult: boolean | Promise<boolean> = true
    act(() => {
      selectionResult = result.current.actions.setSelectedId('wall-rate-2')
      searchResult = result.current.actions.setSearch('Tall')
      result.current.actions.setDraftActive(false)
      result.current.actions.updateDraftValue('display_name', 'Mutated while saving')
      result.current.actions.cancelEdit()
    })

    expect(selectionResult).toBe(false)
    expect(searchResult).toBe(false)
    expect(result.current.tableVm.selectedId).toBe('wall-rate-1')
    expect(result.current.filtersVm.search).toBe('')
    expect(result.current.editorVm.draftActive).toBe(true)
    expect(result.current.actions.formatDraftValue('display_name')).toBe('Pre-save edit')
    expect(result.current.discardVm.isOpen).toBe(false)

    await act(async () => {
      mutation.resolve({ data: true })
      await saveResult
    })
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
    expect(result.current.discardVm.status).toBe('confirming')
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
    expect(result.current.discardVm.status).toBe('confirming')
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
    expect(result.current.discardVm.status).toBe('confirming')
    expect(result.current.filtersVm.statusFilter).toBe('active')

    act(() => {
      result.current.actions.cancelDiscard()
    })

    expect(result.current.filtersVm.statusFilter).toBe('active')
    expect(result.current.editorVm.draft).toMatchObject({
      display_name: 'Dirty flag',
    })
  })

  it('applies only the first pending rates transition while discard confirmation is open', async () => {
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
      result.current.actions.setStatusFilter('archived')
      result.current.actions.setSearch('traffic')
    })

    expect(result.current.discardVm.transitionType).toBe('setActiveTab')
    expect(result.current.filtersVm.activeTab).toBe('rates')
    expect(result.current.filtersVm.statusFilter).toBe('active')
    expect(result.current.filtersVm.search).toBe('')

    await act(async () => {
      await result.current.actions.confirmDiscard()
    })

    expect(result.current.filtersVm.activeTab).toBe('flags')
    expect(result.current.filtersVm.statusFilter).toBe('active')
    expect(result.current.filtersVm.search).toBe('')
    expect(result.current.editorVm.selectedRow?.id).toBe('flag-1')
    expect(result.current.editorVm.isDirty).toBe(false)
  })

  it('guards reload behind discard confirmation and rehydrates from refreshed data', async () => {
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
            rows: [{ id: 'wall-rate-1', display_name: 'Standard walls', notes: '', active: true }],
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
            ],
            rows: [{ id: 'wall-rate-1', display_name: 'Reloaded walls', notes: '', active: true }],
          },
        ],
      })

    const { result } = renderHook(() => useQuoteRatesPage())

    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false)
    })

    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Dirty walls')
      result.current.actions.reload('wall-rate-1')
    })

    expect(result.current.discardVm.isOpen).toBe(true)
    expect(result.current.discardVm.transitionType).toBe('reload')
    expect(result.current.editorVm.draft).toMatchObject({
      display_name: 'Dirty walls',
    })

    await act(async () => {
      await result.current.actions.confirmDiscard()
    })

    await waitFor(() => {
      expect(result.current.resource.data.template_version).toBe(3)
    })

    expect(result.current.tableVm.selectedId).toBe('wall-rate-1')
    expect(result.current.editorVm.isDirty).toBe(false)
    expect(result.current.editorVm.draft).toMatchObject({
      display_name: 'Reloaded walls',
    })
  })
})
