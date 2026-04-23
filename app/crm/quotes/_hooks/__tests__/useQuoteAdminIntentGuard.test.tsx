import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useQuoteAdminIntentGuard } from '../useQuoteAdminIntentGuard'

describe('useQuoteAdminIntentGuard', () => {
  it('captures the first pending intent while unsaved changes are present', () => {
    const { result } = renderHook(() =>
      useQuoteAdminIntentGuard<string>({
        hasUnsavedChanges: true,
        getHasUnsavedChanges: () => true,
        getIntentType: (intent) => intent,
      })
    )

    act(() => {
      result.current.requestIntent('first', { changed: true, run: vi.fn() })
      result.current.requestIntent('second', { changed: true, run: vi.fn() })
    })

    expect(result.current.discardVm.isOpen).toBe(true)
    expect(result.current.discardVm.status).toBe('confirming')
    expect(result.current.discardVm.intent).toBe('first')
    expect(result.current.discardVm.intentType).toBe('first')
  })

  it('runs immediately when there are no unsaved changes', () => {
    const run = vi.fn(() => 'done')
    const { result } = renderHook(() =>
      useQuoteAdminIntentGuard<{ type: string }>({
        hasUnsavedChanges: false,
        getHasUnsavedChanges: () => false,
        getIntentType: (intent) => intent.type,
      })
    )

    let returned: string | Promise<string> | false = false
    act(() => {
      returned = result.current.requestIntent(
        { type: 'setValue' },
        { changed: true, run }
      )
    })

    expect(returned).toBe('done')
    expect(run).toHaveBeenCalledTimes(1)
    expect(result.current.discardVm.status).toBe('idle')
  })

  it('applies the pending intent once on confirm and blocks duplicate confirms', async () => {
    const applyIntent = vi.fn().mockReturnValue(true)
    const { result } = renderHook(() =>
      useQuoteAdminIntentGuard<{ type: string }>({
        hasUnsavedChanges: true,
        getHasUnsavedChanges: () => true,
        getIntentType: (intent) => intent.type,
      })
    )

    act(() => {
      result.current.requestIntent(
        { type: 'reload' },
        { changed: true, run: vi.fn() }
      )
    })

    await act(async () => {
      await result.current.confirmDiscard(applyIntent)
      await result.current.confirmDiscard(applyIntent)
    })

    expect(applyIntent).toHaveBeenCalledTimes(1)
    expect(applyIntent).toHaveBeenCalledWith({ type: 'reload' })
    expect(result.current.discardVm.status).toBe('idle')
    expect(result.current.discardVm.intent).toBeNull()
  })

  it('tracks applying state for async intent application', async () => {
    let resolveIntent: ((value: boolean) => void) | null = null
    const applyIntent = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveIntent = resolve
        })
    )
    const { result } = renderHook(() =>
      useQuoteAdminIntentGuard<{ type: string }>({
        hasUnsavedChanges: true,
        getHasUnsavedChanges: () => true,
        getIntentType: (intent) => intent.type,
      })
    )

    act(() => {
      result.current.requestIntent(
        { type: 'reload' },
        { changed: true, run: vi.fn() }
      )
    })

    let confirmPromise: ReturnType<typeof result.current.confirmDiscard> | null = null
    await act(async () => {
      confirmPromise = result.current.confirmDiscard(applyIntent)
      await Promise.resolve()
    })

    expect(result.current.discardVm.status).toBe('applying')
    expect(result.current.discardVm.intentType).toBe('reload')

    await act(async () => {
      resolveIntent?.(true)
      await confirmPromise
    })

    expect(result.current.discardVm.status).toBe('idle')
    expect(result.current.discardVm.intent).toBeNull()
  })

  it('clears a pending intent when unsaved changes disappear', () => {
    const { result, rerender } = renderHook(
      ({ hasUnsavedChanges }: { hasUnsavedChanges: boolean }) =>
        useQuoteAdminIntentGuard<string>({
          hasUnsavedChanges,
          getHasUnsavedChanges: () => hasUnsavedChanges,
          getIntentType: (intent) => intent,
        }),
      { initialProps: { hasUnsavedChanges: true } }
    )

    act(() => {
      result.current.requestIntent('pending', { changed: true, run: vi.fn() })
    })

    expect(result.current.discardVm.isOpen).toBe(true)

    rerender({ hasUnsavedChanges: false })

    expect(result.current.discardVm.status).toBe('idle')
    expect(result.current.discardVm.isOpen).toBe(false)
    expect(result.current.discardVm.intent).toBeNull()
  })
})
