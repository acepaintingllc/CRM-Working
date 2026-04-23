import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import QuotesHomePage from '../QuotesHomePage'

type MockHeaderProps = {
  vm: { heroSummaryText: string }
  onSearchFocusedChange: (focused: boolean) => void
  onSearchQueryChange: (query: string) => void
  onSearchRetry: () => void
}

type MockJobListProps = {
  vm: { emptyState: string }
  onJobQueryChange: (query: string) => void
  onSelectJob: (jobId: string) => void
  onLoadMore?: () => void
}

type MockVersionListProps = {
  vm: { heading: string }
  onRequestDelete: (id: string) => void
  onLoadMore?: () => void
}

const { useQuotesHomePage } = vi.hoisted(() => ({
  useQuotesHomePage: vi.fn(),
}))

vi.mock('../_hooks/useQuotesHomePage', () => ({
  useQuotesHomePage,
}))

vi.mock('../_home/QuotesHomeHeader', () => ({
  QuotesHomeHeader: ({ vm, onSearchFocusedChange, onSearchQueryChange, onSearchRetry }: MockHeaderProps) => (
    <div>
      <div>header:{vm.heroSummaryText}</div>
      <button onClick={() => onSearchFocusedChange(true)}>focus search</button>
      <button onClick={() => onSearchQueryChange('revision')}>change search</button>
      <button onClick={onSearchRetry}>retry search</button>
    </div>
  ),
}))

vi.mock('../_home/QuotesHomeJobList', () => ({
  QuotesHomeJobList: ({ vm, onJobQueryChange, onSelectJob, onLoadMore }: MockJobListProps) => (
    <div>
      <div>job-empty:{vm.emptyState}</div>
      <button onClick={() => onJobQueryChange('garage')}>change job query</button>
      <button onClick={() => onSelectJob('job-2')}>select job</button>
      <button onClick={onLoadMore}>load more jobs</button>
    </div>
  ),
}))

vi.mock('../_home/QuotesHomeSummaryCards', () => ({
  QuotesHomeSummaryCards: () => <div>summary-cards</div>,
}))

vi.mock('../_home/QuotesHomeSelectedJobPanel', () => ({
  QuotesHomeSelectedJobPanel: ({ vm }: { vm: { title: string | null } }) => <div>selected-job:{vm.title}</div>,
}))

vi.mock('../_home/QuotesHomeVersionList', () => ({
  QuotesHomeVersionList: ({ vm, onRequestDelete, onLoadMore }: MockVersionListProps) => (
    <div>
      <div>version-list:{vm.heading}</div>
      <button onClick={() => onRequestDelete('estimate-2')}>request delete</button>
      <button onClick={onLoadMore}>load more versions</button>
    </div>
  ),
}))

vi.mock('../_home/QuotesHomeCreatePanel', () => ({
  QuotesHomeCreatePanel: ({ onCreate }: { onCreate: () => void }) => (
    <button onClick={onCreate}>create version</button>
  ),
}))

vi.mock('../_home/QuotesHomeDeleteDialog', () => ({
  QuotesHomeDeleteDialog: ({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) => (
    <div>
      <button onClick={onCancel}>cancel delete</button>
      <button onClick={onConfirm}>confirm delete</button>
    </div>
  ),
}))

describe('QuotesHomePage', () => {
  it('renders the shell and forwards page actions', () => {
    const actions = {
      setSearchFocused: vi.fn(),
      setSearchQuery: vi.fn(),
      retrySearch: vi.fn(),
      setJobQuery: vi.fn(),
      loadMoreJobs: vi.fn(),
      setSelectedJobId: vi.fn(),
      requestDelete: vi.fn(),
      setVersionKind: vi.fn(),
      setVersionName: vi.fn(),
      create: vi.fn(),
      cancelDelete: vi.fn(),
      confirmDelete: vi.fn(),
      loadMoreVersions: vi.fn(),
    }

    useQuotesHomePage.mockReturnValue({
      actions,
      header: {
        heroSummaryText: '3 total versions',
        searchFocused: false,
        searchQuery: '',
        searchLoading: false,
        searchEmptyMessage: null,
        searchErrorMessage: null,
        searchCanRetry: false,
        searchResults: [],
      },
      feedback: {
        loading: false,
        tone: 'error',
        title: 'Quote action failed',
        details: ['Delete failed'],
        sources: ['delete'],
      },
      summaryCards: [],
      jobList: {
        loading: false,
        loadingMore: false,
        searchQuery: '',
        selectedJobId: 'job-1',
        items: [],
        mobileItems: [],
        emptyState: 'none',
        hasMore: true,
      },
      selectedJob: {
        loading: false,
        emptyMessage: null,
        title: 'Kitchen',
        customerLine: 'Alice',
        jobHref: '/crm/jobs/job-1',
        stats: [],
      },
      versionList: {
        heading: 'Kitchen · 2 loaded / 2 total',
        emptyMessage: null,
        items: [],
        hasMore: true,
        loadingMore: false,
      },
      create: {
        creating: false,
        loading: false,
        selectedJobName: 'Kitchen',
        versionKind: 'standard',
        versionName: '',
        canCreate: true,
      },
      mobileSummaryCards: [],
      dialogs: {
        delete: {
          estimateId: null,
          versionName: null,
          jobTitle: null,
          deleting: false,
        },
      },
    })

    render(<QuotesHomePage />)

    fireEvent.click(screen.getByRole('button', { name: 'focus search' }))
    fireEvent.click(screen.getByRole('button', { name: 'change search' }))
    fireEvent.click(screen.getByRole('button', { name: 'retry search' }))
    fireEvent.click(screen.getByRole('button', { name: 'change job query' }))
    fireEvent.click(screen.getByRole('button', { name: 'load more jobs' }))
    fireEvent.click(screen.getByRole('button', { name: 'select job' }))
    fireEvent.click(screen.getByRole('button', { name: 'request delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'load more versions' }))
    fireEvent.click(screen.getByRole('button', { name: 'create version' }))
    fireEvent.click(screen.getByRole('button', { name: 'cancel delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'confirm delete' }))

    expect(actions.setSearchFocused).toHaveBeenCalledWith(true)
    expect(actions.setSearchQuery).toHaveBeenCalledWith('revision')
    expect(actions.retrySearch).toHaveBeenCalledTimes(1)
    expect(actions.setJobQuery).toHaveBeenCalledWith('garage')
    expect(actions.loadMoreJobs).toHaveBeenCalledTimes(1)
    expect(actions.setSelectedJobId).toHaveBeenCalledWith('job-2')
    expect(actions.requestDelete).toHaveBeenCalledWith('estimate-2')
    expect(actions.loadMoreVersions).toHaveBeenCalledTimes(1)
    expect(actions.create).toHaveBeenCalledTimes(1)
    expect(actions.cancelDelete).toHaveBeenCalledTimes(1)
    expect(actions.confirmDelete).toHaveBeenCalledTimes(1)
  })
})
