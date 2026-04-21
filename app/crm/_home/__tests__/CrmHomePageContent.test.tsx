import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CrmHomePageContent } from '../CrmHomePageContent'
import { createCrmHomeSourceState, createInitialCrmHomeLoadState } from '@/lib/crm/home/state'
import { createHomeResolvedState } from './helpers'

const { mockUseCrmHomeData } = vi.hoisted(() => ({
  mockUseCrmHomeData: vi.fn(),
}))

vi.mock('../useCrmHomeData', () => ({
  useCrmHomeData: mockUseCrmHomeData,
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: ComponentPropsWithoutRef<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

function createHookValue({
  sourceOverrides = {},
  jobs = [
    {
      id: 'job-1',
      status: 'estimate_sent',
      title: 'Kitchen repaint',
      customer_name: 'Alice Jones',
      customer_address: '123 Main St',
      estimate_total_amount: 1200,
    },
  ],
  customers = [
    {
      id: 'customer-1',
      name: 'Alice Jones',
      email: 'alice@example.com',
      phone: '555-1111',
      address: '123 Main St',
    },
  ],
  calendarConnected = true,
  calendarTodayEvents = [] as Array<{
    id: string
    calendarId: string
    summary: string | null
    start: string | null
    end: string | null
    htmlLink: string | null
  }>,
  notesReminders = [] as Array<{
    kind: 'overdue' | 'due_today'
    task: {
      id: string
      title: string
      description: string | null
      due_at: string | null
      is_all_day: boolean
      has_due_time: boolean
    }
  }>,
  reloadAll = vi.fn(),
  refreshSource = vi.fn(),
}: {
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
  calendarTodayEvents?: Array<{
    id: string
    calendarId: string
    summary: string | null
    start: string | null
    end: string | null
    htmlLink: string | null
  }>
  notesReminders?: Array<{
    kind: 'overdue' | 'due_today'
    task: {
      id: string
      title: string
      description: string | null
      due_at: string | null
      is_all_day: boolean
      has_due_time: boolean
    }
  }>
  reloadAll?: ReturnType<typeof vi.fn>
  refreshSource?: ReturnType<typeof vi.fn>
}) {
  const state = createHomeResolvedState({
    jobs,
    customers,
    calendarConnected,
    calendarTodayEvents,
    notesReminders,
    sourceOverrides: {
      calendarEvents: createCrmHomeSourceState(
        'ready',
        calendarConnected ? 'available' : 'missing',
        null,
        '2026-04-21T12:00:00.000Z'
      ),
      ...(sourceOverrides ?? {}),
    },
  })

  return {
    data: state.data,
    sources: state.sources,
    summary: state.summary,
    reloadAll,
    refreshSource,
  }
}

describe('CrmHomePageContent', () => {
  beforeEach(() => {
    mockUseCrmHomeData.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the loading state', () => {
    const state = createInitialCrmHomeLoadState(new Date('2026-04-21T12:00:00.000Z'))
    mockUseCrmHomeData.mockReturnValue({
      data: state.data,
      sources: state.sources,
      summary: state.summary,
      reloadAll: vi.fn(),
      refreshSource: vi.fn(),
    })

    render(<CrmHomePageContent />)

    expect(screen.getByRole('status').textContent).toContain('Loading...')
    expect(screen.queryByText('$0')).toBeNull()
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders a critical jobs failure banner and triggers retry', async () => {
    const reloadAll = vi.fn()
    mockUseCrmHomeData.mockReturnValue(
      createHookValue({
        jobs: [],
        sourceOverrides: {
          jobs: createCrmHomeSourceState(
            'error',
            'unavailable',
            'Unable to load jobs.',
            '2026-04-21T12:00:00.000Z'
          ),
        },
        reloadAll,
      })
    )

    render(<CrmHomePageContent />)

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Dashboard metrics are unavailable.')
    expect(alert.textContent).toContain('Unable to load jobs.')
    expect(screen.getAllByText('Metrics unavailable').length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(reloadAll).toHaveBeenCalledTimes(1)
  })

  it('renders a warning banner for degraded non-critical sources', () => {
    mockUseCrmHomeData.mockReturnValue(
      createHookValue({
        sourceOverrides: {
          customers: createCrmHomeSourceState(
            'error',
            'unavailable',
            'Unable to load customers.',
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
    )

    render(<CrmHomePageContent />)

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Some dashboard data is degraded.')
    expect(alert.textContent).toContain('Customers')
    expect(alert.textContent).toContain('Notes')
  })

  it('disables retry while reloading', () => {
    const hookValue = createHookValue({
      sourceOverrides: {
        customers: createCrmHomeSourceState(
          'degraded',
          'invalid',
          'Malformed customers response.',
          '2026-04-21T12:00:00.000Z'
        ),
        notes: createCrmHomeSourceState(
          'loading',
          'available',
          null,
          '2026-04-21T12:00:00.000Z'
        ),
      },
    })

    mockUseCrmHomeData.mockReturnValue({
      ...hookValue,
      summary: {
        ...hookValue.summary,
        isBusy: true,
        isInitialLoading: false,
        isReloading: true,
        hasWarnings: true,
        warningSources: ['customers'],
      },
    })

    render(<CrmHomePageContent />)

    const button = screen.getByRole('button', { name: 'Retrying...' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it('renders the calendar disconnected state', () => {
    mockUseCrmHomeData.mockReturnValue(
      createHookValue({
        calendarConnected: false,
        sourceOverrides: {
          calendarEvents: createCrmHomeSourceState(
            'ready',
            'missing',
            null,
            '2026-04-21T12:00:00.000Z'
          ),
        },
      })
    )

    render(<CrmHomePageContent />)

    expect(screen.getByText('Google Calendar is not connected.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Connect Google' })).toBeTruthy()
  })

  it('renders calendar errors instead of the empty state', () => {
    mockUseCrmHomeData.mockReturnValue(
      createHookValue({
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
    )

    render(<CrmHomePageContent />)

    expect(screen.getByText('Malformed calendar status response.')).toBeTruthy()
    expect(screen.getByText('Unable to load calendar events.')).toBeTruthy()
    expect(screen.queryAllByText('No calendar items today.')).toHaveLength(0)
  })

  it('renders metrics, activity feed rows, and real tab affordances', () => {
    mockUseCrmHomeData.mockReturnValue(
      createHookValue({
        jobs: [
          {
            id: 'job-1',
            status: 'completed',
            title: 'Kitchen repaint',
            customer_name: 'Alice Jones',
            customer_address: '123 Main St',
            estimate_total_amount: 1200,
          },
          {
            id: 'job-2',
            status: 'lost',
            title: 'Garage doors',
            customer_name: 'Bob Smith',
            customer_address: '456 Oak Ave',
            estimate_total_amount: 800,
          },
          {
            id: 'job-3',
            status: 'estimate_sent',
            title: 'Fence staining',
            customer_name: 'Carol West',
            customer_address: '789 Pine Rd',
            estimate_total_amount: 500,
          },
        ],
      })
    )

    render(<CrmHomePageContent />)

    expect(screen.getAllByText('$1,200').length).toBeGreaterThan(0)
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$2,500').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Kitchen repaint').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Alice Jones').length).toBeGreaterThan(0)

    expect(screen.getByRole('tablist', { name: 'Activity feed sections' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Activity' }).getAttribute('aria-selected')).toBe('true')
    const tasksTab = screen.getByRole('tab', { name: 'Tasks' })
    expect(tasksTab.getAttribute('href')).toBe('/crm/notes/tasks')
  })

  it('switches today signals tabs and styles overdue reminders differently', async () => {
    mockUseCrmHomeData.mockReturnValue(
      createHookValue({
        calendarTodayEvents: [
          {
            id: 'event-1',
            calendarId: 'primary',
            summary: 'Morning walkthrough',
            start: '2026-04-21T14:00:00.000Z',
            end: '2026-04-21T15:00:00.000Z',
            htmlLink: null,
          },
        ],
        notesReminders: [
          {
            kind: 'overdue',
            task: {
              id: 'task-1',
              title: 'Call Alice',
              description: null,
              due_at: '2026-04-20T14:00:00.000Z',
              is_all_day: false,
              has_due_time: true,
            },
          },
          {
            kind: 'due_today',
            task: {
              id: 'task-2',
              title: 'Send estimate',
              description: null,
              due_at: '2026-04-21T16:00:00.000Z',
              is_all_day: false,
              has_due_time: true,
            },
          },
        ],
      })
    )

    render(<CrmHomePageContent />)

    expect(screen.getByText('Morning walkthrough')).toBeTruthy()

    await userEvent.click(screen.getByRole('tab', { name: 'Reminders' }))

    expect(screen.queryByText('Morning walkthrough')).toBeNull()
    expect(screen.getByText('Call Alice')).toBeTruthy()
    expect(screen.getByText('Send estimate')).toBeTruthy()

    const overdueReminder = screen.getByRole('link', { name: /Call Alice/i })
    const dueTodayReminder = screen.getByRole('link', { name: /Send estimate/i })
    expect(overdueReminder.getAttribute('style')).toContain('var(--crm-danger-border)')
    expect(overdueReminder.getAttribute('style')).toContain('var(--crm-danger-bg)')
    expect(dueTodayReminder.getAttribute('style')).toContain('var(--crm-border)')
    expect(dueTodayReminder.getAttribute('style')).toContain('transparent')
  })

  it('renders malformed notes data as degraded instead of an empty reminders state', async () => {
    mockUseCrmHomeData.mockReturnValue(
      createHookValue({
        sourceOverrides: {
          notes: createCrmHomeSourceState(
            'degraded',
            'invalid',
            'Malformed notes dashboard response.',
            '2026-04-21T12:00:00.000Z'
          ),
        },
      })
    )

    render(<CrmHomePageContent />)

    await userEvent.click(screen.getByRole('tab', { name: 'Reminders' }))

    expect(screen.getByText('Malformed notes dashboard response.')).toBeTruthy()
    expect(screen.queryByText('No reminders today.')).toBeNull()
  })

  it('renders search matches and the no-results state', async () => {
    mockUseCrmHomeData.mockReturnValue(
      createHookValue({
        jobs: [
          {
            id: 'job-1',
            status: 'estimate_sent',
            title: 'Wallpaper follow-up',
            customer_name: 'Alice Jones',
            customer_address: '123 Main St',
            estimate_total_amount: 1200,
          },
        ],
        customers: [
          {
            id: 'customer-1',
            name: 'Alice Jones',
            email: 'search-only@example.com',
            phone: '555-1111',
            address: '123 Main St',
          },
        ],
      })
    )

    render(<CrmHomePageContent />)

    const input = screen.getAllByLabelText('Search customers or jobs')[0] as HTMLInputElement
    await userEvent.type(input, 'Alice')

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeTruthy()
      expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
      expect(screen.getByText(/search-only@example\.com/)).toBeTruthy()
      expect(screen.getAllByText('Wallpaper follow-up').length).toBeGreaterThan(0)
      expect(screen.getByText('Jobs')).toBeTruthy()
    })

    await userEvent.keyboard('{Escape}')

    await waitFor(() => {
      expect(input.value).toBe('Alice')
      expect(screen.queryByRole('listbox')).toBeNull()
    })

    await userEvent.clear(input)
    await userEvent.type(input, 'zzz')

    await waitFor(() => {
      expect(screen.getByText('No results.')).toBeTruthy()
    })
  })
})
