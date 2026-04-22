import { describe, expect, it } from 'vitest'
import {
  deriveJobActivitySummary,
  filterCompletedJobs,
  getVisibleJobBoardColumns,
  groupJobsByStatus,
} from '@/lib/jobs/board'
import type { JobSummary } from '@/lib/jobs/client'

const baseJob: JobSummary = {
  id: 'job-1',
  customer_id: 'customer-1',
  customer_name: 'Alice',
  customer_address: '123 Main St, Austin, TX',
  title: 'Paint house',
  description: 'Exterior repaint',
  status: 'completed',
  estimate_date: '2026-04-10T10:00:00.000Z',
  estimate_sent_at: '2026-04-11T10:00:00.000Z',
  scheduled_date: '2026-04-20T10:00:00.000Z',
  scheduled_end_date: '2026-04-20T18:00:00.000Z',
  completed_at: '2026-04-21T10:00:00.000Z',
  created_at: '2026-04-09T10:00:00.000Z',
  completed_email_sent_at: '2026-04-21T12:00:00.000Z',
}

describe('job board helpers', () => {
  it('derives the most recent activity items', () => {
    expect(deriveJobActivitySummary(baseJob)).toEqual([
      { label: 'Review email sent', at: '2026-04-21T12:00:00.000Z' },
      { label: 'Completed', at: '2026-04-21T10:00:00.000Z' },
    ])
  })

  it('filters and sorts completed jobs', () => {
    const results = filterCompletedJobs({
      jobs: [
        baseJob,
        {
          ...baseJob,
          id: 'job-2',
          title: 'Interior touchups',
          customer_name: 'Bob',
          completed_at: '2026-04-22T10:00:00.000Z',
        },
      ],
      query: 'bob',
      showAll: false,
    })

    expect(results.map((job) => job.id)).toEqual(['job-2'])
  })

  it('hides completed and lost columns unless enabled', () => {
    const grouped = groupJobsByStatus([
      { ...baseJob, status: 'estimate_scheduled' },
      baseJob,
      { ...baseJob, id: 'job-3', status: 'lost' },
    ])

    const visible = getVisibleJobBoardColumns({
      columns: [
        { key: 'estimate_scheduled', title: 'Quote scheduled' },
        { key: 'completed', title: 'Completed' },
        { key: 'lost', title: 'Lost' },
      ],
      grouped,
      showCompleted: false,
      showLost: false,
      showEmptyStages: true,
    })

    expect(visible.map((column) => column.key)).toEqual(['estimate_scheduled'])
  })
})
