import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActivityFeedCard } from '../ActivityFeedCard'

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

describe('ActivityFeedCard', () => {
  it('renders activity tab semantics and tasks navigation', () => {
    render(
      <ActivityFeedCard
        viewModel={{
          items: [
            {
              id: 'job-1',
              href: '/crm/jobs/job-1',
              title: 'Kitchen repaint',
              customerName: 'Alice Jones',
              amountLabel: '$1,200',
              status: 'estimate_sent',
            },
          ],
          isEmpty: false,
          isUnavailable: false,
          emptyMessage: 'No activity yet.',
          unavailableMessage: 'Activity is unavailable right now.',
          tasksHref: '/crm/tasks',
          viewAllHref: '/crm/jobs',
          viewAllLabel: 'View all 4 jobs',
        }}
      />
    )

    expect(screen.getByRole('tablist', { name: 'Activity feed sections' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Activity' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Tasks' }).getAttribute('href')).toBe('/crm/tasks')
    expect(screen.getByRole('link', { name: /View all 4 jobs/i })).toBeTruthy()
  })

  it('renders the empty state without a view-all link', () => {
    render(
      <ActivityFeedCard
        viewModel={{
          items: [],
          isEmpty: true,
          isUnavailable: false,
          emptyMessage: 'No activity yet. Create your first job to get started.',
          unavailableMessage: 'Activity is unavailable right now.',
          tasksHref: '/crm/tasks',
          viewAllHref: null,
          viewAllLabel: null,
        }}
      />
    )

    expect(screen.getByText('No activity yet. Create your first job to get started.')).toBeTruthy()
    expect(screen.queryByText(/View all/i)).toBeNull()
  })

  it('renders the unavailable state when jobs data is degraded', () => {
    render(
      <ActivityFeedCard
        viewModel={{
          items: [],
          isEmpty: true,
          isUnavailable: true,
          emptyMessage: 'No activity yet. Create your first job to get started.',
          unavailableMessage: 'Unable to load jobs.',
          tasksHref: '/crm/tasks',
          viewAllHref: null,
          viewAllLabel: null,
        }}
      />
    )

    expect(screen.getByText('Unable to load jobs.')).toBeTruthy()
    expect(screen.queryByText(/View all/i)).toBeNull()
  })

  it('suppresses the view-all link when all jobs are already shown', () => {
    render(
      <ActivityFeedCard
        viewModel={{
          items: [
            {
              id: 'job-1',
              href: '/crm/jobs/job-1',
              title: 'Kitchen repaint',
              customerName: 'Alice Jones',
              amountLabel: '$1,200',
              status: 'estimate_sent',
            },
          ],
          isEmpty: false,
          isUnavailable: false,
          emptyMessage: 'No activity yet. Create your first job to get started.',
          unavailableMessage: 'Unable to load jobs.',
          tasksHref: '/crm/tasks',
          viewAllHref: null,
          viewAllLabel: null,
        }}
      />
    )

    expect(screen.queryByText(/View all/i)).toBeNull()
  })
})
