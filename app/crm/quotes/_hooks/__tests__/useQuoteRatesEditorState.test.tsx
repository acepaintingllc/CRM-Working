import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { useQuoteRatesEditorState } from '../useQuoteRatesEditorState'
import type { RatesFlagsEditableCategory } from '@/types/estimator/ratesFlags'

const category: RatesFlagsEditableCategory<'production_rates_walls'> = {
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
    { key: 'scope_id', label: 'Scope', type: 'text', required: true },
    { key: 'sqft_per_hr', label: 'Sq Ft / Hr', type: 'number', required: true },
  ],
  rows: [
    {
      id: 'WALL_STD',
      display_name: 'Standard walls',
      notes: '',
      active: true,
      production_scope: 'walls',
      scope_id: 'WALLS',
      surface_type: 'Drywall',
      condition: 'Std',
      prep_sqft_per_hr: '90',
      sqft_per_hr: '120',
      primer_sqft_per_hr: '100',
    },
    {
      id: 'WALL_TALL',
      display_name: 'Tall walls',
      notes: '',
      active: true,
      production_scope: 'walls',
      scope_id: 'WALLS',
      surface_type: 'Drywall',
      condition: 'Tall',
      prep_sqft_per_hr: '80',
      sqft_per_hr: '100',
      primer_sqft_per_hr: '95',
    },
  ],
}

describe('useQuoteRatesEditorState', () => {
  it('supports create, duplicate, and cancel flows through the typed adapter contract', () => {
    const { result } = renderHook(() =>
      useQuoteRatesEditorState({ activeCategory: category, filteredRows: category.rows })
    )

    act(() => {
      result.current.startDuplicate()
    })

    expect(result.current.isCreating).toBe(true)
    expect(result.current.draft).toMatchObject({
      id: 'WALL_STD_COPY',
      display_name: 'Standard walls',
      sqft_per_hr: 120,
    })

    act(() => {
      result.current.updateDraftValue('display_name', 'Copied walls')
      result.current.cancelEdit()
    })

    expect(result.current.isCreating).toBe(false)
    expect(result.current.selectedRow?.id).toBe('WALL_STD')
    expect(result.current.draft).toMatchObject({
      id: 'WALL_STD',
      display_name: 'Standard walls',
    })

    act(() => {
      result.current.startCreate()
    })

    expect(result.current.selectedId).toBe('')
    expect(result.current.draft).toMatchObject({
      id: '',
      scope_id: '',
      sqft_per_hr: null,
    })
  })

  it('falls back to the first filtered row when the current selection disappears', () => {
    const { result, rerender } = renderHook(
      ({ filteredRows }) =>
        useQuoteRatesEditorState({ activeCategory: category, filteredRows }),
      {
        initialProps: { filteredRows: category.rows },
      }
    )

    act(() => {
      result.current.setSelectedId('WALL_TALL')
    })

    rerender({ filteredRows: [category.rows[0]] })

    expect(result.current.selectedId).toBe('WALL_STD')
    expect(result.current.selectedRow?.id).toBe('WALL_STD')
  })

  it('builds create and update mutation requests from typed drafts', () => {
    const { result } = renderHook(() =>
      useQuoteRatesEditorState({ activeCategory: category, filteredRows: category.rows })
    )

    const updateMutation = result.current.buildMutation({ action: 'update' })
    expect(updateMutation).toEqual({
      keepId: 'WALL_STD',
      request: {
        category: 'production_rates_walls',
        action: 'update',
        original_id: 'WALL_STD',
        values: {
          production_scope: 'walls',
          id: 'WALL_STD',
          scope_id: 'WALLS',
          display_name: 'Standard walls',
          surface_type: '',
          condition: '',
          prep_sqft_per_hr: '',
          sqft_per_hr: '120',
          primer_sqft_per_hr: '',
          notes: '',
          active: 'Y',
        },
      },
    })

    act(() => {
      result.current.startCreate()
      result.current.updateDraftValue('id', 'WALL_NEW')
      result.current.updateDraftValue('display_name', 'New walls')
      result.current.updateDraftValue('scope_id', 'WALLS')
      result.current.updateDraftValue('sqft_per_hr', '130')
    })

    const createMutation = result.current.buildMutation({ action: 'create' })
    expect(createMutation).toEqual({
      keepId: 'WALL_NEW',
      request: {
        category: 'production_rates_walls',
        action: 'create',
        values: {
          production_scope: 'walls',
          id: 'WALL_NEW',
          scope_id: 'WALLS',
          display_name: 'New walls',
          surface_type: '',
          condition: '',
          prep_sqft_per_hr: '',
          sqft_per_hr: '130',
          primer_sqft_per_hr: '',
          notes: '',
          active: 'Y',
        },
      },
    })
  })
})
