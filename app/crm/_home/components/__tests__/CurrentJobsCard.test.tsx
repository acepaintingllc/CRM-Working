import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CurrentJobsCard } from '../CurrentJobsCard'

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

describe('CurrentJobsCard', () => {
  it('renders per-job quick actions for photos and scheduling', () => {
    render(
      <CurrentJobsCard
        viewModel={{
          isEmpty: false,
          items: [
            {
              id: 'job-1',
              href: '/crm/jobs/job-1',
              title: 'Kitchen repaint',
              customerName: 'Alice Jones',
              scheduleLabel: 'May 9, 2026',
              status: 'scheduled',
            },
          ],
        }}
      />
    )

    expect(screen.getByRole('link', { name: /Kitchen repaint/i })).toHaveAttribute(
      'href',
      '/crm/jobs/job-1'
    )
    expect(screen.getByRole('link', { name: 'Photos' })).toHaveAttribute(
      'href',
      '/crm/job-photos?job=job-1'
    )
    expect(screen.getByRole('link', { name: 'Schedule' })).toHaveAttribute(
      'href',
      '/crm/jobs/job-1/schedule'
    )
  })

  it('does not render when there are no current jobs', () => {
    const { container } = render(<CurrentJobsCard viewModel={{ isEmpty: true, items: [] }} />)

    expect(container).toBeEmptyDOMElement()
  })
})
