import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  listJobs: vi.fn(),
}))

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/jobs/service', () => ({
  listJobs: mocks.listJobs,
}))

import { loadQuoteHomeBootstrap } from '../estimateCollectionData'

function createQuery(result: { data: unknown; error: unknown }) {
  const self = {
    select: vi.fn(() => self),
    eq: vi.fn(() => self),
    order: vi.fn(() => self),
    in: vi.fn(() => self),
    limit: vi.fn(() => self),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve(resolve(result)),
  }

  return self
}

describe('estimateCollectionData bootstrap', () => {
  beforeEach(() => {
    mocks.from.mockReset()
    mocks.listJobs.mockReset()
  })

  it('builds the bootstrap read model from one decorated estimate collection load and filters eligible jobs', async () => {
    const estimateRows = [
      {
        id: 'estimate-2',
        job_id: 'job-1',
        customer_id: 'customer-1',
        status: 'live',
        version_name: 'Kitchen Revision',
        version_state: 'live',
        version_kind: 'revision',
        version_sort_order: 2,
        created_at: '2026-04-20T10:00:00.000Z',
        updated_at: '2026-04-21T10:00:00.000Z',
      },
      {
        id: 'estimate-1',
        job_id: 'job-2',
        customer_id: 'customer-2',
        status: 'archived',
        version_name: 'Garage Alt',
        version_state: 'archived',
        version_kind: 'alternate',
        version_sort_order: 1,
        created_at: '2026-04-19T10:00:00.000Z',
        updated_at: '2026-04-20T10:00:00.000Z',
      },
      {
        id: 'estimate-3',
        job_id: 'job-1',
        customer_id: 'customer-1',
        status: 'draft',
        version_name: 'Kitchen Draft',
        version_state: 'draft',
        version_kind: 'standard',
        version_sort_order: 3,
        created_at: '2026-04-21T10:00:00.000Z',
        updated_at: '2026-04-22T10:00:00.000Z',
      },
    ]

    mocks.from.mockImplementation((table: string) => {
      if (table === 'estimates') {
        return createQuery({ data: estimateRows, error: null })
      }
      if (table === 'jobs') {
        return createQuery({
          data: [
            { id: 'job-1', title: 'Kitchen', status: 'estimate_sent', estimate_sent_at: null },
            { id: 'job-2', title: 'Garage', status: 'follow_up', estimate_sent_at: null },
          ],
          error: null,
        })
      }
      if (table === 'customers') {
        return createQuery({
          data: [
            { id: 'customer-1', name: 'Alice' },
            { id: 'customer-2', name: 'Bob' },
          ],
          error: null,
        })
      }
      if (table === 'estimate_version_rollups') {
        return createQuery({
          data: [
            { estimate_id: 'estimate-2', final_total: 1300 },
            { estimate_id: 'estimate-1', final_total: 800 },
            { estimate_id: 'estimate-3', final_total: 500 },
          ],
          error: null,
        })
      }

      throw new Error(`Unexpected table ${table}`)
    })

    mocks.listJobs.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'job-x',
          customer_id: null,
          customer_name: null,
          customer_address: null,
          title: 'Ignore me',
          description: null,
          status: 'lead',
          estimate_date: null,
          estimate_sent_at: null,
          scheduled_date: null,
          completed_at: null,
        },
        {
          id: 'job-1',
          customer_id: 'customer-1',
          customer_name: 'Alice',
          customer_address: '123 Main',
          title: 'Kitchen',
          description: null,
          status: 'estimate_pending',
          estimate_date: null,
          estimate_sent_at: null,
          scheduled_date: null,
          completed_at: null,
        },
      ],
    })

    const result = await loadQuoteHomeBootstrap('org-1')

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.summary).toEqual({
      total_versions: 3,
      draft_count: 1,
      sent_or_awaiting_count: 3,
      live_count: 1,
      pipeline_total: 1800,
    })
    expect(result.data.jobCounts).toEqual({
      items: [
        { job_id: 'job-1', version_count: 2 },
        { job_id: 'job-2', version_count: 1 },
      ],
    })
    expect(result.data.jobs).toEqual([
      expect.objectContaining({
        id: 'job-1',
        customer_id: 'customer-1',
        title: 'Kitchen',
      }),
    ])
  })
})
