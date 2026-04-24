import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuotesHomeCreatePanel } from '../QuotesHomeCreatePanel'
import { QuotesHomeJobList } from '../QuotesHomeJobList'
import { QuotesHomeSelectedJobPanel } from '../QuotesHomeSelectedJobPanel'
import { QuotesHomeVersionList } from '../QuotesHomeVersionList'

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

describe('Quotes home panels', () => {
  beforeEach(() => {
    cleanup()
  })

  it('uses CRM button actions for the job-list empty state', () => {
    render(
      <QuotesHomeJobList
        vm={{
          loading: false,
          searchQuery: '',
          selectedJobId: '',
          hasMore: false,
          items: [],
          errorMessage: null,
          canRetry: false,
          emptyState: 'no_jobs',
        }}
        onJobQueryChange={() => {}}
        onSelectJob={() => {}}
        onLoadMore={async () => {}}
        onRetry={async () => true}
      />,
    )

    const addContact = screen.getByRole('link', { name: 'Add contact' })
    const openJobs = screen.getByRole('link', { name: 'Open jobs' })

    expect(addContact).toHaveClass('ace-crm-btn', 'ace-crm-btn-primary')
    expect(openJobs).toHaveClass('ace-crm-btn', 'ace-crm-btn-secondary')
  })

  it('renders a retryable error panel instead of the no-jobs CTA when loading failed', () => {
    const onRetry = vi.fn(async () => true)

    render(
      <QuotesHomeJobList
        vm={{
          loading: false,
          searchQuery: '',
          selectedJobId: '',
          hasMore: false,
          items: [],
          errorMessage: 'bootstrap failed',
          canRetry: true,
          emptyState: 'none',
        }}
        onJobQueryChange={() => {}}
        onSelectJob={() => {}}
        onLoadMore={async () => {}}
        onRetry={onRetry}
      />,
    )

    expect(screen.getByText('Jobs failed to load')).toBeInTheDocument()
    expect(screen.getByText('bootstrap failed')).toBeInTheDocument()
    expect(screen.queryByText('No eligible jobs yet')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry jobs' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders a load-more button when the vm reports more jobs', () => {
    const onLoadMore = vi.fn(async () => {})

    render(
      <QuotesHomeJobList
        vm={{
          loading: false,
          searchQuery: '',
          selectedJobId: 'job-1',
          hasMore: true,
          items: [
            {
              id: 'job-1',
              title: 'Kitchen Remodel',
              customerName: 'Alice',
              versionCountLabel: '2 versions',
              isSelected: true,
            },
          ],
          errorMessage: null,
          canRetry: false,
          emptyState: 'none',
        }}
        onJobQueryChange={() => {}}
        onSelectJob={() => {}}
        onLoadMore={onLoadMore}
        onRetry={async () => true}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Load more jobs' }))

    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('uses CRM button actions for version open and delete', () => {
    const onLoadMore = vi.fn()
    const onRequestDelete = vi.fn()

    render(
      <QuotesHomeVersionList
        vm={{
          heading: '1 version under this job',
          detail: 'Showing all 1 versions.',
          emptyMessage: null,
          items: [
            {
              id: 'estimate-1',
              title: 'Version A',
              total: '$1,250',
              meta: 'Draft / Standard',
              href: '/crm/quotes/estimate-1',
              deleting: false,
            },
          ],
          hasMore: true,
          loadingMore: false,
        }}
        onLoadMore={onLoadMore}
        onRequestDelete={onRequestDelete}
      />,
    )

    expect(screen.getByRole('link', { name: 'Open version' })).toHaveClass(
      'ace-crm-btn',
      'ace-crm-btn-primary',
    )

    const deleteButton = screen.getByRole('button', { name: /delete/i })
    expect(deleteButton).toHaveClass('ace-crm-btn', 'ace-crm-btn-danger')

    fireEvent.click(deleteButton)
    fireEvent.click(screen.getByRole('button', { name: 'Load more versions' }))

    expect(onRequestDelete).toHaveBeenCalledWith('estimate-1')
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('uses the CRM primary button for create version and keeps the local field controls', () => {
    render(
      <QuotesHomeCreatePanel
        vm={{
          creating: false,
          loading: false,
          selectedJobName: 'Kitchen',
          versionKind: 'standard',
          versionName: '',
          canCreate: false,
        }}
        onCreate={() => {}}
        onVersionKindChange={() => {}}
        onVersionNameChange={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Create version' })).toHaveClass(
      'ace-crm-btn',
      'ace-crm-btn-primary',
    )
    expect(
      screen.getByRole('button', { name: 'Create version' }),
    ).toBeDisabled()
    expect(
      screen.getByPlaceholderText(
        'Leave blank for the next default version name',
      ),
    ).toHaveClass('ace-crm-input')
    expect(screen.getByRole('combobox')).toHaveClass('ace-crm-input')
  })

  it('owns the selected-job stats grid locally and no longer uses the page-injected class', () => {
    render(
      <QuotesHomeSelectedJobPanel
        vm={{
          loading: false,
          emptyMessage: null,
          title: 'Kitchen Remodel',
          customerLine: 'Alice / 123 Main',
          jobHref: '/crm/jobs/job-1',
          stats: [
            { label: 'Customer', value: 'Alice' },
            { label: 'Job Status', value: 'Estimate Pending' },
            { label: 'Versions', value: '2' },
          ],
        }}
      />,
    )

    expect(screen.getByRole('link', { name: 'Open job' })).toHaveClass(
      'ace-crm-btn',
      'ace-crm-btn-secondary',
    )
    expect(
      document.querySelector('.quotes-home-selected-job-stats'),
    ).not.toBeNull()
    expect(document.querySelector('.v2-hub-job-stats')).toBeNull()
  })
})
