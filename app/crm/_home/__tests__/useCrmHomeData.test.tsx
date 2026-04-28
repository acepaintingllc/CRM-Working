import { renderHook, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCrmHomeData } from '../useCrmHomeData'

const { mockAuthedFetch, mockReadStoredCalendarIds } = vi.hoisted(() => ({
  mockAuthedFetch: vi.fn(),
  mockReadStoredCalendarIds: vi.fn(),
}))

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: mockAuthedFetch,
}))

vi.mock('@/lib/crm/home/calendar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/crm/home/calendar')>()
  return {
    ...actual,
    readStoredCalendarIds: mockReadStoredCalendarIds,
  }
})

function createJsonResponse(ok: boolean, payload: unknown, status = 200) {
  return Promise.resolve({
    ok,
    status,
    statusText: ok ? 'OK' : 'Server Error',
    text: () => Promise.resolve(JSON.stringify(payload)),
  })
}

type MockJsonResponse = Awaited<ReturnType<typeof createJsonResponse>>

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve
  })

  return { promise, resolve }
}

describe('useCrmHomeData', () => {
  beforeEach(() => {
    mockAuthedFetch.mockReset()
    mockReadStoredCalendarIds.mockReset()
    mockReadStoredCalendarIds.mockReturnValue(['primary'])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes loading source states before initial resolution', async () => {
    const jobsRequest = createDeferred<Promise<MockJsonResponse>>()

    mockAuthedFetch.mockImplementation((url: string) => {
      if (url === '/api/jobs') return jobsRequest.promise
      if (url === '/api/customers') return createJsonResponse(true, { data: [] })
      if (url === '/api/google-calendar/status') {
        return createJsonResponse(true, { data: { connected: false } })
      }
      if (url === '/api/tasks/dashboard') {
        return createJsonResponse(true, { tasks: { overdue: [], due_today: [] } })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })

    const { result } = renderHook(() => useCrmHomeData())

    expect(result.current.summary.isInitialLoading).toBe(true)
    expect(result.current.sources.jobs.status).toBe('loading')

    jobsRequest.resolve(createJsonResponse(true, { data: [] }))

    await waitFor(() => {
      expect(result.current.summary.isBusy).toBe(false)
    })
  })

  it('full reload preserves previous data while requested sources load again', async () => {
    mockAuthedFetch.mockImplementation((url: string) => {
      if (url === '/api/jobs') {
        return createJsonResponse(true, {
          data: [
            {
              id: 'job-1',
              status: 'completed',
              title: 'Kitchen repaint',
              customer_name: 'Alice Jones',
              customer_address: '123 Main St',
              estimate_total_amount: 1200,
            },
          ],
        })
      }
      if (url === '/api/customers') return createJsonResponse(true, { data: [] })
      if (url === '/api/google-calendar/status') {
        return createJsonResponse(true, { data: { connected: false } })
      }
      if (url === '/api/tasks/dashboard') {
        return createJsonResponse(true, { tasks: { overdue: [], due_today: [] } })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })

    const { result } = renderHook(() => useCrmHomeData())

    await waitFor(() => {
      expect(result.current.summary.isBusy).toBe(false)
    })

    const reloadRequest = createDeferred<Promise<MockJsonResponse>>()
    mockAuthedFetch.mockImplementationOnce(
      () => reloadRequest.promise
    )

    act(() => {
      void result.current.reloadAll()
    })

    expect(result.current.summary.isReloading).toBe(true)
    expect(result.current.data.jobs.length).toBe(1)

    reloadRequest.resolve(
      createJsonResponse(true, {
        data: [
          {
            id: 'job-1',
            status: 'completed',
            title: 'Kitchen repaint',
            customer_name: 'Alice Jones',
            customer_address: '123 Main St',
            estimate_total_amount: 1200,
          },
        ],
      })
    )

    await waitFor(() => {
      expect(result.current.summary.isBusy).toBe(false)
    })
  })

  it('targeted refresh only transitions the requested source slice', async () => {
    mockAuthedFetch.mockImplementation((url: string) => {
      if (url === '/api/jobs') return createJsonResponse(true, { data: [] })
      if (url === '/api/customers') return createJsonResponse(true, { data: [] })
      if (url === '/api/google-calendar/status') {
        return createJsonResponse(true, { data: { connected: false } })
      }
      if (url === '/api/tasks/dashboard') {
        return createJsonResponse(true, { tasks: { overdue: [], due_today: [] } })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })

    const { result } = renderHook(() => useCrmHomeData())

    await waitFor(() => {
      expect(result.current.summary.isBusy).toBe(false)
    })

    const tasksRequest = createDeferred<Promise<MockJsonResponse>>()
    mockAuthedFetch.mockImplementationOnce(
      () => tasksRequest.promise
    )

    act(() => {
      void result.current.refreshSource('tasks')
    })

    expect(result.current.sources.tasks.status).toBe('loading')
    expect(result.current.sources.jobs.status).toBe('ready')

    tasksRequest.resolve(createJsonResponse(true, { tasks: { overdue: [], due_today: [] } }))

    await waitFor(() => {
      expect(result.current.sources.tasks.status).toBe('ready')
    })
  })
})
