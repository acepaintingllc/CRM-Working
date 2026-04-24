import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuoteVersionCreation } from '../useQuoteVersionCreation'

const { push } = vi.hoisted(() => ({
  push: vi.fn(),
}))

const { createQuoteVersion } = vi.hoisted(() => ({
  createQuoteVersion: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/lib/quotes/client', () => ({
  createQuoteVersion,
}))

function createControlledPromise<T>() {
  let resolve: (value: T) => void
  let reject: (reason?: unknown) => void

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  }
}

describe('useQuoteVersionCreation', () => {
  beforeEach(() => {
    push.mockReset()
    createQuoteVersion.mockReset()
  })

  it('creates a quote version and routes to the workspace', async () => {
    createQuoteVersion.mockResolvedValue({ id: 'estimate-99' })

    const { result } = renderHook(() =>
      useQuoteVersionCreation({
        id: 'job-1',
        customer_id: 'customer-1',
      })
    )

    act(() => {
      result.current.setVersionName('  Garage Custom  ')
      result.current.setVersionKind('split')
    })

    await act(async () => {
      await result.current.createVersion()
    })

    expect(createQuoteVersion).toHaveBeenCalledWith({
      job_id: 'job-1',
      customer_id: 'customer-1',
      version_kind: 'split',
      version_name: 'Garage Custom',
    })
    expect(push).toHaveBeenCalledWith('/crm/quotes/estimate-99')
  })

  it('surfaces the shared required-job error when no job is selected', async () => {
    const { result } = renderHook(() => useQuoteVersionCreation(null))

    await act(async () => {
      await result.current.createVersion()
    })

    expect(createQuoteVersion).not.toHaveBeenCalled()
    expect(result.current.error).toBe('Select a job before creating a version.')
  })

  it('keeps draft fields intact until the page controller resets them', async () => {
    const firstJob = { id: 'job-1', customer_id: 'customer-1' }
    const nextJob = { id: 'job-2', customer_id: 'customer-2' }

    const { result, rerender } = renderHook(({ selectedJob }) => useQuoteVersionCreation(selectedJob), {
      initialProps: { selectedJob: firstJob },
    })

    act(() => {
      result.current.setVersionName('Custom')
      result.current.setVersionKind('revision')
    })

    rerender({ selectedJob: nextJob })

    expect(result.current.versionName).toBe('Custom')
    expect(result.current.versionKind).toBe('revision')
  })

  it('creates with the latest selected job when the visible selection changes', async () => {
    createQuoteVersion.mockResolvedValue({ id: 'estimate-99' })
    const firstJob = { id: 'job-1', customer_id: 'customer-1' }
    const nextJob = { id: 'job-2', customer_id: 'customer-2' }

    const { result, rerender } = renderHook(({ selectedJob }) => useQuoteVersionCreation(selectedJob), {
      initialProps: { selectedJob: firstJob },
    })

    act(() => {
      result.current.setVersionName('Garage')
      result.current.setVersionKind('alternate')
    })

    rerender({ selectedJob: nextJob })

    await act(async () => {
      await result.current.createVersion()
    })

    expect(createQuoteVersion).toHaveBeenCalledWith({
      job_id: 'job-2',
      customer_id: 'customer-2',
      version_kind: 'alternate',
      version_name: 'Garage',
    })
  })

  it('coalesces rapid duplicate create calls into one request', async () => {
    const pendingCreate = createControlledPromise<{ id: string }>()
    createQuoteVersion.mockReturnValue(pendingCreate.promise)

    const { result } = renderHook(() =>
      useQuoteVersionCreation({
        id: 'job-1',
        customer_id: 'customer-1',
      })
    )
    const createCalls: Array<Promise<{ id: string } | null>> = []

    act(() => {
      createCalls.push(result.current.createVersion())
      createCalls.push(result.current.createVersion())
    })

    expect(createQuoteVersion).toHaveBeenCalledTimes(1)

    await act(async () => {
      pendingCreate.resolve({ id: 'estimate-99' })
      await Promise.all(createCalls)
    })

    expect(push).toHaveBeenCalledWith('/crm/quotes/estimate-99')
  })

  it('allows a new create call after a successful create settles', async () => {
    createQuoteVersion.mockResolvedValueOnce({ id: 'estimate-1' }).mockResolvedValueOnce({ id: 'estimate-2' })

    const { result } = renderHook(() =>
      useQuoteVersionCreation({
        id: 'job-1',
        customer_id: 'customer-1',
      })
    )

    await act(async () => {
      await result.current.createVersion()
    })

    await act(async () => {
      await result.current.createVersion()
    })

    expect(createQuoteVersion).toHaveBeenCalledTimes(2)
    expect(push).toHaveBeenNthCalledWith(1, '/crm/quotes/estimate-1')
    expect(push).toHaveBeenNthCalledWith(2, '/crm/quotes/estimate-2')
  })

  it('allows a new create call after a failed create settles', async () => {
    createQuoteVersion.mockRejectedValueOnce(new Error('Creation failed')).mockResolvedValueOnce({ id: 'estimate-2' })

    const { result } = renderHook(() =>
      useQuoteVersionCreation({
        id: 'job-1',
        customer_id: 'customer-1',
      })
    )

    await act(async () => {
      await result.current.createVersion()
    })

    expect(result.current.error).toBe('Creation failed')

    await act(async () => {
      await result.current.createVersion()
    })

    expect(createQuoteVersion).toHaveBeenCalledTimes(2)
    expect(result.current.error).toBeNull()
    expect(push).toHaveBeenCalledWith('/crm/quotes/estimate-2')
  })
})
