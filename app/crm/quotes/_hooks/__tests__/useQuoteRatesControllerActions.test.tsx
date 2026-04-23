import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useQuoteRatesControllerActions } from '../useQuoteRatesControllerActions'
import type { RatesFlagsEditableCategory } from '@/types/estimator/ratesFlags'

const category: RatesFlagsEditableCategory<'production_rates_walls'> = {
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
      id: 'WALL_STD',
      display_name: 'Standard walls',
      notes: '',
      active: true,
      production_scope: 'walls',
      scope_id: 'WALLS',
      surface_type: '',
      condition: '',
      prep_sqft_per_hr: '',
      sqft_per_hr: '120',
      primer_sqft_per_hr: '',
    },
  ],
}

type QuoteRatesEditor = {
  selectedId: string
  selectedRow: (typeof category)['rows'][number]
  isCreating: boolean
  isDirty: boolean
  buildMutation: ReturnType<typeof vi.fn>
  finishCreate: ReturnType<typeof vi.fn>
  startCreate: ReturnType<typeof vi.fn>
  startDuplicate: ReturnType<typeof vi.fn>
  cancelEdit: ReturnType<typeof vi.fn>
  setSelectedId: ReturnType<typeof vi.fn>
}

function createFilters() {
  return {
    activeTab: 'rates',
    setActiveTab: vi.fn(),
    rateSection: 'production',
    setRateSection: vi.fn(),
    rateCategory: 'production_rates_walls',
    setRateCategory: vi.fn(),
    flagsSection: 'condition_modifiers',
    setFlagsSection: vi.fn(),
    roomDefaultsSection: 'room_types',
    setRoomDefaultsSection: vi.fn(),
    statusFilter: 'active',
    setStatusFilter: vi.fn(),
    search: '',
    setSearch: vi.fn(),
    activeCategory: category,
  }
}

function createEditor(overrides?: Partial<QuoteRatesEditor>) {
  const editor = {
    selectedId: 'WALL_STD',
    selectedRow: category.rows[0],
    isCreating: false,
    isDirty: false,
    buildMutation: vi.fn(),
    finishCreate: vi.fn(),
    startCreate: vi.fn(),
    startDuplicate: vi.fn(),
    cancelEdit: vi.fn(),
    setSelectedId: vi.fn(),
  }
  return { ...editor, ...overrides }
}

describe('useQuoteRatesControllerActions', () => {
  it('archives through the typed activation request contract', async () => {
    const archiveToggle = vi.fn().mockResolvedValue(true)
    const { result } = renderHook(() =>
      useQuoteRatesControllerActions({
        filters: createFilters() as never,
        editor: createEditor() as never,
        persistence: { archiveToggle } as never,
        feedback: { clearFeedback: vi.fn() } as never,
        reload: vi.fn(),
      })
    )

    await act(async () => {
      await result.current.archiveOrReactivate(false)
    })

    expect(archiveToggle).toHaveBeenCalledWith({
      request: {
        category: 'production_rates_walls',
        action: 'archive',
        rowId: 'WALL_STD',
      },
    })
  })

  it('blocks selection changes behind discard confirmation when the draft is dirty', async () => {
    const filters = createFilters()
    const editor = createEditor({ isDirty: true })
    const { result } = renderHook(() =>
      useQuoteRatesControllerActions({
        filters: filters as never,
        editor: editor as never,
        persistence: { archiveToggle: vi.fn() } as never,
        feedback: { clearFeedback: vi.fn() } as never,
        reload: vi.fn(),
      })
    )

    act(() => {
      result.current.setSelectedId('WALL_OTHER')
    })

    expect(result.current.discardVm.isOpen).toBe(true)
    expect(result.current.discardVm.transitionType).toBe('setSelectedId')
    expect(editor.setSelectedId).not.toHaveBeenCalled()

    act(() => {
      result.current.cancelDiscard()
    })

    expect(result.current.discardVm.isOpen).toBe(false)
    expect(editor.setSelectedId).not.toHaveBeenCalled()

    act(() => {
      result.current.setSelectedId('WALL_OTHER')
    })

    await act(async () => {
      await result.current.confirmDiscard()
    })

    expect(editor.setSelectedId).toHaveBeenCalledWith('WALL_OTHER')
  })

  it('blocks tab, section, category, status, and search transitions until discard confirm', async () => {
    const filters = createFilters()
    const editor = createEditor({ isDirty: true })
    const { result } = renderHook(() =>
      useQuoteRatesControllerActions({
        filters: filters as never,
        editor: editor as never,
        persistence: { archiveToggle: vi.fn() } as never,
        feedback: { clearFeedback: vi.fn() } as never,
        reload: vi.fn(),
      })
    )

    act(() => {
      result.current.setActiveTab('flags')
    })
    expect(result.current.discardVm.transitionType).toBe('setActiveTab')
    expect(filters.setActiveTab).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.confirmDiscard()
    })
    expect(filters.setActiveTab).toHaveBeenCalledWith('flags')

    act(() => {
      result.current.setRateSection('unit_rates')
    })
    expect(result.current.discardVm.transitionType).toBe('setRateSection')

    await act(async () => {
      await result.current.confirmDiscard()
    })
    expect(filters.setRateSection).toHaveBeenCalledWith('unit_rates')
    expect(filters.setRateCategory).toHaveBeenCalledWith('unit_rates_doors')

    act(() => {
      result.current.setRateCategory('production_rates_trim')
    })
    expect(result.current.discardVm.transitionType).toBe('setRateCategory')

    await act(async () => {
      await result.current.confirmDiscard()
    })
    expect(filters.setRateCategory).toHaveBeenCalledWith('production_rates_trim')

    act(() => {
      result.current.setStatusFilter('archived')
    })
    expect(result.current.discardVm.transitionType).toBe('setStatusFilter')

    await act(async () => {
      await result.current.confirmDiscard()
    })
    expect(filters.setStatusFilter).toHaveBeenCalledWith('archived')

    act(() => {
      result.current.setSearch('trim')
    })
    expect(result.current.discardVm.transitionType).toBe('setSearch')

    await act(async () => {
      await result.current.confirmDiscard()
    })
    expect(filters.setSearch).toHaveBeenCalledWith('trim')
  })

  it('blocks create and duplicate until discard confirm', async () => {
    const feedback = { clearFeedback: vi.fn() }
    const editor = createEditor({ isDirty: true })
    const { result } = renderHook(() =>
      useQuoteRatesControllerActions({
        filters: createFilters() as never,
        editor: editor as never,
        persistence: { archiveToggle: vi.fn() } as never,
        feedback: feedback as never,
        reload: vi.fn(),
      })
    )

    act(() => {
      result.current.startCreate()
    })
    expect(result.current.discardVm.transitionType).toBe('startCreate')
    expect(editor.startCreate).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.confirmDiscard()
    })
    expect(editor.startCreate).toHaveBeenCalled()
    expect(feedback.clearFeedback).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.startDuplicate()
    })
    expect(result.current.discardVm.transitionType).toBe('startDuplicate')

    await act(async () => {
      await result.current.confirmDiscard()
    })
    expect(editor.startDuplicate).toHaveBeenCalled()
    expect(feedback.clearFeedback).toHaveBeenCalledTimes(2)
  })

  it('blocks reload and archive transitions until discard confirm', async () => {
    const archiveToggle = vi.fn().mockResolvedValue(true)
    const reload = vi.fn().mockResolvedValue(true)
    const { result } = renderHook(() =>
      useQuoteRatesControllerActions({
        filters: createFilters() as never,
        editor: createEditor({ isDirty: true }) as never,
        persistence: { archiveToggle } as never,
        feedback: { clearFeedback: vi.fn() } as never,
        reload,
      })
    )

    await act(async () => {
      await result.current.reload('WALL_STD')
    })
    expect(result.current.discardVm.transitionType).toBe('reload')
    expect(reload).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.confirmDiscard()
    })
    expect(reload).toHaveBeenCalledWith('WALL_STD')

    await act(async () => {
      await result.current.archiveOrReactivate(true)
    })
    expect(result.current.discardVm.transitionType).toBe('archiveOrReactivate')
    expect(archiveToggle).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.confirmDiscard()
    })
    expect(archiveToggle).toHaveBeenCalledWith({
      request: {
        category: 'production_rates_walls',
        action: 'reactivate',
        rowId: 'WALL_STD',
      },
    })
  })

  it('applies a queued transition only once', async () => {
    const filters = createFilters()
    const { result } = renderHook(() =>
      useQuoteRatesControllerActions({
        filters: filters as never,
        editor: createEditor({ isDirty: true }) as never,
        persistence: { archiveToggle: vi.fn() } as never,
        feedback: { clearFeedback: vi.fn() } as never,
        reload: vi.fn(),
      })
    )

    act(() => {
      result.current.setFlagsSection('height_factors')
      result.current.setFlagsSection('wall_complexity')
    })

    expect(result.current.discardVm.transitionType).toBe('setFlagsSection')

    await act(async () => {
      await result.current.confirmDiscard()
      await result.current.confirmDiscard()
    })

    expect(filters.setFlagsSection).toHaveBeenCalledTimes(1)
    expect(filters.setFlagsSection).toHaveBeenCalledWith('height_factors')
  })
})
