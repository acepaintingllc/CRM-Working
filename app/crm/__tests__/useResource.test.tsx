import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useResource } from '../_hooks/useResource'

describe('useResource', () => {
  it('can skip the initial auto-load for seeded resources', async () => {
    const load = vi.fn(async () => 'loaded')

    const { result } = renderHook(() =>
      useResource({
        initialData: 'seeded',
        initialLoading: false,
        skipInitialLoad: true,
        load,
        getErrorMessage: (error) => (error instanceof Error ? error.message : 'load failed'),
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(load).not.toHaveBeenCalled()
    expect(result.current.data).toBe('seeded')
    expect(result.current.error).toBeNull()
  })

  it('only skips the first auto-load and still reloads when the key changes', async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('first-reload')
      .mockResolvedValueOnce('second-reload')

    const { result, rerender } = renderHook(({ token }: { token: string }) =>
      useResource({
        initialData: 'seeded',
        initialLoading: false,
        skipInitialLoad: true,
        load,
        getErrorMessage: (error) => (error instanceof Error ? error.message : 'load failed'),
        reloadKey: token,
      }),
      {
        initialProps: { token: 'first' },
      }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(load).not.toHaveBeenCalled()

    rerender({ token: 'second' })

    await waitFor(() => expect(result.current.data).toBe('first-reload'))
    expect(load).toHaveBeenCalledTimes(1)

    rerender({ token: 'third' })

    await waitFor(() => expect(result.current.data).toBe('second-reload'))
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('keeps the current data when resetOnError is disabled', async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('loaded')
      .mockRejectedValueOnce(new Error('refresh failed'))

    const { result } = renderHook(() =>
      useResource({
        initialData: 'seeded',
        load,
        resetOnError: false,
        getErrorMessage: (error) => (error instanceof Error ? error.message : 'load failed'),
      })
    )

    await waitFor(() => expect(result.current.data).toBe('loaded'))

    let refreshed = true
    await act(async () => {
      refreshed = await result.current.refresh()
    })

    expect(refreshed).toBe(false)
    expect(result.current.data).toBe('loaded')
    expect(result.current.error).toBe('refresh failed')
  })
})
