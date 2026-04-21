import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useLoadableResource } from '../_hooks/useLoadableResource'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

describe('useLoadableResource', () => {
  it('ignores stale responses from older refresh calls', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    let activePromise = first.promise
    const load = vi.fn(() => activePromise)

    const { result, rerender } = renderHook(({ token }: { token: string }) =>
      useLoadableResource({
        initialData: '',
        load,
        getErrorMessage: (error) => (error instanceof Error ? error.message : 'load failed'),
        reloadKey: token,
      }),
      { initialProps: { token: 'first' } }
    )

    activePromise = second.promise
    rerender({ token: 'second' })

    second.resolve('second')
    await waitFor(() => expect(result.current.data).toBe('second'))

    first.resolve('first')
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.data).toBe('second')
    expect(result.current.error).toBeNull()
  })

  it('resets to initial data and surfaces normalized errors', async () => {
    const { result } = renderHook(() =>
      useLoadableResource({
        initialData: ['seed'],
        load: async () => {
          throw new Error('boom')
        },
        getErrorMessage: (error) => (error instanceof Error ? error.message : 'load failed'),
        reloadKey: 'seed',
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(['seed'])
    expect(result.current.error).toBe('boom')
  })
})
