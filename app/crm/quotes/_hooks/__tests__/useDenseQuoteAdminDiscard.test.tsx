import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useDenseQuoteAdminDiscard } from '../useDenseQuoteAdminDiscard'

describe('useDenseQuoteAdminDiscard', () => {
  it('queues one transition at a time and exposes discard state', () => {
    const { result } = renderHook(() =>
      useDenseQuoteAdminDiscard<string>({
        isDirty: true,
      })
    )

    act(() => {
      result.current.queueDiscardTransition('first')
      result.current.queueDiscardTransition('second')
    })

    expect(result.current.discardVm.isOpen).toBe(true)
    expect(result.current.discardVm.transitionType).toBe('first')
  })

  it('cancels and consumes queued transitions', () => {
    const { result } = renderHook(() =>
      useDenseQuoteAdminDiscard<string>({
        isDirty: true,
      })
    )

    act(() => {
      result.current.queueDiscardTransition('pending')
    })

    act(() => {
      result.current.cancelDiscard()
    })

    expect(result.current.discardVm.isOpen).toBe(false)
    expect(result.current.consumePendingDiscardTransition()).toBeNull()

    act(() => {
      result.current.queueDiscardTransition('confirmed')
    })

    let consumed: string | null = null
    act(() => {
      consumed = result.current.consumePendingDiscardTransition()
    })

    expect(consumed).toBe('confirmed')
    expect(result.current.discardVm.isOpen).toBe(false)
  })

  it('tracks pending mutations as unsaved changes', () => {
    const { result } = renderHook(() =>
      useDenseQuoteAdminDiscard<string>({
        isDirty: false,
      })
    )

    expect(result.current.hasUnsavedChanges()).toBe(false)
    expect(result.current.shouldGuardTransition(true)).toBe(false)

    act(() => {
      result.current.markPendingMutation()
    })

    expect(result.current.hasUnsavedChanges()).toBe(true)
    expect(result.current.shouldGuardTransition(true)).toBe(true)
    expect(result.current.shouldGuardTransition(false)).toBe(false)
  })

  it('automatically resets pending state when the editor becomes clean', () => {
    const { result, rerender } = renderHook(
      ({ isDirty }: { isDirty: boolean }) =>
        useDenseQuoteAdminDiscard<string>({
          isDirty,
        }),
      { initialProps: { isDirty: true } }
    )

    act(() => {
      result.current.queueDiscardTransition('pending')
      result.current.markPendingMutation()
    })

    expect(result.current.discardVm.isOpen).toBe(true)
    expect(result.current.hasUnsavedChanges()).toBe(true)

    rerender({ isDirty: false })

    expect(result.current.discardVm.isOpen).toBe(false)
    expect(result.current.consumePendingDiscardTransition()).toBeNull()
    expect(result.current.hasUnsavedChanges()).toBe(false)
  })
})
