import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DetailsScopeLineVm } from '../../_lib/estimateV2DetailsVm'
import { useEstimateV2DetailsMaterialTableInputState } from '../useEstimateV2DetailsMaterialTableInputState'

function row(patch: Partial<DetailsScopeLineVm> = {}): DetailsScopeLineVm {
  return {
    id: 'COLOR1',
    label: 'Primary',
    colorId: 'COLOR1',
    colorName: 'Primary',
    rooms: ['Living'],
    sqFt: 100,
    coats: '2',
    product: 'Wall Paint',
    calculationStatus: 'available',
    calculatedGallons: 1.2,
    roundedGallons: 2,
    overrideGallons: '',
    finalGallons: 2,
    overrideKey: 'walls:color:COLOR1',
    overrideOwnerScopeId: 'wall-1',
    hasOverride: false,
    errors: [],
    ...patch,
  }
}

function renderInputState(params?: {
  rows?: DetailsScopeLineVm[]
  onOverride?: (row: DetailsScopeLineVm, value: string) => void
}) {
  const onOverride = params?.onOverride ?? vi.fn()
  const initialProps = {
    rows: params?.rows ?? [row()],
    onOverride,
  }
  const hook = renderHook(
    (props: typeof initialProps) => useEstimateV2DetailsMaterialTableInputState(props),
    { initialProps }
  )
  return { ...hook, onOverride }
}

describe('useEstimateV2DetailsMaterialTableInputState', () => {
  it('focus sets the focused key and seeds the draft value from row override gallons', () => {
    const firstRow = row({ overrideGallons: '3' })
    const { result } = renderInputState({ rows: [firstRow] })

    act(() => {
      result.current.onFocusOverride(firstRow)
    })

    expect(result.current.overrideDisplayValue(firstRow)).toBe('3')
  })

  it('typing updates the draft value and calls onOverride', () => {
    const firstRow = row({ overrideGallons: '3' })
    const onOverride = vi.fn()
    const { result } = renderInputState({ rows: [firstRow], onOverride })

    act(() => {
      result.current.onFocusOverride(firstRow)
      result.current.onChangeOverride(firstRow, '4.5')
    })

    expect(result.current.overrideDisplayValue(firstRow)).toBe('4.5')
    expect(onOverride).toHaveBeenCalledWith(firstRow, '4.5')
  })

  it('blur clears the draft key and focused state for that row', () => {
    const firstRow = row({ overrideGallons: '3' })
    const { result } = renderInputState({ rows: [firstRow] })

    act(() => {
      result.current.onFocusOverride(firstRow)
      result.current.onChangeOverride(firstRow, '4.5')
    })
    expect(result.current.overrideDisplayValue(firstRow)).toBe('4.5')

    act(() => {
      result.current.onBlurOverride(firstRow)
    })

    expect(result.current.overrideDisplayValue(firstRow)).toBe('3')
  })

  it('ignores blur for a row that was never focused', () => {
    const firstRow = row({ overrideGallons: '' })
    const onOverride = vi.fn()
    const { result } = renderInputState({ rows: [firstRow], onOverride })

    expect(result.current.overrideDisplayValue(firstRow)).toBe('')

    expect(() => {
      act(() => {
        result.current.onBlurOverride(firstRow)
      })
    }).not.toThrow()

    expect(result.current.overrideDisplayValue(firstRow)).toBe('')
    expect(onOverride).not.toHaveBeenCalled()
  })

  it('clears the stale focused key on the next render when a focused row is removed', async () => {
    const firstRow = row({ overrideGallons: '1' })
    const secondRow = row({
      id: 'COLOR2',
      label: 'Accent',
      colorId: 'COLOR2',
      overrideKey: 'walls:color:COLOR2',
    })
    const readdedFirstRow = row({ overrideGallons: '5' })
    const { result, rerender } = renderInputState({ rows: [firstRow, secondRow] })

    act(() => {
      result.current.onFocusOverride(firstRow)
    })

    rerender({ rows: [secondRow], onOverride: vi.fn() })
    await waitFor(() => {
      expect(result.current.overrideDisplayValue(secondRow)).toBe(secondRow.overrideGallons)
    })
    rerender({ rows: [readdedFirstRow, secondRow], onOverride: vi.fn() })

    act(() => {
      result.current.onChangeOverride(readdedFirstRow, '8')
    })

    expect(result.current.overrideDisplayValue(readdedFirstRow)).toBe('5')
  })

  it('removes stale draft keys when a drafted row is removed', async () => {
    const firstRow = row({ overrideGallons: '1' })
    const secondRow = row({
      id: 'COLOR2',
      label: 'Accent',
      colorId: 'COLOR2',
      overrideKey: 'walls:color:COLOR2',
    })
    const readdedFirstRow = row({ overrideGallons: '5' })
    const { result, rerender } = renderInputState({ rows: [firstRow, secondRow] })

    act(() => {
      result.current.onFocusOverride(firstRow)
      result.current.onChangeOverride(firstRow, '9')
    })
    expect(result.current.overrideDisplayValue(firstRow)).toBe('9')

    rerender({ rows: [secondRow], onOverride: vi.fn() })
    await waitFor(() => {
      expect(result.current.overrideDisplayValue(secondRow)).toBe(secondRow.overrideGallons)
    })
    rerender({ rows: [readdedFirstRow, secondRow], onOverride: vi.fn() })

    expect(result.current.overrideDisplayValue(readdedFirstRow)).toBe('5')
  })

  it('does not recreate draft state when rows rerender without removing the focused row', () => {
    const firstRow = row({ overrideGallons: '1' })
    const rerenderedFirstRow = row({ overrideGallons: '2' })
    const { result, rerender } = renderInputState({ rows: [firstRow] })

    act(() => {
      result.current.onFocusOverride(firstRow)
      result.current.onChangeOverride(firstRow, '9')
    })
    rerender({ rows: [rerenderedFirstRow], onOverride: vi.fn() })

    expect(result.current.overrideDisplayValue(rerenderedFirstRow)).toBe('9')
  })
})
