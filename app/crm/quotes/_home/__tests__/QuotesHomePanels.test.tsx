import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuotesHomeCreatePanel } from '../QuotesHomeCreatePanel'
import { QuotesHomeDeleteDialog } from '../QuotesHomeDeleteDialog'
import { QuotesHomeJobList } from '../QuotesHomeJobList'
import { QuotesHomeSelectedJobPanel } from '../QuotesHomeSelectedJobPanel'
import { QuotesHomeSummaryCards } from '../QuotesHomeSummaryCards'
import { QuotesHomeVersionList } from '../QuotesHomeVersionList'
import { QUOTES_HOME_JOB_LIST_NO_JOBS_BODY } from '../quoteHomePresentation'

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
          emptyStateBody: QUOTES_HOME_JOB_LIST_NO_JOBS_BODY,
        }}
        onJobQueryChange={() => {}}
        onSelectJob={() => {}}
        onLoadMore={async () => {}}
        onRetry={async () => true}
      />,
    )

    expect(screen.getByText('No eligible jobs yet').parentElement).toHaveTextContent(
      QUOTES_HOME_JOB_LIST_NO_JOBS_BODY,
    )

    const addContact = screen.getByRole('link', { name: 'Add contact' })
    const openJobs = screen.getByRole('link', { name: 'Open jobs' })

    expect(addContact).toHaveClass('ace-crm-btn', 'ace-crm-btn-primary')
    expect(openJobs).toHaveClass('ace-crm-btn', 'ace-crm-btn-secondary')
  })

  it('renders a retryable error panel instead of the no-jobs CTA when loading failed', async () => {
    let resolveRetry: (value: boolean) => void = () => {}
    const onRetry = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRetry = resolve
        }),
    )

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
          emptyStateBody: null,
        }}
        onJobQueryChange={() => {}}
        onSelectJob={() => {}}
        onLoadMore={async () => {}}
        onRetry={onRetry}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Jobs failed to load')
    expect(screen.getByText('Jobs failed to load')).toBeInTheDocument()
    expect(screen.getByText('bootstrap failed')).toBeInTheDocument()
    expect(screen.queryByText('No eligible jobs yet')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry jobs' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Retrying jobs...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Retrying jobs...' })).toHaveAttribute(
      'aria-busy',
      'true',
    )

    resolveRetry(true)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retry jobs' })).not.toBeDisabled()
    })
  })

  it('announces job loading without making the whole list live', () => {
    render(
      <QuotesHomeJobList
        vm={{
          loading: true,
          searchQuery: '',
          selectedJobId: '',
          hasMore: false,
          items: [],
          errorMessage: null,
          canRetry: false,
          emptyState: 'none',
          emptyStateBody: null,
        }}
        onJobQueryChange={() => {}}
        onSelectJob={() => {}}
        onLoadMore={async () => {}}
        onRetry={async () => true}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Loading jobs...')
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('status').parentElement).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status').parentElement).not.toHaveAttribute('aria-live')
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
          emptyStateBody: null,
        }}
        onJobQueryChange={() => {}}
        onSelectJob={() => {}}
        onLoadMore={onLoadMore}
        onRetry={async () => true}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Load more jobs' }))

    const jobList = screen.getByRole('listbox', { name: 'Jobs' })
    expect(jobList).toBeInTheDocument()
    expect(jobList).toHaveAttribute('aria-activedescendant', 'quote-home-job-job-1')
    expect(jobList.parentElement).toHaveAttribute('aria-busy', 'false')
    expect(screen.getByRole('option', { name: /Kitchen Remodel.*selected/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('option', { name: /Kitchen Remodel.*selected/i })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(
      screen.getByRole('option', { name: /Kitchen Remodel.*selected/i }),
    ).toHaveTextContent('Kitchen Remodel')

    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('renders job-list loading directly from the vm', () => {
    render(
      <QuotesHomeJobList
        vm={{
          loading: true,
          searchQuery: '',
          selectedJobId: '',
          hasMore: false,
          items: [],
          errorMessage: null,
          canRetry: false,
          emptyState: 'none',
          emptyStateBody: null,
        }}
        onJobQueryChange={() => {}}
        onSelectJob={() => {}}
        onLoadMore={async () => {}}
        onRetry={async () => true}
      />,
    )

    expect(screen.getByText('Loading jobs...')).toBeInTheDocument()
    expect(screen.getByText('Loading jobs...').parentElement).toHaveAttribute(
      'aria-busy',
      'true',
    )
  })

  it('supports keyboard job selection and listbox focus movement', () => {
    const onSelectJob = vi.fn()

    render(
      <QuotesHomeJobList
        vm={{
          loading: false,
          searchQuery: '',
          selectedJobId: 'job-1',
          hasMore: false,
          items: [
            {
              id: 'job-1',
              title: 'Kitchen Remodel',
              customerName: 'Alice',
              versionCountLabel: '2 versions',
              isSelected: true,
            },
            {
              id: 'job-2',
              title: 'Exterior Paint',
              customerName: 'Bob',
              versionCountLabel: '1 version',
              isSelected: false,
            },
          ],
          errorMessage: null,
          canRetry: false,
          emptyState: 'none',
          emptyStateBody: null,
        }}
        onJobQueryChange={() => {}}
        onSelectJob={onSelectJob}
        onLoadMore={async () => {}}
        onRetry={async () => true}
      />,
    )

    const kitchen = screen.getByRole('option', { name: /Kitchen Remodel.*selected/i })
    const exterior = screen.getByRole('option', { name: /Exterior Paint/i })

    kitchen.focus()
    fireEvent.keyDown(kitchen, { key: 'ArrowDown' })

    expect(exterior).toHaveFocus()

    fireEvent.keyDown(exterior, { key: 'Enter' })
    fireEvent.keyDown(exterior, { key: ' ' })

    expect(onSelectJob).toHaveBeenCalledWith('job-2')
    expect(onSelectJob).toHaveBeenCalledTimes(2)
  })

  it('supports Home, End, and edge-safe movement in the job listbox', () => {
    render(
      <QuotesHomeJobList
        vm={{
          loading: false,
          searchQuery: '',
          selectedJobId: 'job-2',
          hasMore: false,
          items: [
            {
              id: 'job-1',
              title: 'Kitchen Remodel',
              customerName: 'Alice',
              versionCountLabel: '2 versions',
              isSelected: false,
            },
            {
              id: 'job-2',
              title: 'Exterior Paint',
              customerName: 'Bob',
              versionCountLabel: '1 version',
              isSelected: true,
            },
          ],
          errorMessage: null,
          canRetry: false,
          emptyState: 'none',
          emptyStateBody: null,
        }}
        onJobQueryChange={() => {}}
        onSelectJob={() => {}}
        onLoadMore={async () => {}}
        onRetry={async () => true}
      />,
    )

    const kitchen = screen.getByRole('option', { name: /Kitchen Remodel/i })
    const exterior = screen.getByRole('option', { name: /Exterior Paint.*selected/i })

    exterior.focus()
    fireEvent.keyDown(exterior, { key: 'Home' })
    expect(kitchen).toHaveFocus()

    fireEvent.keyDown(kitchen, { key: 'End' })
    expect(exterior).toHaveFocus()

    fireEvent.keyDown(exterior, { key: 'ArrowDown' })
    expect(exterior).toHaveFocus()

    kitchen.focus()
    fireEvent.keyDown(kitchen, { key: 'ArrowUp' })
    expect(kitchen).toHaveFocus()
  })

  it('disables the job load-more button while its request is pending', async () => {
    let resolveLoadMore: () => void = () => {}
    const onLoadMore = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLoadMore = resolve
        }),
    )

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
          emptyStateBody: null,
        }}
        onJobQueryChange={() => {}}
        onSelectJob={() => {}}
        onLoadMore={onLoadMore}
        onRetry={async () => true}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Load more jobs' }))

    expect(onLoadMore).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Loading more jobs...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Loading more jobs...' })).toHaveAttribute(
      'aria-busy',
      'true',
    )

    resolveLoadMore()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Load more jobs' })).not.toBeDisabled()
    })
  })

  it('uses CRM button actions for version open and delete', () => {
    const onLoadMore = vi.fn(async () => {})
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
              deleteDisabled: false,
              deleteBusy: false,
              deleteButtonLabel: 'Delete',
              deleteButtonAriaLabel: 'Delete quote version Version A',
            },
          ],
          hasMore: true,
          loadingMore: false,
          errorMessage: null,
          canRetry: false,
          status: { kind: 'ready' },
        }}
        onLoadMore={onLoadMore}
        onRetry={async () => true}
        onRequestDelete={onRequestDelete}
      />,
    )

    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Open version' })).toHaveClass(
      'ace-crm-btn',
      'ace-crm-btn-primary',
    )

    const deleteButton = screen.getByRole('button', { name: 'Delete quote version Version A' })
    expect(deleteButton).toHaveClass('ace-crm-btn', 'ace-crm-btn-danger')

    fireEvent.click(deleteButton)
    fireEvent.click(screen.getByRole('button', { name: 'Load more versions' }))

    expect(onRequestDelete).toHaveBeenCalledWith('estimate-1')
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('disables version deletion when the vm marks that row as deleting', () => {
    render(
      <QuotesHomeVersionList
        vm={{
          heading: '1 version under this job',
          detail: null,
          emptyMessage: null,
          items: [
            {
              id: 'estimate-1',
              title: 'Version A',
              total: null,
              meta: 'Draft / Standard',
              href: '/crm/quotes/estimate-1',
              deleting: true,
              deleteDisabled: true,
              deleteBusy: true,
              deleteButtonLabel: 'Deleting...',
              deleteButtonAriaLabel: 'Deleting quote version Version A',
            },
          ],
          hasMore: false,
          loadingMore: false,
          errorMessage: null,
          canRetry: false,
          status: { kind: 'ready' },
        }}
        onLoadMore={async () => {}}
        onRetry={async () => true}
        onRequestDelete={() => {}}
      />,
    )

    const deleteButton = screen.getByRole('button', {
      name: 'Deleting quote version Version A',
    })
    expect(deleteButton).toBeDisabled()
    expect(deleteButton).toHaveAttribute('aria-disabled', 'true')
    expect(deleteButton).toHaveAttribute('aria-busy', 'true')
    expect(deleteButton).toHaveTextContent('Deleting...')
  })

  it('uses the version name in delete confirmation labels', () => {
    const onConfirm = vi.fn()

    render(
      <QuotesHomeDeleteDialog
        vm={{
          isOpen: true,
          estimateId: 'estimate-1',
          versionName: 'Version A',
          jobTitle: 'Kitchen Remodel',
          deleting: false,
          title: 'Delete Version A?',
          description:
            'Permanently delete quote version Version A from Kitchen Remodel.',
          closeLabel: 'Close delete confirmation',
          warning: 'This permanently deletes the quote version. This cannot be undone.',
          info:
            'The home page will refresh job counts and the selected job version list after delete.',
          cancelLabel: 'Cancel',
          cancelAriaLabel: 'Cancel deleting quote version Version A',
          confirmLabel: 'Delete Version A',
          confirmAriaLabel:
            'Permanently delete quote version Version A from Kitchen Remodel',
          confirmingLabel: 'Deleting Version A...',
          confirmingAriaLabel: 'Deleting quote version Version A from Kitchen Remodel',
          confirmDisabled: false,
          cancelDisabled: false,
        }}
        onCancel={() => {}}
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByText('Delete Version A?')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Permanently delete quote version Version A from Kitchen Remodel.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'This permanently deletes the quote version. This cannot be undone.',
      ),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Permanently delete quote version Version A from Kitchen Remodel',
      }),
    )

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('disables delete confirmation actions while deletion is in progress', () => {
    render(
      <QuotesHomeDeleteDialog
        vm={{
          isOpen: true,
          estimateId: 'estimate-1',
          versionName: 'Version A',
          jobTitle: 'Kitchen Remodel',
          deleting: true,
          title: 'Delete Version A?',
          description:
            'Permanently delete quote version Version A from Kitchen Remodel.',
          closeLabel: 'Close delete confirmation',
          warning: 'This permanently deletes the quote version. This cannot be undone.',
          info:
            'The home page will refresh job counts and the selected job version list after delete.',
          cancelLabel: 'Cancel',
          cancelAriaLabel: 'Cancel deleting quote version Version A',
          confirmLabel: 'Delete Version A',
          confirmAriaLabel:
            'Permanently delete quote version Version A from Kitchen Remodel',
          confirmingLabel: 'Deleting Version A...',
          confirmingAriaLabel: 'Deleting quote version Version A from Kitchen Remodel',
          confirmDisabled: true,
          cancelDisabled: true,
        }}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )

    expect(
      screen.getByRole('button', {
        name: 'Cancel deleting quote version Version A',
      }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', {
        name: 'Deleting quote version Version A from Kitchen Remodel',
      }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', {
        name: 'Deleting quote version Version A from Kitchen Remodel',
      }),
    ).toHaveAttribute('aria-busy', 'true')
  })

  it('renders a retryable error panel when versions fail to load', async () => {
    let resolveRetry: (value: boolean) => void = () => {}
    const onRetry = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRetry = resolve
        }),
    )

    render(
      <QuotesHomeVersionList
        vm={{
          heading: '2 versions under this job',
          detail: null,
          emptyMessage: 'No quote versions exist under this job yet.',
          items: [],
          hasMore: false,
          loadingMore: false,
          errorMessage: 'versions failed',
          canRetry: true,
          status: {
            kind: 'error',
            title: 'Versions failed to load',
            message: 'versions failed',
            canRetry: true,
            retryLabel: 'Retry versions',
            retryingLabel: 'Retrying versions...',
          },
        }}
        onLoadMore={async () => {}}
        onRetry={onRetry}
        onRequestDelete={() => {}}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Versions failed to load')
    expect(screen.getByText('Versions failed to load')).toBeInTheDocument()
    expect(screen.getByText('versions failed')).toBeInTheDocument()
    expect(
      screen.queryByText('No quote versions exist under this job yet.'),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry versions' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Retrying versions...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Retrying versions...' })).toHaveAttribute(
      'aria-busy',
      'true',
    )

    resolveRetry(true)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retry versions' })).not.toBeDisabled()
    })
  })

  it('disables the version load-more button while pending', async () => {
    let resolveLoadMore: () => void = () => {}
    const onLoadMore = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLoadMore = resolve
        }),
    )

    render(
      <QuotesHomeVersionList
        vm={{
          heading: '1 version under this job',
          detail: 'Showing all 1 versions.',
          emptyMessage: null,
          items: [],
          hasMore: true,
          loadingMore: false,
          errorMessage: null,
          canRetry: false,
          status: { kind: 'ready' },
        }}
        onLoadMore={onLoadMore}
        onRetry={async () => true}
        onRequestDelete={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Load more versions' }))

    expect(onLoadMore).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Loading more versions...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Loading more versions...' })).toHaveAttribute(
      'aria-busy',
      'true',
    )

    resolveLoadMore()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Load more versions' })).not.toBeDisabled()
    })
  })

  it('uses the CRM primary button for create version and keeps the local field controls', () => {
    const onVersionKindChange = vi.fn()
    const onVersionNameChange = vi.fn()

    render(
      <QuotesHomeCreatePanel
        vm={{
          creating: false,
          loading: false,
          eyebrow: 'Create Version',
          title: 'Start a quote version',
          description: 'Create the first quote version for the selected job.',
          createButtonLabel: 'Create version',
          versionNameLabel: 'Version name',
          versionNameHelp: 'Optional custom name.',
          versionNamePlaceholder: 'Leave blank for the next default version name',
          versionKindLabel: 'Version type',
          versionKindOptions: [
            { value: 'standard', label: 'Standard' },
            { value: 'alternate', label: 'Alternate' },
          ],
          selectedJobName: 'Kitchen',
          versionKind: 'standard',
          versionName: '',
          canCreate: false,
        }}
        onCreate={() => {}}
        onVersionKindChange={onVersionKindChange}
        onVersionNameChange={onVersionNameChange}
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

    fireEvent.change(
      screen.getByPlaceholderText(
        'Leave blank for the next default version name',
      ),
      { target: { value: 'Custom Revision' } },
    )
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'alternate' },
    })

    expect(onVersionNameChange).toHaveBeenCalledWith('Custom Revision')
    expect(onVersionKindChange).toHaveBeenCalledWith('alternate')
  })

  it('renders summary cards from display-ready vm fields', () => {
    render(
      <QuotesHomeSummaryCards
        cards={[
          {
            label: 'Drafts',
            value: '1',
            displayValue: '...',
            subtext: '1 draft version',
            valueColor: 'rgb(255, 255, 255)',
            subtextColor: 'rgb(120, 120, 120)',
          },
        ]}
      />,
    )

    expect(screen.getByText('...')).toBeInTheDocument()
    expect(screen.queryByText('1')).not.toBeInTheDocument()
    expect(screen.getByText('1 draft version')).toBeInTheDocument()
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
