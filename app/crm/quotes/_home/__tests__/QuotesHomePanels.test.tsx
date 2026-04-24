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

  it('renders job empty, loading, and retry states from the vm', async () => {
    const onRetry = vi.fn(async () => true)
    const { rerender } = render(
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
          status: {
            kind: 'empty',
            emptyState: 'no_jobs',
            title: 'No eligible jobs yet',
            body: QUOTES_HOME_JOB_LIST_NO_JOBS_BODY,
          },
        }}
        onJobQueryChange={() => {}}
        onSelectJob={() => {}}
        onLoadMore={async () => {}}
        onRetry={onRetry}
      />
    )

    expect(screen.getByText('No eligible jobs yet').parentElement).toHaveTextContent(
      QUOTES_HOME_JOB_LIST_NO_JOBS_BODY
    )
    expect(screen.getByRole('link', { name: 'Add contact' })).toHaveAttribute(
      'href',
      '/crm/customers/new'
    )
    expect(screen.getByRole('link', { name: 'Open jobs' })).toHaveAttribute('href', '/crm/jobs')

    rerender(
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
          status: { kind: 'loading', message: 'Loading jobs...' },
        }}
        onJobQueryChange={() => {}}
        onSelectJob={() => {}}
        onLoadMore={async () => {}}
        onRetry={onRetry}
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent('Loading jobs...')
    expect(screen.getByRole('status').parentElement).toHaveAttribute('aria-busy', 'true')

    rerender(
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
          status: {
            kind: 'error',
            title: 'Jobs failed to load',
            message: 'bootstrap failed',
            canRetry: true,
            retryLabel: 'Retry jobs',
            retryingLabel: 'Retrying jobs...',
          },
        }}
        onJobQueryChange={() => {}}
        onSelectJob={() => {}}
        onLoadMore={async () => {}}
        onRetry={onRetry}
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Jobs failed to load')
    fireEvent.click(screen.getByRole('button', { name: 'Retry jobs' }))

    await waitFor(() => {
      expect(onRetry).toHaveBeenCalledTimes(1)
    })
  })

  it('changes the job query and supports mouse and keyboard job selection', () => {
    const onJobQueryChange = vi.fn()
    const onSelectJob = vi.fn()

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
          status: { kind: 'ready' },
          loadMoreLabel: 'Load more jobs',
          loadingMoreLabel: 'Loading more jobs...',
        }}
        onJobQueryChange={onJobQueryChange}
        onSelectJob={onSelectJob}
        onLoadMore={async () => {}}
        onRetry={async () => true}
      />
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Search jobs' }), {
      target: { value: 'exterior' },
    })

    const kitchen = screen.getByRole('option', { name: /Kitchen Remodel.*selected/i })
    const exterior = screen.getByRole('option', { name: /Exterior Paint/i })
    kitchen.focus()
    fireEvent.keyDown(kitchen, { key: 'ArrowDown' })
    fireEvent.keyDown(exterior, { key: 'Enter' })
    fireEvent.click(exterior)

    expect(exterior).toHaveFocus()
    expect(onJobQueryChange).toHaveBeenCalledWith('exterior')
    expect(onSelectJob).toHaveBeenCalledWith('job-2')
    expect(onSelectJob).toHaveBeenCalledTimes(2)
  })

  it('renders version rows, retry errors, and pending controls from the vm', async () => {
    const onLoadMore = vi.fn(async () => {})
    const onRequestDelete = vi.fn()
    const onRetry = vi.fn(async () => true)
    const { rerender } = render(
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
          loadMoreLabel: 'Load more versions',
          loadingMoreLabel: 'Loading more versions...',
        }}
        onLoadMore={onLoadMore}
        onRetry={onRetry}
        onRequestDelete={onRequestDelete}
      />
    )

    expect(screen.getByRole('link', { name: 'Open version' })).toHaveAttribute(
      'href',
      '/crm/quotes/estimate-1'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete quote version Version A' }))
    fireEvent.click(screen.getByRole('button', { name: 'Load more versions' }))
    expect(onRequestDelete).toHaveBeenCalledWith('estimate-1')
    expect(onLoadMore).toHaveBeenCalledTimes(1)

    rerender(
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
        onLoadMore={onLoadMore}
        onRetry={onRetry}
        onRequestDelete={onRequestDelete}
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Versions failed to load')
    expect(screen.queryByText('No quote versions exist under this job yet.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry versions' }))

    await waitFor(() => {
      expect(onRetry).toHaveBeenCalledTimes(1)
    })
  })

  it('uses the version name in delete confirmation and locks controls while deleting', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const unlockedVm = {
      isOpen: true,
      estimateId: 'estimate-1',
      versionName: 'Version A',
      jobTitle: 'Kitchen Remodel',
      deleting: false,
      title: 'Delete Version A?',
      description: 'Permanently delete quote version Version A from Kitchen Remodel.',
      closeLabel: 'Close delete confirmation',
      warning: 'This permanently deletes the quote version. This cannot be undone.',
      info: 'The home page will refresh job counts and the selected job version list after delete.',
      cancelLabel: 'Cancel',
      cancelAriaLabel: 'Cancel deleting quote version Version A',
      confirmLabel: 'Delete Version A',
      confirmAriaLabel: 'Permanently delete quote version Version A from Kitchen Remodel',
      confirmingLabel: 'Deleting Version A...',
      confirmingAriaLabel: 'Deleting quote version Version A from Kitchen Remodel',
      confirmDisabled: false,
      cancelDisabled: false,
    }

    const { rerender } = render(
      <QuotesHomeDeleteDialog vm={unlockedVm} onCancel={onCancel} onConfirm={onConfirm} />
    )

    expect(screen.getByRole('dialog')).toHaveTextContent('Delete Version A?')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel deleting quote version Version A' }))
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Permanently delete quote version Version A from Kitchen Remodel',
      })
    )
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledTimes(1)

    rerender(
      <QuotesHomeDeleteDialog
        vm={{
          ...unlockedVm,
          deleting: true,
          confirmDisabled: true,
          cancelDisabled: true,
        }}
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    )

    expect(screen.getByRole('button', { name: 'Cancel deleting quote version Version A' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Deleting quote version Version A from Kitchen Remodel' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Deleting quote version Version A from Kitchen Remodel' })
    ).toHaveAttribute('aria-busy', 'true')
  })

  it('keeps create inputs controlled and preserves current vm values', () => {
    const onCreate = vi.fn()
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
          versionName: 'Custom Revision',
          canCreate: true,
        }}
        onCreate={onCreate}
        onVersionKindChange={onVersionKindChange}
        onVersionNameChange={onVersionNameChange}
      />
    )

    fireEvent.change(screen.getByDisplayValue('Custom Revision'), {
      target: { value: 'Alternate A' },
    })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'alternate' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create version' }))

    expect(onVersionNameChange).toHaveBeenCalledWith('Alternate A')
    expect(onVersionKindChange).toHaveBeenCalledWith('alternate')
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('renders summary cards and selected-job stats from display-ready vm fields', () => {
    render(
      <>
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
        />
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
        />
      </>
    )

    expect(screen.getByText('...')).toBeInTheDocument()
    expect(screen.queryByText('1')).not.toBeInTheDocument()
    expect(screen.getByText('1 draft version')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kitchen Remodel' })).toBeInTheDocument()
    expect(screen.getByText('Estimate Pending')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open job' })).toHaveAttribute(
      'href',
      '/crm/jobs/job-1'
    )
  })
})
