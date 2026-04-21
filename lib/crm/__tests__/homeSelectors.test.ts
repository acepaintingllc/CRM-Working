import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCrmHomeMetrics,
  buildNotesReminders,
  buildSearchResults,
} from '../home/selectors.ts'
import type {
  DashboardCustomer,
  DashboardJob,
  NotesDashboardPayload,
} from '../home/types.ts'

function makeJob(overrides: Partial<DashboardJob> = {}): DashboardJob {
  return {
    id: 'job-1',
    status: 'estimate_scheduled',
    title: 'Kitchen repaint',
    customer_name: 'Alice Jones',
    customer_address: '123 Main St',
    estimate_total_amount: 1000,
    ...overrides,
  }
}

function makeCustomer(overrides: Partial<DashboardCustomer> = {}): DashboardCustomer {
  return {
    id: 'customer-1',
    name: 'Alice Jones',
    email: 'alice@example.com',
    phone: '555-1111',
    address: '123 Main St',
    ...overrides,
  }
}

test('buildCrmHomeMetrics computes won, lost, totals, and averages', () => {
  const metrics = buildCrmHomeMetrics([
    makeJob({ id: 'won-1', status: 'completed', estimate_total_amount: '1000' }),
    makeJob({ id: 'won-2', status: 'completed', estimate_total_amount: 500 }),
    makeJob({ id: 'lost-1', status: 'lost', estimate_total_amount: 250 }),
    makeJob({ id: 'open-1', status: 'estimate_sent', estimate_total_amount: 750 }),
    makeJob({ id: 'open-2', status: 'follow_up', estimate_total_amount: 'invalid' }),
  ])

  assert.equal(metrics.won, 2)
  assert.equal(metrics.lost, 1)
  assert.equal(metrics.total, 3)
  assert.equal(metrics.winRate, 67)
  assert.equal(metrics.avgTicket, 750)
  assert.equal(metrics.salesTotal, 1500)
  assert.equal(metrics.pipelineTotal, 2500)
  assert.equal(metrics.totalEstimates, 5)
  assert.equal(metrics.openJobsCount, 2)
  assert.equal(metrics.openJobsTotal, 750)
  assert.equal(metrics.openJobsAvgValue, 750)
})

test('buildSearchResults trims, lowercases, and enforces limits', () => {
  const customers = [
    makeCustomer({ id: '1', name: 'Alice Jones' }),
    makeCustomer({ id: '2', name: 'Alicia North' }),
    makeCustomer({ id: '3', name: 'Bob Smith' }),
  ]
  const jobs = [
    makeJob({ id: 'j1', title: 'Alice exterior', customer_name: 'Alice Jones' }),
    makeJob({ id: 'j2', title: 'Bob interior', customer_name: 'Bob Smith' }),
  ]

  const results = buildSearchResults(customers, jobs, '  alice ', 1)

  assert.equal(results.customers.length, 1)
  assert.equal(results.customers[0]?.id, '1')
  assert.equal(results.jobs.length, 1)
  assert.equal(results.jobs[0]?.id, 'j1')
})

test('buildNotesReminders orders overdue before due today and applies limits', () => {
  const payload: NotesDashboardPayload = {
    tasks: {
      overdue: [
        {
          id: 'task-overdue-late',
          title: 'Late',
          description: null,
          due_at: '2026-04-20T16:00:00.000Z',
          is_all_day: false,
          has_due_time: true,
        },
        {
          id: 'task-overdue-early',
          title: 'Early',
          description: null,
          due_at: '2026-04-20T10:00:00.000Z',
          is_all_day: false,
          has_due_time: true,
        },
      ],
      due_today: [
        {
          id: 'task-today-1',
          title: 'Today 1',
          description: null,
          due_at: '2026-04-21T09:00:00.000Z',
          is_all_day: false,
          has_due_time: true,
        },
        {
          id: 'task-today-2',
          title: 'Today 2',
          description: null,
          due_at: '2026-04-21T12:00:00.000Z',
          is_all_day: false,
          has_due_time: true,
        },
      ],
    },
  }

  const reminders = buildNotesReminders(payload, 3)

  assert.deepEqual(
    reminders.map((item) => item.task.id),
    ['task-overdue-early', 'task-overdue-late', 'task-today-1']
  )
})
