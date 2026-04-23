import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useGuardedEditorWorkflow } from '../useGuardedEditorWorkflow'

describe('useGuardedEditorWorkflow', () => {
  it('queues one transition at a time and exposes discard state', () => {
    const { result } = renderHook(() =>
      useGuardedEditorWorkflow<string>({
        isDirty: true,
      })
    )

    act(() => {
      result.current.runGuarded('first', {
        changed: true,
        run: vi.fn(),
      })
      result.current.runGuarded('second', {
        changed: true,
        run: vi.fn(),
      })
    })

    expect(result.current.workflowVm.isOpen).toBe(true)
    expect(result.current.workflowVm.phase).toBe('confirming-discard')
    expect(result.current.workflowVm.pendingTransition).toBe('first')
    expect(result.current.workflowVm.pendingTransitionType).toBe('first')
  })

  it('tracks pending mutations as unsaved changes and opens or cancels discard confirmation', () => {
    const { result } = renderHook(() =>
      useGuardedEditorWorkflow<string>({
        isDirty: false,
      })
    )

    expect(result.current.workflowVm.hasUnsavedChanges).toBe(false)
    expect(result.current.workflowVm.hasPendingMutation).toBe(false)

    act(() => {
      result.current.markPendingMutation()
    })

    expect(result.current.workflowVm.hasUnsavedChanges).toBe(true)
    expect(result.current.workflowVm.hasPendingMutation).toBe(true)

    act(() => {
      result.current.runGuarded('pending', {
        changed: true,
        run: vi.fn(),
      })
    })

    expect(result.current.workflowVm.isOpen).toBe(true)
    expect(result.current.workflowVm.transitionType).toBe('pending')

    act(() => {
      result.current.cancelDiscard()
    })

    expect(result.current.workflowVm.isOpen).toBe(false)
    expect(result.current.workflowVm.pendingTransition).toBeNull()

    act(() => {
      result.current.resetPendingMutation()
    })

    expect(result.current.workflowVm.hasPendingMutation).toBe(false)
    expect(result.current.workflowVm.hasUnsavedChanges).toBe(false)
  })

  it('replays the pending transition on confirm', async () => {
    const replay = vi.fn((transition: string) => transition === 'confirmed')
    const { result } = renderHook(() =>
      useGuardedEditorWorkflow<string>({
        isDirty: true,
      })
    )

    act(() => {
      result.current.runGuarded('confirmed', {
        changed: true,
        run: vi.fn(),
      })
    })

    let confirmed = false
    await act(async () => {
      confirmed = await result.current.confirmDiscard(replay)
    })

    expect(confirmed).toBe(true)
    expect(replay).toHaveBeenCalledWith('confirmed')
    expect(result.current.workflowVm.phase).toBe('idle')
    expect(result.current.workflowVm.pendingTransition).toBeNull()
  })

  it('creates a guarded action that runs immediately when the editor is clean', () => {
    const executeTransition = vi.fn((transition: { type: string; value: string }) => transition.value)
    const { result } = renderHook(() =>
      useGuardedEditorWorkflow<{ type: string; value: string }>({
        isDirty: false,
      })
    )

    const runAction = result.current.createGuardedAction(executeTransition, {
      getTransition: (value: string) => ({ type: 'setValue', value }),
      changed: (value: string) => value.length > 0,
    })

    let returned: string | Promise<string> | false = false
    act(() => {
      returned = runAction('ready')
    })

    expect(returned).toBe('ready')
    expect(executeTransition).toHaveBeenCalledWith({ type: 'setValue', value: 'ready' })
    expect(result.current.workflowVm.phase).toBe('idle')
  })

  it('creates a guarded action that queues and replays through the shared executor', async () => {
    const executeTransition = vi.fn((transition: { type: string; value: string }) => transition.value === 'queued')
    const { result } = renderHook(() =>
      useGuardedEditorWorkflow<{ type: string; value: string }>({
        isDirty: true,
      })
    )

    const runAction = result.current.createGuardedAction(executeTransition, {
      getTransition: (value: string) => ({ type: 'setValue', value }),
      changed: (value: string) => value.length > 0,
    })

    act(() => {
      runAction('queued')
    })

    expect(result.current.workflowVm.isOpen).toBe(true)
    expect(executeTransition).not.toHaveBeenCalled()

    let confirmed = false
    await act(async () => {
      confirmed = await result.current.confirmDiscard(executeTransition)
    })

    expect(confirmed).toBe(true)
    expect(executeTransition).toHaveBeenCalledWith({ type: 'setValue', value: 'queued' })
    expect(result.current.workflowVm.phase).toBe('idle')
  })

  it('supports async replay and exposes replaying-transition', async () => {
    let resolveReplay: ((value: boolean) => void) | null = null
    const replay = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveReplay = resolve
        })
    )
    const { result } = renderHook(() =>
      useGuardedEditorWorkflow<string>({
        isDirty: true,
      })
    )

    act(() => {
      result.current.runGuarded('reload', {
        changed: true,
        run: vi.fn(),
      })
    })

    let confirmPromise: ReturnType<typeof result.current.confirmDiscard> | null = null
    await act(async () => {
      confirmPromise = result.current.confirmDiscard(replay)
      await Promise.resolve()
    })

    expect(result.current.workflowVm.phase).toBe('replaying-transition')
    expect(result.current.workflowVm.pendingTransitionType).toBe('reload')

    await act(async () => {
      resolveReplay?.(true)
      await confirmPromise
    })

    expect(result.current.workflowVm.phase).toBe('idle')
    expect(result.current.workflowVm.pendingTransition).toBeNull()
  })

  it('automatically clears pending workflow state when the editor becomes clean', () => {
    const { result, rerender } = renderHook(
      ({ isDirty }: { isDirty: boolean }) =>
        useGuardedEditorWorkflow<string>({
          isDirty,
        }),
      { initialProps: { isDirty: true } }
    )

    act(() => {
      result.current.markPendingMutation()
      result.current.runGuarded('pending', {
        changed: true,
        run: vi.fn(),
      })
    })

    expect(result.current.workflowVm.isOpen).toBe(true)
    expect(result.current.workflowVm.hasUnsavedChanges).toBe(true)

    rerender({ isDirty: false })

    expect(result.current.workflowVm.phase).toBe('idle')
    expect(result.current.workflowVm.isOpen).toBe(false)
    expect(result.current.workflowVm.pendingTransition).toBeNull()
    expect(result.current.workflowVm.hasPendingMutation).toBe(false)
    expect(result.current.workflowVm.hasUnsavedChanges).toBe(false)
  })
})
