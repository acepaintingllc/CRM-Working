import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductionRateRow, RatesFlagsPayload } from '@/types/estimator/ratesFlags'
import { useQuoteRatesPage } from '../useQuoteRatesPage'

const { loadRatesFlags, publishRatesFlagsBatch } =
  vi.hoisted(() => ({
    loadRatesFlags: vi.fn(),
    publishRatesFlagsBatch: vi.fn(),
  }))
const { push } = vi.hoisted(() => ({
  push: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  loadRatesFlags,
  publishRatesFlagsBatch,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

function buildWallRateRow(overrides: Partial<ProductionRateRow> = {}): ProductionRateRow {
  return {
    id: 'wall-rate-1',
    production_scope: 'walls',
    scope_id: 'scope-1',
    display_name: 'Standard walls',
    surface_type: 'paint',
    condition: 'normal',
    prep_sqft_per_hr: '100',
    sqft_per_hr: '150',
    primer_sqft_per_hr: '100',
    notes: '',
    active: true,
    ...overrides,
  }
}

function buildRatesPayload(rows: ProductionRateRow[] = [buildWallRateRow()]): RatesFlagsPayload {
  return {
    source: 'db',
    seeded: true,
    template_version: 2,
    active_setting_set: {
      id: 'active-set-1',
      status: 'active',
      version_number: 2,
      source_set_id: null,
      created_at: '2026-05-01T00:00:00.000Z',
      updated_at: '2026-05-01T00:00:00.000Z',
      activated_at: '2026-05-01T00:00:00.000Z',
      retired_at: null,
      notes: '',
    },
    draft_setting_set: null,
    editing_setting_set: null,
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
        ],
        rows,
      },
    ],
  }
}

async function renderLoadedRatesPage(payload: RatesFlagsPayload = buildRatesPayload()) {
  loadRatesFlags.mockResolvedValue(payload)
  const hook = renderHook(() => useQuoteRatesPage())

  await waitFor(() => {
    expect(hook.result.current.resource.loading).toBe(false)
  })
  if (payload.categories[0]?.rows.some((row) => row.active)) {
    await waitFor(() => {
      expect(hook.result.current.tableVm.selectedRow?.id).toBe('wall-rate-1')
    })
  }

  return hook
}

describe('useQuoteRatesPage', () => {
  beforeEach(() => {
    loadRatesFlags.mockReset()
    publishRatesFlagsBatch.mockReset()
    push.mockReset()
    document.body.replaceChildren()
    window.history.replaceState({ current: true }, '', '/crm/quotes/rates')
  })

  it('loads the active settings payload into local editor state', async () => {
    const { result } = await renderLoadedRatesPage()

    expect(result.current.tableVm.selectedRow?.id).toBe('wall-rate-1')
    expect(result.current.editorVm.draft).toMatchObject({
      id: 'wall-rate-1',
      display_name: 'Standard walls',
      sqft_per_hr: 150,
    })
    expect(result.current.editorVm.activeSettingSet?.id).toBe('active-set-1')
  })

  it('applies row edits locally without calling the API immediately', async () => {
    const { result } = await renderLoadedRatesPage()

    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Updated walls')
      result.current.actions.updateDraftValue('sqft_per_hr', '165')
    })

    await waitFor(() => {
      expect(result.current.tableVm.selectedRow).toMatchObject({
        display_name: 'Updated walls',
        sqft_per_hr: '165',
      })
    })

    expect(publishRatesFlagsBatch).not.toHaveBeenCalled()
    expect(result.current.uiState.canSave).toBe(true)
    expect(result.current.editorVm.isDirty).toBe(true)
  })

  it('publishes multiple local edits as one save request', async () => {
    const savedPayload = buildRatesPayload([
      buildWallRateRow({ id: 'wall-rate-1', display_name: 'Updated walls', sqft_per_hr: '165' }),
      buildWallRateRow({
        id: 'wall-rate-2',
        scope_id: 'scope-2',
        display_name: 'Updated tall walls',
        sqft_per_hr: '190',
      }),
    ])
    publishRatesFlagsBatch.mockResolvedValue({ data: savedPayload, notice: 'Rates and flags published.' })

    const { result } = await renderLoadedRatesPage(
      buildRatesPayload([
        buildWallRateRow({ id: 'wall-rate-1', display_name: 'Standard walls' }),
        buildWallRateRow({
          id: 'wall-rate-2',
          scope_id: 'scope-2',
          display_name: 'Tall walls',
          sqft_per_hr: '175',
        }),
      ])
    )

    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Updated walls')
      result.current.actions.updateDraftValue('sqft_per_hr', '165')
    })

    await waitFor(() => {
      expect(result.current.tableVm.selectedRow?.display_name).toBe('Updated walls')
    })

    act(() => {
      result.current.actions.setSelectedId('wall-rate-2')
    })

    await waitFor(() => {
      expect(result.current.tableVm.selectedId).toBe('wall-rate-2')
    })

    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Updated tall walls')
      result.current.actions.updateDraftValue('sqft_per_hr', '190')
    })

    await act(async () => {
      await result.current.actions.saveBatch()
    })

    expect(publishRatesFlagsBatch).toHaveBeenCalledTimes(1)
    expect(publishRatesFlagsBatch).toHaveBeenCalledWith({
      reason: 'Rates, flags, and room defaults saved',
      mutations: [
        expect.objectContaining({
          category: 'production_rates_walls',
          action: 'update',
          original_id: 'wall-rate-1',
          values: expect.objectContaining({ display_name: 'Updated walls', sqft_per_hr: '165' }),
        }),
        expect.objectContaining({
          category: 'production_rates_walls',
          action: 'update',
          original_id: 'wall-rate-2',
          values: expect.objectContaining({
            display_name: 'Updated tall walls',
            sqft_per_hr: '190',
          }),
        }),
      ],
    })
  })

  it('queues creates locally and includes them in the page-level save batch', async () => {
    const savedPayload = buildRatesPayload([
      buildWallRateRow(),
      buildWallRateRow({
        id: 'wall-rate-1_COPY',
        scope_id: 'scope-copy',
        display_name: 'Copied walls',
        sqft_per_hr: '175',
      }),
    ])
    publishRatesFlagsBatch.mockResolvedValue({
      data: savedPayload,
      notice: 'Rates and flags published.',
    })
    const { result } = await renderLoadedRatesPage()

    act(() => {
      result.current.actions.startDuplicate()
      result.current.actions.updateDraftValue('display_name', 'Copied walls')
      result.current.actions.updateDraftValue('sqft_per_hr', '175')
    })

    await waitFor(() => {
      expect(result.current.tableVm.selectedId).toBe('wall-rate-1_COPY')
    })

    expect(result.current.tableVm.selectedRow).toMatchObject({
      id: 'wall-rate-1_COPY',
      display_name: 'Copied walls',
      sqft_per_hr: '175',
    })
    expect(publishRatesFlagsBatch).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.actions.saveBatch()
    })

    expect(publishRatesFlagsBatch).toHaveBeenCalledWith({
      reason: 'Rates, flags, and room defaults saved',
      mutations: [
        expect.objectContaining({
          category: 'production_rates_walls',
          action: 'create',
          values: expect.objectContaining({
            id: 'wall-rate-1_COPY',
            display_name: 'Copied walls',
            sqft_per_hr: '175',
          }),
        }),
      ],
    })
  })

  it('enables save only while pending changes exist and clears dirty state after save', async () => {
    const savedPayload = {
      ...buildRatesPayload([
        buildWallRateRow({ display_name: 'Saved walls', sqft_per_hr: '180' }),
      ]),
      template_version: 3,
      active_setting_set: {
        id: 'active-set-2',
        status: 'active' as const,
        version_number: 3,
        source_set_id: 'active-set-1',
        created_at: '2026-05-02T00:00:00.000Z',
        updated_at: '2026-05-02T00:00:00.000Z',
        activated_at: '2026-05-02T00:00:00.000Z',
        retired_at: null,
        notes: 'Rates publish',
      },
      draft_setting_set: null,
      editing_setting_set: {
        id: 'active-set-2',
        status: 'active' as const,
        version_number: 3,
        source_set_id: 'active-set-1',
        created_at: '2026-05-02T00:00:00.000Z',
        updated_at: '2026-05-02T00:00:00.000Z',
        activated_at: '2026-05-02T00:00:00.000Z',
        retired_at: null,
        notes: 'Rates publish',
      },
    }
    publishRatesFlagsBatch.mockResolvedValue({ data: savedPayload, notice: 'Rates and flags published.' })

    const { result } = await renderLoadedRatesPage()

    expect(result.current.uiState.canSave).toBe(false)

    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Saved walls')
      result.current.actions.updateDraftValue('sqft_per_hr', '180')
    })

    await waitFor(() => {
      expect(result.current.uiState.canSave).toBe(true)
    })

    await act(async () => {
      await result.current.actions.saveBatch()
    })

    expect(result.current.uiState.canSave).toBe(false)
    expect(result.current.editorVm.isDirty).toBe(false)
    expect(result.current.tableVm.selectedRow).toMatchObject({
      display_name: 'Saved walls',
      sqft_per_hr: '180',
    })
    expect(result.current.editorVm.activeSettingSet?.id).toBe('active-set-2')
    expect(result.current.editorVm.activeSettingSet?.version_number).toBe(3)
    expect(result.current.resource.data.draft_setting_set).toBeNull()
    expect(result.current.uiState.notice).toBe('Saved rates, flags, and room defaults.')
  })

  it('archives rows locally before the batch save', async () => {
    const savedPayload = buildRatesPayload([buildWallRateRow({ active: false })])
    publishRatesFlagsBatch.mockResolvedValue({ data: savedPayload, notice: 'Rates and flags published.' })
    const { result } = await renderLoadedRatesPage()

    act(() => {
      result.current.actions.setStatusFilter('all')
    })

    await act(async () => {
      await result.current.actions.archiveOrReactivate(false)
    })

    expect(result.current.resource.data.categories[0]?.rows[0]?.active).toBe(false)
    expect(publishRatesFlagsBatch).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.actions.saveBatch()
    })

    expect(publishRatesFlagsBatch).toHaveBeenCalledWith({
      reason: 'Rates, flags, and room defaults saved',
      mutations: [
        {
          category: 'production_rates_walls',
          action: 'archive',
          rowId: 'wall-rate-1',
        },
      ],
    })
    expect(result.current.editorVm.isDirty).toBe(false)
  })

  it('reactivates rows locally before the batch save', async () => {
    const savedPayload = buildRatesPayload([buildWallRateRow({ active: true })])
    publishRatesFlagsBatch.mockResolvedValue({
      data: savedPayload,
      notice: 'Rates and flags published.',
    })
    const { result } = await renderLoadedRatesPage(
      buildRatesPayload([buildWallRateRow({ active: false })])
    )

    act(() => {
      result.current.actions.setStatusFilter('all')
    })

    await act(async () => {
      await result.current.actions.archiveOrReactivate(true)
    })

    expect(result.current.resource.data.categories[0]?.rows[0]?.active).toBe(true)
    expect(publishRatesFlagsBatch).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.actions.saveBatch()
    })

    expect(publishRatesFlagsBatch).toHaveBeenCalledWith({
      reason: 'Rates, flags, and room defaults saved',
      mutations: [
        {
          category: 'production_rates_walls',
          action: 'reactivate',
          rowId: 'wall-rate-1',
        },
      ],
    })
    expect(result.current.editorVm.isDirty).toBe(false)
  })

  it('clears a pending archive when the row is reactivated before saving', async () => {
    const { result } = await renderLoadedRatesPage()

    act(() => {
      result.current.actions.setStatusFilter('all')
    })

    await act(async () => {
      await result.current.actions.archiveOrReactivate(false)
    })

    expect(result.current.uiState.canSave).toBe(true)
    expect(result.current.resource.data.categories[0]?.rows[0]?.active).toBe(false)

    await act(async () => {
      await result.current.actions.archiveOrReactivate(true)
    })

    expect(result.current.resource.data.categories[0]?.rows[0]?.active).toBe(true)
    expect(result.current.uiState.canSave).toBe(false)

    await act(async () => {
      await result.current.actions.saveBatch()
    })

    expect(publishRatesFlagsBatch).not.toHaveBeenCalled()
  })

  it('keeps pending changes dirty when discard refresh fails', async () => {
    const initialPayload = buildRatesPayload()
    loadRatesFlags.mockResolvedValueOnce(initialPayload).mockRejectedValueOnce(new Error('refresh failed'))
    const hook = renderHook(() => useQuoteRatesPage())

    await waitFor(() => {
      expect(hook.result.current.resource.loading).toBe(false)
    })

    act(() => {
      hook.result.current.actions.updateDraftValue('display_name', 'Unsaved walls')
    })

    await waitFor(() => {
      expect(hook.result.current.uiState.canSave).toBe(true)
    })

    await act(async () => {
      await hook.result.current.actions.discardBatch()
    })

    expect(hook.result.current.editorVm.isDirty).toBe(true)
    expect(hook.result.current.resource.data.categories[0]?.rows[0]?.display_name).toBe(
      'Unsaved walls'
    )
  })

  it('keeps invalid row edits local and blocks publishing until fixed', async () => {
    const { result } = await renderLoadedRatesPage()

    act(() => {
      result.current.actions.updateDraftValue('display_name', '')
    })

    expect(result.current.uiState.canSave).toBe(false)
    expect(result.current.uiState.validationError).toBe('Display Name is required.')

    await act(async () => {
      await result.current.actions.saveBatch()
    })

    expect(publishRatesFlagsBatch).not.toHaveBeenCalled()
  })

  it('does not prompt when leaving with no local changes', async () => {
    const { result } = await renderLoadedRatesPage()
    act(() => {
      result.current.actions.requestLeavePage('/crm/jobs')
    })

    expect(result.current.leavePageVm.isOpen).toBe(false)
    expect(push).toHaveBeenCalledWith('/crm/jobs')
  })

  it('prompts when leaving with pending local changes', async () => {
    const clickHandlers: EventListener[] = []
    const originalAddEventListener = document.addEventListener.bind(document)
    const addEventListenerSpy = vi
      .spyOn(document, 'addEventListener')
      .mockImplementation((type, listener, options) => {
        if (type === 'click' && typeof listener === 'function') {
          clickHandlers.push(listener as EventListener)
        }
        return originalAddEventListener(type, listener, options)
      })
    const { result } = await renderLoadedRatesPage()
    addEventListenerSpy.mockRestore()
    const link = document.createElement('a')
    link.href = '/crm/jobs'
    document.body.appendChild(link)

    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Unsaved walls')
    })

    await waitFor(() => {
      expect(result.current.uiState.canSave).toBe(true)
    })
    act(() => {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
      Object.defineProperty(event, 'target', { value: link })
      clickHandlers.forEach((handler) => handler(event))
    })

    expect(result.current.leavePageVm.isOpen).toBe(true)
    expect(result.current.leavePageVm.href).toBe('/crm/jobs')
    expect(push).not.toHaveBeenCalled()
  })

  it('saves pending navigation changes before continuing', async () => {
    publishRatesFlagsBatch.mockResolvedValue({
      data: buildRatesPayload([buildWallRateRow({ display_name: 'Saved walls' })]),
      notice: 'Rates and flags published.',
    })
    const { result } = await renderLoadedRatesPage()
    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Saved walls')
    })
    await waitFor(() => {
      expect(result.current.uiState.canSave).toBe(true)
    })
    act(() => {
      result.current.actions.requestLeavePage('/crm/customers')
    })

    await act(async () => {
      await result.current.actions.saveAndLeave()
    })

    expect(publishRatesFlagsBatch).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/crm/customers')
    expect(result.current.leavePageVm.isOpen).toBe(false)
    expect(result.current.uiState.canSave).toBe(false)
  })

  it('discards pending navigation changes without publishing before continuing', async () => {
    const { result } = await renderLoadedRatesPage()
    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Unsaved walls')
    })
    await waitFor(() => {
      expect(result.current.tableVm.selectedRow?.display_name).toBe('Unsaved walls')
    })
    act(() => {
      result.current.actions.requestLeavePage('/crm/calendar')
    })
    act(() => {
      result.current.actions.discardAndLeave()
    })

    expect(publishRatesFlagsBatch).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/crm/calendar')
    expect(result.current.tableVm.selectedRow?.display_name).toBe('Standard walls')
    expect(result.current.uiState.canSave).toBe(false)
  })

  it('cancels pending navigation and preserves local edits', async () => {
    const { result } = await renderLoadedRatesPage()
    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Unsaved walls')
    })
    await waitFor(() => {
      expect(result.current.tableVm.selectedRow?.display_name).toBe('Unsaved walls')
    })
    act(() => {
      result.current.actions.requestLeavePage('/crm/settings')
      result.current.actions.cancelDiscard()
    })

    expect(push).not.toHaveBeenCalled()
    expect(result.current.leavePageVm.isOpen).toBe(false)
    expect(result.current.tableVm.selectedRow?.display_name).toBe('Unsaved walls')
    expect(result.current.uiState.canSave).toBe(true)
  })

  it('guards browser back navigation and restores the rates URL while dirty', async () => {
    const popStateHandlers: EventListener[] = []
    const originalAddEventListener = window.addEventListener.bind(window)
    const addEventListenerSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation((type, listener, options) => {
        if (type === 'popstate' && typeof listener === 'function') {
          popStateHandlers.push(listener as EventListener)
        }
        return originalAddEventListener(type, listener, options)
      })
    const { result } = await renderLoadedRatesPage()
    addEventListenerSpy.mockRestore()

    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Unsaved walls')
    })
    await waitFor(() => {
      expect(result.current.uiState.canSave).toBe(true)
    })

    window.history.replaceState({ next: true }, '', '/crm/quotes')
    act(() => {
      popStateHandlers.forEach((handler) => handler(new PopStateEvent('popstate')))
    })

    expect(push).not.toHaveBeenCalled()
    expect(window.location.pathname).toBe('/crm/quotes/rates')
    expect(result.current.leavePageVm.isOpen).toBe(true)
    expect(result.current.leavePageVm.href).toBe('/crm/quotes')
  })

  it('keeps the user on the page with edits intact when navigation save fails', async () => {
    publishRatesFlagsBatch.mockRejectedValue(new Error('save failed'))
    const { result } = await renderLoadedRatesPage()
    act(() => {
      result.current.actions.updateDraftValue('display_name', 'Unsaved walls')
    })
    await waitFor(() => {
      expect(result.current.uiState.canSave).toBe(true)
    })
    act(() => {
      result.current.actions.requestLeavePage('/crm/tasks')
    })

    await act(async () => {
      await result.current.actions.saveAndLeave()
    })

    expect(push).not.toHaveBeenCalled()
    expect(result.current.leavePageVm.isOpen).toBe(true)
    expect(result.current.tableVm.selectedRow?.display_name).toBe('Unsaved walls')
    expect(result.current.uiState.canSave).toBe(true)
    expect(result.current.uiState.pageBanner?.message).toBe('save failed')
  })
})
