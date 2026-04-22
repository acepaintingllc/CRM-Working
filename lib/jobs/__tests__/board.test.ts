import test from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveJobActivitySummary,
  filterCompletedJobs,
  getVisibleJobBoardColumns,
  groupJobsByStatus,
} from '../board.ts'
import type { JobSummary } from '../client.ts'

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

test('jobs board helpers derive the most recent activity items', () => {
  assert.deepEqual(deriveJobActivitySummary(baseJob), [
    { label: 'Review email sent', at: '2026-04-21T12:00:00.000Z' },
    { label: 'Completed', at: '2026-04-21T10:00:00.000Z' },
  ])
})

test('jobs board helpers filter and sort completed jobs', () => {
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

  assert.deepEqual(results.map((job) => job.id), ['job-2'])
})

test('jobs board helpers hide completed and lost columns unless enabled', () => {
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

  assert.deepEqual(visible.map((column) => column.key), ['estimate_scheduled'])
})
