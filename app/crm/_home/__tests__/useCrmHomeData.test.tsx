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
    json: () => Promise.resolve(payload),
  })
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
    let releaseJobs: (() => void) | null = null
    const jobsPromise = new Promise((resolve) => {
      releaseJobs = () => resolve(createJsonResponse(true, { jobs: [] }))
    })

    mockAuthedFetch.mockImplementation((url: string) => {
      if (url === '/api/jobs') return jobsPromise
      if (url === '/api/customers') return createJsonResponse(true, { customers: [] })
      if (url === '/api/google-calendar/status') {
        return createJsonResponse(true, { connected: false })
      }
      if (url === '/api/notes/dashboard') {
        return createJsonResponse(true, { tasks: { overdue: [], due_today: [] } })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })

    const { result } = renderHook(() => useCrmHomeData())

    expect(result.current.summary.isInitialLoading).toBe(true)
    expect(result.current.sources.jobs.status).toBe('loading')

    releaseJobs?.()

    await waitFor(() => {
      expect(result.current.summary.isBusy).toBe(false)
    })
  })

  it('full reload preserves previous data while requested sources load again', async () => {
    mockAuthedFetch.mockImplementation((url: string) => {
      if (url === '/api/jobs') {
        return createJsonResponse(true, {
          jobs: [
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
      if (url === '/api/customers') return createJsonResponse(true, { customers: [] })
      if (url === '/api/google-calendar/status') {
        return createJsonResponse(true, { connected: false })
      }
      if (url === '/api/notes/dashboard') {
        return createJsonResponse(true, { tasks: { overdue: [], due_today: [] } })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })

    const { result } = renderHook(() => useCrmHomeData())

    await waitFor(() => {
      expect(result.current.summary.isBusy).toBe(false)
    })

    let releaseReload: (() => void) | null = null
    mockAuthedFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseReload = () =>
            resolve(
              createJsonResponse(true, {
                jobs: [
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
        })
    )

    act(() => {
      void result.current.reloadAll()
    })

    expect(result.current.summary.isReloading).toBe(true)
    expect(result.current.data.jobs.length).toBe(1)

    releaseReload?.()

    await waitFor(() => {
      expect(result.current.summary.isBusy).toBe(false)
    })
  })

  it('targeted refresh only transitions the requested source slice', async () => {
    mockAuthedFetch.mockImplementation((url: string) => {
      if (url === '/api/jobs') return createJsonResponse(true, { jobs: [] })
      if (url === '/api/customers') return createJsonResponse(true, { customers: [] })
      if (url === '/api/google-calendar/status') return createJsonResponse(true, { connected: false })
      if (url === '/api/notes/dashboard') {
        return createJsonResponse(true, { tasks: { overdue: [], due_today: [] } })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })

    const { result } = renderHook(() => useCrmHomeData())

    await waitFor(() => {
      expect(result.current.summary.isBusy).toBe(false)
    })

    let releaseNotes: (() => void) | null = null
    mockAuthedFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseNotes = () =>
            resolve(createJsonResponse(true, { tasks: { overdue: [], due_today: [] } }))
        })
    )

    act(() => {
      void result.current.refreshSource('notes')
    })

    expect(result.current.sources.notes.status).toBe('loading')
    expect(result.current.sources.jobs.status).toBe('ready')

    releaseNotes?.()

    await waitFor(() => {
      expect(result.current.sources.notes.status).toBe('ready')
    })
  })
})
