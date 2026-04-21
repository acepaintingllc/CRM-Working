import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TodaySignalsCard } from '../TodaySignalsCard'

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

afterEach(() => {
  cleanup()
})

const baseViewModel = {
  calendarTabLabel: 'Calendar',
  remindersTabLabel: 'Reminders',
  calendar: {
    loading: false,
    errors: [] as string[],
    disconnected: false,
    disconnectedMessage: 'Google Calendar is not connected.',
    connectHref: '/crm/calendar',
    connectLabel: 'Connect Google',
    emptyMessage: 'No calendar items today.',
    events: [
      {
        key: 'primary:event-1',
        title: 'Morning walkthrough',
        subtitle: '9:00 AM - 10:00 AM',
        href: null,
      },
    ],
  },
  reminders: {
    loading: false,
    isEmpty: false,
    errors: [] as string[],
    emptyMessage: 'No reminders today.',
    count: 2,
    items: [
      {
        key: 'overdue:task-1',
        href: '/crm/notes/tasks?focus=task-1',
        title: 'Call Alice',
        subtitle: 'Overdue • 4/20/2026',
        tone: 'danger' as const,
      },
      {
        key: 'due_today:task-2',
        href: '/crm/notes/tasks?focus=task-2',
        title: 'Send estimate',
        subtitle: 'Due today • 4/21/2026',
        tone: 'default' as const,
      },
    ],
  },
  footerActions: [
    { href: '/crm/calendar', label: 'Calendar', icon: 'calendar' as const },
    { href: '/crm/notes', label: 'Notes', icon: 'notes' as const },
  ],
}

describe('TodaySignalsCard', () => {
  it('switches tabs between calendar and reminders', async () => {
    render(<TodaySignalsCard viewModel={baseViewModel} />)

    expect(screen.getByText('Morning walkthrough')).toBeTruthy()
    await userEvent.click(screen.getByRole('tab', { name: 'Reminders' }))
    expect(screen.queryByText('Morning walkthrough')).toBeNull()
    expect(screen.getByText('Call Alice')).toBeTruthy()
  })

  it('renders calendar errors and disconnected state', () => {
    const { rerender } = render(
      <TodaySignalsCard
        viewModel={{
          ...baseViewModel,
          calendar: {
            ...baseViewModel.calendar,
            events: [],
            errors: ['Unable to load calendar status.', 'Unable to load calendar events.'],
          },
        }}
      />
    )

    expect(screen.getByText('Unable to load calendar status.')).toBeTruthy()
    expect(screen.getByText('Unable to load calendar events.')).toBeTruthy()

    rerender(
      <TodaySignalsCard
        viewModel={{
          ...baseViewModel,
          calendar: {
            ...baseViewModel.calendar,
            events: [],
            errors: [],
            disconnected: true,
          },
        }}
      />
    )

    expect(screen.getByText('Google Calendar is not connected.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Connect Google' })).toBeTruthy()
  })

  it('applies danger styling to overdue reminders', async () => {
    render(<TodaySignalsCard viewModel={baseViewModel} />)

    await userEvent.click(screen.getByRole('tab', { name: 'Reminders' }))

    const overdueReminder = screen.getByRole('link', { name: /Call Alice/i })
    const dueTodayReminder = screen.getByRole('link', { name: /Send estimate/i })
    expect(overdueReminder.getAttribute('href')).toBe('/crm/notes/tasks?focus=task-1')
    expect(dueTodayReminder.getAttribute('href')).toBe('/crm/notes/tasks?focus=task-2')
    expect(overdueReminder.getAttribute('style')).toContain('var(--crm-danger-border)')
    expect(dueTodayReminder.getAttribute('style')).toContain('var(--crm-border)')
  })

  it('renders reminder errors instead of the empty state', async () => {
    render(
      <TodaySignalsCard
        viewModel={{
          ...baseViewModel,
          reminders: {
            ...baseViewModel.reminders,
            isEmpty: true,
            items: [],
            errors: ['Malformed notes dashboard response.'],
          },
        }}
      />
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Reminders' }))

    expect(screen.getByText('Malformed notes dashboard response.')).toBeTruthy()
    expect(screen.queryByText('No reminders today.')).toBeNull()
  })

  it('renders reminder loading and empty states distinctly', async () => {
    const { rerender } = render(
      <TodaySignalsCard
        viewModel={{
          ...baseViewModel,
          reminders: {
            ...baseViewModel.reminders,
            loading: true,
            items: [],
            isEmpty: true,
          },
        }}
      />
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Reminders' }))
    expect(screen.getByText('Loading...')).toBeTruthy()

    rerender(
      <TodaySignalsCard
        viewModel={{
          ...baseViewModel,
          reminders: {
            ...baseViewModel.reminders,
            loading: false,
            items: [],
            isEmpty: true,
          },
        }}
      />
    )

    expect(screen.getByText('No reminders today.')).toBeTruthy()
  })
})
