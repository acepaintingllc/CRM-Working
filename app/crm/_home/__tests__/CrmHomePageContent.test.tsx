import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CrmHomePageContent } from '../CrmHomePageContent'
import {
  createInitialCrmHomeLoadState,
  createResolvedCrmHomeLoadState,
} from '@/lib/crm/home/state'
import type { CrmHomeSourceErrorMap } from '@/lib/crm/home/types'

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
  errorsBySource = {},
  isInitialLoading = false,
  isReloading = false,
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
  reload = vi.fn(),
}: {
  errorsBySource?: CrmHomeSourceErrorMap
  isInitialLoading?: boolean
  isReloading?: boolean
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
  reload?: ReturnType<typeof vi.fn>
}) {
  const state = createResolvedCrmHomeLoadState({
    now: new Date('2026-04-21T12:00:00.000Z'),
    jobs,
    customers,
    calendarConnected,
    calendarTodayEvents,
    notesReminders,
    errorsBySource,
  })

  return {
    data: state.data,
    errorsBySource: state.errorsBySource,
    isInitialLoading,
    isReloading,
    hasCriticalError: state.hasCriticalError,
    hasWarnings: state.hasWarnings,
    reload,
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
      errorsBySource: state.errorsBySource,
      isInitialLoading: true,
      isReloading: false,
      hasCriticalError: false,
      hasWarnings: false,
      reload: vi.fn(),
    })

    render(<CrmHomePageContent />)

    expect(screen.getByRole('status').textContent).toContain('Loading...')
  })

  it('renders a critical jobs failure banner and triggers retry', async () => {
    const reload = vi.fn()
    mockUseCrmHomeData.mockReturnValue(
      createHookValue({
        jobs: [],
        errorsBySource: { jobs: 'Unable to load jobs.' },
        reload,
      })
    )

    render(<CrmHomePageContent />)

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Dashboard metrics are unavailable.')
    expect(alert.textContent).toContain('Unable to load jobs.')

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('renders a warning banner for degraded non-critical sources', () => {
    mockUseCrmHomeData.mockReturnValue(
      createHookValue({
        errorsBySource: {
          customers: 'Unable to load customers.',
          notes: 'Unable to load notes dashboard.',
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
    mockUseCrmHomeData.mockReturnValue(
      createHookValue({
        errorsBySource: { customers: 'Unable to load customers.' },
        isReloading: true,
      })
    )

    render(<CrmHomePageContent />)

    const button = screen.getByRole('button', { name: 'Retrying...' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it('renders the calendar disconnected state', () => {
    mockUseCrmHomeData.mockReturnValue(
      createHookValue({
        calendarConnected: false,
      })
    )

    render(<CrmHomePageContent />)

    expect(screen.getByText('Google Calendar is not connected.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Connect Google' })).toBeTruthy()
  })

  it('renders calendar errors instead of the empty state', () => {
    mockUseCrmHomeData.mockReturnValue(
      createHookValue({
        errorsBySource: { calendarEvents: 'Unable to load calendar events.' },
      })
    )

    render(<CrmHomePageContent />)

    expect(screen.getByText('Unable to load calendar events.')).toBeTruthy()
    expect(screen.queryAllByText('No calendar items today.')).toHaveLength(0)
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
      expect(screen.getByText(/search-only@example\.com/)).toBeTruthy()
      expect(screen.getAllByText('Wallpaper follow-up').length).toBeGreaterThan(0)
      expect(screen.getByText('Jobs')).toBeTruthy()
    })

    await userEvent.clear(input)
    await userEvent.type(input, 'zzz')

    await waitFor(() => {
      expect(screen.getByText('No results.')).toBeTruthy()
    })
  })
})
