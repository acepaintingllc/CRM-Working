import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSWRWrapper } from '@/app/crm/__tests__/swrTestUtils'
import type { JobStatus } from '@/lib/jobs/types'

const authedFetch = vi.fn()
const invalidateSwrKey = vi.fn<(key: string) => Promise<unknown>>()

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: (input: RequestInfo | URL, init?: RequestInit) => authedFetch(input, init),
}))

vi.mock('@/app/crm/_hooks/swrCache', () => ({
  invalidateSwrKey: (key: string) => invalidateSwrKey(key),
}))

vi.mock('@/lib/jobs/client', () => ({
  fetchJobList: vi.fn(),
  patchJobStatus: vi.fn(),
  patchJobDateFields: vi.fn(),
}))

import { useJobsBoardPage } from '../_hooks/useJobsBoardPage'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const jobs = [
  {
    id: 'job-1',
    customer_id: 'customer-1',
    customer_name: 'Alice',
    customer_address: '123 Main St',
    title: 'Paint house',
    description: 'Exterior',
    status: 'estimate_sent',
    estimate_date: '2026-04-10T10:00:00.000Z',
    estimate_sent_at: null,
    scheduled_date: null,
    scheduled_end_date: null,
    completed_at: null,
  },
  {
    id: 'job-2',
    customer_id: 'customer-2',
    customer_name: 'Bob',
    customer_address: '456 Oak Ave',
    title: 'Interior repaint',
    description: 'Kitchen',
    status: 'completed',
    estimate_date: null,
    estimate_sent_at: null,
    scheduled_date: null,
    scheduled_end_date: null,
    completed_at: '2026-04-21T10:00:00.000Z',
  },
] as const

describe('useJobsBoardPage', () => {
  beforeEach(() => {
    mockPush.mockReset()
    invalidateSwrKey.mockClear()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
  })

  it('loads the board and patches status fields', async () => {
    const fetchJobList = vi.fn(async () => [...jobs])
    const patchJobStatus = vi.fn(async () => ({ status: 'follow_up' as JobStatus }))

    const { result } = renderHook(() =>
      useJobsBoardPage({
        fetchJobList,
        patchJobStatus,
      })
    , { wrapper: createSWRWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.grouped.estimate_sent).toHaveLength(1)

    await act(async () => {
      await result.current.runBoardAction(result.current.grouped.estimate_sent[0], {
        id: 'move_to_follow_up',
        kind: 'patch_status',
        tone: 'default',
        label: 'Move to follow up',
        status: 'follow_up',
      })
    })

    expect(patchJobStatus).toHaveBeenCalledWith('job-1', 'follow_up')
    expect(result.current.grouped.follow_up).toHaveLength(1)
    expect(invalidateSwrKey).toHaveBeenCalledWith('/api/jobs')
  })

  it('opens stage email and closeout flows from board actions', async () => {
    const { result } = renderHook(() =>
      useJobsBoardPage({
        fetchJobList: async () => [...jobs],
        patchJobDateFields: async () => ({ completed_at: '2026-04-21T12:00:00.000Z' }),
      })
    , { wrapper: createSWRWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.runBoardAction(result.current.grouped.estimate_sent[0], {
        id: 'send_follow_up',
        kind: 'stage_email',
        tone: 'default',
        label: 'Send follow up',
        stage: 'follow_up',
      })
    })

    expect(result.current.emailJobId).toBe('job-1')
    expect(result.current.emailStage).toBe('follow_up')

    await act(async () => {
      await result.current.runBoardAction(result.current.grouped.completed[0], {
        id: 'open_closeout',
        kind: 'open_closeout',
        tone: 'accent',
        label: 'Open closeout',
      })
    })

    expect(result.current.closeoutJobId).toBe('job-2')
  })

  it('filters completed jobs through the controller state', async () => {
    const { result } = renderHook(() =>
      useJobsBoardPage({
        fetchJobList: async () => [...jobs],
      })
    , { wrapper: createSWRWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setCompletedQuery('bob')
    })

    expect(result.current.filteredCompleted.map((job) => job.id)).toEqual(['job-2'])
  })
})
