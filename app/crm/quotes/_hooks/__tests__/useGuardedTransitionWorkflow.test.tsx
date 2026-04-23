import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useGuardedTransitionWorkflow } from '../useGuardedTransitionWorkflow'

describe('useGuardedTransitionWorkflow', () => {
  it('replays the registered transition after discard confirmation', async () => {
    const run = vi.fn()
    const replay = vi.fn().mockReturnValue(true)

    const { result } = renderHook(() =>
      useGuardedTransitionWorkflow<{ type: 'select'; id: string }>({
        isDirty: true,
      })
    )

    act(() => {
      result.current.runTransition({
        transition: { type: 'select', id: 'row-2' },
        changed: true,
        run,
        replay,
      })
    })

    expect(result.current.workflowVm.isOpen).toBe(true)
    expect(run).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.confirmDiscard()
    })

    expect(replay).toHaveBeenCalledWith({ type: 'select', id: 'row-2' })
    expect(result.current.workflowVm.isOpen).toBe(false)
  })

  it('applies the first queued transition only once', async () => {
    const firstReplay = vi.fn().mockReturnValue(true)
    const secondReplay = vi.fn().mockReturnValue(true)

    const { result } = renderHook(() =>
      useGuardedTransitionWorkflow<{ type: 'filter'; value: string }>({
        isDirty: true,
      })
    )

    act(() => {
      result.current.runTransition({
        transition: { type: 'filter', value: 'active' },
        changed: true,
        run: vi.fn(),
        replay: firstReplay,
      })
      result.current.runTransition({
        transition: { type: 'filter', value: 'archived' },
        changed: true,
        run: vi.fn(),
        replay: secondReplay,
      })
    })

    await act(async () => {
      await result.current.confirmDiscard()
      await result.current.confirmDiscard()
    })

    expect(firstReplay).toHaveBeenCalledTimes(1)
    expect(firstReplay).toHaveBeenCalledWith({ type: 'filter', value: 'active' })
    expect(secondReplay).not.toHaveBeenCalled()
  })

  it('keeps replaying-transition visible while async replay is in flight', async () => {
    let resolveReplay: ((value: boolean) => void) | null = null
    const replay = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveReplay = resolve
        })
    )

    const { result } = renderHook(() =>
      useGuardedTransitionWorkflow<{ type: 'reload'; id: string }>({
        isDirty: true,
      })
    )

    act(() => {
      result.current.runTransition({
        transition: { type: 'reload', id: 'row-1' },
        changed: true,
        run: vi.fn(),
        replay,
      })
    })

    let confirmPromise: ReturnType<typeof result.current.confirmDiscard> | null = null
    await act(async () => {
      confirmPromise = result.current.confirmDiscard()
      await Promise.resolve()
    })

    expect(result.current.workflowVm.phase).toBe('replaying-transition')
    expect(result.current.workflowVm.transitionType).toBe('reload')

    await act(async () => {
      resolveReplay?.(true)
      await confirmPromise
    })

    expect(result.current.workflowVm.phase).toBe('idle')
    expect(result.current.workflowVm.isOpen).toBe(false)
  })
})
