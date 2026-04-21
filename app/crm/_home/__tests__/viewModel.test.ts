import { describe, expect, it } from 'vitest'
import { createCrmHomeSourceState } from '@/lib/crm/home/state'
import { buildCrmHomePageViewModel } from '../viewModel'
import { createHomeResolvedState } from './helpers'

function createViewModel(options?: {
  sourceOverrides?: Record<string, ReturnType<typeof createCrmHomeSourceState>>
  jobs?: Array<{
    id: string
    status: string | null
    title: string | null
    customer_name: string | null
    customer_address: string | null
    estimate_total_amount: number | string | null
  }>
  customers?: Array<{
    id: string
    name: string | null
    email: string | null
    phone: string | null
    address: string | null
  }>
  calendarConnected?: boolean | null
}) {
  const state = createHomeResolvedState({
    jobs: options?.jobs,
    customers: options?.customers,
    calendarConnected: options?.calendarConnected,
    sourceOverrides: options?.sourceOverrides,
  })

  return buildCrmHomePageViewModel({
    data: state.data,
    sources: state.sources,
    summary: state.summary,
    search: 'Alice',
  })
}

describe('buildCrmHomePageViewModel', () => {
  it('shapes loading state for metrics and signals from source summary', () => {
    const viewModel = createViewModel({
      sourceOverrides: {
        jobs: createCrmHomeSourceState('loading', 'missing'),
        calendarStatus: createCrmHomeSourceState('loading', 'missing'),
        calendarEvents: createCrmHomeSourceState('loading', 'missing'),
        notes: createCrmHomeSourceState('loading', 'missing'),
      },
    })

    expect(viewModel.metrics.isLoading).toBe(true)
    expect(viewModel.signals.calendar.loading).toBe(true)
    expect(viewModel.signals.reminders.loading).toBe(true)
  })

  it('shapes banner state for critical and warning source errors', () => {
    const critical = createViewModel({
      sourceOverrides: {
        jobs: createCrmHomeSourceState(
          'error',
          'unavailable',
          'Unable to load jobs.',
          '2026-04-21T12:00:00.000Z'
        ),
      },
    })
    const warning = createViewModel({
      sourceOverrides: {
        notes: createCrmHomeSourceState(
          'degraded',
          'invalid',
          'Malformed notes dashboard response.',
          '2026-04-21T12:00:00.000Z'
        ),
      },
    })

    expect(critical.statusBanner?.tone).toBe('critical')
    expect(critical.statusBanner?.message).toContain('Unable to load jobs.')
    expect(critical.metrics.isUnavailable).toBe(true)
    expect(warning.statusBanner?.tone).toBe('warning')
    expect(warning.statusBanner?.message).toContain('Notes')
  })

  it('keeps separate calendar errors and search open state', () => {
    const viewModel = createViewModel({
      sourceOverrides: {
        calendarStatus: createCrmHomeSourceState(
          'degraded',
          'invalid',
          'Malformed calendar status response.',
          '2026-04-21T12:00:00.000Z'
        ),
        calendarEvents: createCrmHomeSourceState(
          'error',
          'unavailable',
          'Unable to load calendar events.',
          '2026-04-21T12:00:00.000Z'
        ),
      },
    })

    expect(viewModel.signals.calendar.errors).toEqual([
      'Malformed calendar status response.',
      'Unable to load calendar events.',
    ])
    expect(viewModel.topBar.search.isOpen).toBe(true)
    expect(viewModel.topBar.search.sections).toEqual([
      {
        key: 'customers',
        label: 'Customers',
        items: [
          {
            key: 'customer-1',
            href: '/crm/customers/customer-1',
            title: 'Alice Jones',
            subtitle: 'alice@example.com • 555-1111',
          },
        ],
      },
      {
        key: 'jobs',
        label: 'Jobs',
        items: [
          {
            key: 'job-1',
            href: '/crm/jobs/job-1',
            title: 'Kitchen repaint',
            subtitle: 'Alice Jones',
          },
        ],
      },
    ])
  })

  it('treats invalid notes data as degraded instead of empty', () => {
    const viewModel = createViewModel({
      sourceOverrides: {
        notes: createCrmHomeSourceState(
          'degraded',
          'invalid',
          'Malformed notes dashboard response.',
          '2026-04-21T12:00:00.000Z'
        ),
      },
    })

    expect(viewModel.signals.reminders.errors).toEqual(['Malformed notes dashboard response.'])
    expect(viewModel.signals.reminders.isEmpty).toBe(true)
    expect(viewModel.activity.items[0]?.amountLabel).toBe('$1,200')
    expect(viewModel.activity.tasksHref).toBe('/crm/notes/tasks')
    expect(viewModel.quickActions.items.length).toBe(4)
  })

  it('treats mixed non-critical source failures as a warning banner only', () => {
    const viewModel = createViewModel({
      sourceOverrides: {
        calendarStatus: createCrmHomeSourceState(
          'degraded',
          'invalid',
          'Malformed calendar status response.',
          '2026-04-21T12:00:00.000Z'
        ),
        notes: createCrmHomeSourceState(
          'degraded',
          'invalid',
          'Malformed notes dashboard response.',
          '2026-04-21T12:00:00.000Z'
        ),
      },
    })

    expect(viewModel.statusBanner?.tone).toBe('warning')
    expect(viewModel.statusBanner?.message).toContain('Calendar status')
    expect(viewModel.statusBanner?.message).toContain('Notes')
    expect(viewModel.metrics.isUnavailable).toBe(false)
  })
})
