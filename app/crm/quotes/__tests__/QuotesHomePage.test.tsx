import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { quoteHomeBootstrap } from '@/test-support/quoteHomeFixtures'
import QuotesHomePage from '../QuotesHomePage'

type MockHeaderProps = {
  vm: {
    heroSummaryText: string
  }
  onSearchFocusedChange: (focused: boolean) => void
  onSearchQueryChange: (query: string) => void
  onSearchRetry: () => void
}

type MockJobListProps = {
  vm: {
    emptyState: string
    errorMessage: string | null
    canRetry: boolean
    hasMore: boolean
  }
  onJobQueryChange: (query: string) => void
  onSelectJob: (jobId: string) => void
  onLoadMore: () => Promise<void>
  onRetry: () => Promise<boolean>
}

type MockSummaryCard = {
  label: string
  value: string
  displayValue: string
  subtext?: string
}

type MockSummaryCardsProps = {
  cards: MockSummaryCard[]
}

type MockSelectedJobPanelProps = {
  vm: { title: string | null }
}

type MockVersionListProps = {
  vm: { heading: string }
  onLoadMore: () => Promise<unknown>
  onRetry: () => Promise<boolean>
  onRequestDelete: (id: string) => void
}

type MockCreatePanelProps = {
  vm: {
    versionKind: string
    versionName: string
  }
  onCreate: () => void
  onVersionKindChange: (kind: string) => void
  onVersionNameChange: (name: string) => void
}

type MockDeleteDialogProps = {
  vm: {
    estimateId: string | null
  }
  onCancel: () => void
  onConfirm: () => void
}

const { shouldThrowSummaryCards, useQuotesHomePage } = vi.hoisted(() => ({
  shouldThrowSummaryCards: vi.fn(() => false),
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
  QuotesHomeJobList: ({
    vm,
    onJobQueryChange,
    onSelectJob,
    onLoadMore,
    onRetry,
  }: MockJobListProps) => (
    <div>
      <div>job-list:desktop</div>
      <div>job-empty:{vm.emptyState}</div>
      <div>job-error:{vm.errorMessage ?? 'none'}</div>
      <div>job-can-retry:{String(vm.canRetry)}</div>
      <div>job-has-more:{String(vm.hasMore)}</div>
      <button onClick={() => onJobQueryChange('garage')}>change job query</button>
      <button onClick={() => onSelectJob('job-2')}>select job</button>
      <button onClick={() => void onLoadMore()}>load more jobs</button>
      <button onClick={() => void onRetry()}>retry jobs</button>
    </div>
  ),
}))

vi.mock('../_home/QuotesHomeSummaryCards', () => ({
  QuotesHomeSummaryCards: ({ cards }: MockSummaryCardsProps) => {
    if (shouldThrowSummaryCards()) {
      throw new Error('summary cards crashed')
    }

    return (
      <div>
        summary-cards:{cards.map((card) => `${card.label}:${card.displayValue ?? card.value}`).join('|')}
      </div>
    )
  },
}))

vi.mock('../_home/QuotesHomeSelectedJobPanel', () => ({
  QuotesHomeSelectedJobPanel: ({ vm }: MockSelectedJobPanelProps) => <div>selected-job:{vm.title ?? 'none'}</div>,
  QuotesHomeSelectedJobResponsivePanel: ({ vm }: MockSelectedJobPanelProps) => (
    <div>selected-job:{vm.title ?? 'none'}</div>
  ),
}))

vi.mock('../_home/QuotesHomeVersionList', () => ({
  QuotesHomeVersionList: ({ vm, onLoadMore, onRetry, onRequestDelete }: MockVersionListProps) => (
    <div>
      <div>version-list:{vm.heading}</div>
      <button onClick={() => void onLoadMore()}>load more versions</button>
      <button onClick={() => void onRetry()}>retry versions</button>
      <button onClick={() => onRequestDelete('estimate-2')}>request delete</button>
    </div>
  ),
}))

vi.mock('../_home/QuotesHomeCreatePanel', () => ({
  QuotesHomeCreatePanel: ({ vm, onCreate, onVersionKindChange, onVersionNameChange }: MockCreatePanelProps) => (
    <div>
      <div>create-panel:{vm.versionKind}:{vm.versionName}</div>
      <button onClick={() => onVersionKindChange('revision')}>change kind</button>
      <button onClick={() => onVersionNameChange('Custom Revision')}>change name</button>
      <button onClick={onCreate}>create version</button>
    </div>
  ),
}))

vi.mock('../_home/QuotesHomeDeleteDialog', () => ({
  QuotesHomeDeleteDialog: ({ vm, onCancel, onConfirm }: MockDeleteDialogProps) => (
    <div>
      <div>delete-dialog:{vm.estimateId ?? 'none'}</div>
      <button onClick={onCancel}>cancel delete</button>
      <button onClick={onConfirm}>confirm delete</button>
    </div>
  ),
}))

type MockFeedback =
  | {
      tone: 'error'
      title: string
      details: string[]
      sources: string[]
    }
  | null

function createQuotesHomePageVm({
  feedback = null,
  loading = false,
}: {
  feedback?: MockFeedback
  loading?: boolean
} = {}) {
  return {
    actions: {
      setSearchFocused: vi.fn(),
      setSearchQuery: vi.fn(),
      retrySearch: vi.fn(),
      setJobQuery: vi.fn(),
      setSelectedJobId: vi.fn(),
      loadMore: vi.fn(async () => undefined),
      refresh: vi.fn(async () => true),
      retryJobs: vi.fn(async () => true),
      retryVersions: vi.fn(async () => true),
      loadMoreVersions: vi.fn(async () => false),
      requestDelete: vi.fn(),
      setVersionKind: vi.fn(),
      setVersionName: vi.fn(),
      create: vi.fn(),
      cancelDelete: vi.fn(),
      confirmDelete: vi.fn(),
    },
    loading,
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
    feedback,
    summaryCards: [
      { label: 'Drafts', value: '1', subtext: '1 draft version' },
      { label: 'Pipeline', value: '$1,800', subtext: 'Rollup-backed total' },
    ],
    jobList: {
      loading: false,
      searchQuery: '',
      selectedJobId: 'job-1',
      hasMore: false,
      items: [],
      errorMessage: null,
      canRetry: false,
      emptyState: 'none',
      emptyStateBody: null,
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
      heading: '2 versions under this job',
      detail: null,
      emptyMessage: null,
      items: [],
      hasMore: false,
      loadingMore: false,
      errorMessage: null,
      canRetry: false,
    },
    create: {
      creating: false,
      loading: false,
      selectedJobName: 'Kitchen',
      versionKind: 'standard',
      versionName: '',
      canCreate: true,
    },
    dialogs: {
      delete: {
        estimateId: null,
        versionName: null,
        jobTitle: null,
        deleting: false,
      },
    },
  }
}

describe('QuotesHomePage', () => {
  beforeEach(() => {
    cleanup()
    shouldThrowSummaryCards.mockReset()
    shouldThrowSummaryCards.mockReturnValue(false)
    useQuotesHomePage.mockReset()
  })

  it('renders grouped sections and wires child callbacks through the page shell', () => {
    const actions = {
      setSearchFocused: vi.fn(),
      setSearchQuery: vi.fn(),
      retrySearch: vi.fn(),
      setJobQuery: vi.fn(),
      setSelectedJobId: vi.fn(),
      loadMore: vi.fn(async () => undefined),
      refresh: vi.fn(async () => true),
      retryJobs: vi.fn(async () => true),
      retryVersions: vi.fn(async () => true),
      loadMoreVersions: vi.fn(async () => false),
      requestDelete: vi.fn(),
      setVersionKind: vi.fn(),
      setVersionName: vi.fn(),
      create: vi.fn(),
      cancelDelete: vi.fn(),
      confirmDelete: vi.fn(),
    }

    useQuotesHomePage.mockReturnValue({
      actions,
      loading: false,
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
        tone: 'error',
        title: 'Quote action failed',
        details: ['Select a job before creating a version.'],
        sources: ['create'],
      },
      summaryCards: [
        { label: 'Drafts', value: '1', subtext: '1 draft version' },
        { label: 'Pipeline', value: '$1,800', subtext: 'Rollup-backed total' },
      ],
      jobList: {
        loading: false,
        searchQuery: '',
        selectedJobId: 'job-1',
        hasMore: true,
        items: [],
        errorMessage: null,
        canRetry: false,
        emptyState: 'none',
        emptyStateBody: null,
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
        heading: '2 versions under this job',
        detail: null,
        emptyMessage: null,
        items: [],
        hasMore: false,
        loadingMore: false,
        errorMessage: null,
        canRetry: false,
      },
      create: {
        creating: false,
        loading: false,
        selectedJobName: 'Kitchen',
        versionKind: 'standard',
        versionName: '',
        canCreate: true,
      },
      dialogs: {
        delete: {
          estimateId: 'estimate-2',
          versionName: 'Version B',
          jobTitle: 'Kitchen',
          deleting: false,
        },
      },
    })

    render(<QuotesHomePage />)

    expect(screen.getByText('Quote Home')).toBeInTheDocument()
    expect(screen.getByText('Shared CRM shell')).toBeInTheDocument()
    expect(screen.getByText('header:3 total versions')).toBeInTheDocument()
    expect(screen.getByText('summary-cards:Drafts:1|Pipeline:$1,800')).toBeInTheDocument()
    expect(screen.getByText('job-error:none')).toBeInTheDocument()
    expect(screen.getByText('job-can-retry:false')).toBeInTheDocument()
    expect(screen.getByText('job-has-more:true')).toBeInTheDocument()
    expect(screen.getByText('selected-job:Kitchen')).toBeInTheDocument()
    expect(screen.getByText('version-list:2 versions under this job')).toBeInTheDocument()
    expect(screen.getByText('create-panel:standard:')).toBeInTheDocument()
    expect(screen.getByText('delete-dialog:estimate-2')).toBeInTheDocument()
    expect(screen.getByText('Quote action failed')).toBeInTheDocument()
    expect(screen.getByText('Select a job before creating a version.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'focus search' }))
    fireEvent.click(screen.getByRole('button', { name: 'change search' }))
    fireEvent.click(screen.getByRole('button', { name: 'retry search' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'change job query' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'select job' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'load more jobs' }))
    fireEvent.click(screen.getByRole('button', { name: 'retry jobs' }))
    fireEvent.click(screen.getByRole('button', { name: 'load more versions' }))
    fireEvent.click(screen.getByRole('button', { name: 'retry versions' }))
    fireEvent.click(screen.getByRole('button', { name: 'request delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'change kind' }))
    fireEvent.click(screen.getByRole('button', { name: 'change name' }))
    fireEvent.click(screen.getByRole('button', { name: 'create version' }))
    fireEvent.click(screen.getByRole('button', { name: 'cancel delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'confirm delete' }))

    expect(actions.setSearchFocused).toHaveBeenCalledWith(true)
    expect(actions.setSearchQuery).toHaveBeenCalledWith('revision')
    expect(actions.retrySearch).toHaveBeenCalledTimes(1)
    expect(actions.setJobQuery).toHaveBeenCalledWith('garage')
    expect(actions.setSelectedJobId).toHaveBeenCalledWith('job-2')
    expect(actions.loadMore).toHaveBeenCalledTimes(1)
    expect(actions.retryJobs).toHaveBeenCalledTimes(1)
    expect(actions.retryVersions).toHaveBeenCalledTimes(1)
    expect(actions.refresh).not.toHaveBeenCalled()
    expect(actions.loadMoreVersions).toHaveBeenCalledTimes(1)
    expect(actions.requestDelete).toHaveBeenCalledWith('estimate-2')
    expect(actions.setVersionKind).toHaveBeenCalledWith('revision')
    expect(actions.setVersionName).toHaveBeenCalledWith('Custom Revision')
    expect(actions.create).toHaveBeenCalledTimes(1)
    expect(actions.cancelDelete).toHaveBeenCalledTimes(1)
    expect(actions.confirmDelete).toHaveBeenCalledTimes(1)
  })

  it('omits the feedback notice when the controller returns null feedback', () => {
    useQuotesHomePage.mockReturnValue({
      actions: {
        setSearchFocused: vi.fn(),
        setSearchQuery: vi.fn(),
        retrySearch: vi.fn(),
        setJobQuery: vi.fn(),
        setSelectedJobId: vi.fn(),
        loadMore: vi.fn(async () => undefined),
        refresh: vi.fn(async () => true),
        retryJobs: vi.fn(async () => true),
        retryVersions: vi.fn(async () => true),
        loadMoreVersions: vi.fn(async () => false),
        requestDelete: vi.fn(),
        setVersionKind: vi.fn(),
        setVersionName: vi.fn(),
        create: vi.fn(),
        cancelDelete: vi.fn(),
        confirmDelete: vi.fn(),
      },
      loading: false,
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
      feedback: null,
      summaryCards: [
        { label: 'Drafts', value: '1', subtext: '1 draft version' },
        { label: 'Pipeline', value: '$1,800', subtext: 'Rollup-backed total' },
      ],
      jobList: {
        loading: false,
        searchQuery: '',
        selectedJobId: 'job-1',
        hasMore: false,
        items: [],
        errorMessage: null,
        canRetry: false,
        emptyState: 'none',
        emptyStateBody: null,
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
        heading: '2 versions under this job',
        detail: null,
        emptyMessage: null,
        items: [],
        hasMore: false,
        loadingMore: false,
        errorMessage: null,
        canRetry: false,
      },
      create: {
        creating: false,
        loading: false,
        selectedJobName: 'Kitchen',
        versionKind: 'standard',
        versionName: '',
        canCreate: true,
      },
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

    expect(screen.queryByText('Quote action failed')).not.toBeInTheDocument()
  })

  it('passes initialData through to the controller hook', () => {
    useQuotesHomePage.mockReturnValue(createQuotesHomePageVm())

    render(<QuotesHomePage initialData={quoteHomeBootstrap} />)

    expect(useQuotesHomePage).toHaveBeenCalledWith(quoteHomeBootstrap)
  })

  it('renders the loading state without feedback while keeping lists mounted', () => {
    useQuotesHomePage.mockReturnValue(createQuotesHomePageVm({ loading: true, feedback: null }))

    render(<QuotesHomePage />)

    expect(screen.getByText('summary-cards:Drafts:1|Pipeline:$1,800')).toBeInTheDocument()
    expect(screen.queryByText('Quote action failed')).not.toBeInTheDocument()
    expect(screen.getByText('job-list:desktop')).toBeInTheDocument()
    expect(screen.getByText('version-list:2 versions under this job')).toBeInTheDocument()
  })

  it('shows a recovery fallback while keeping the page shell visible when quote content crashes', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    shouldThrowSummaryCards.mockReturnValue(true)
    useQuotesHomePage.mockReturnValue(createQuotesHomePageVm())

    render(<QuotesHomePage />)

    expect(screen.getByText('Quote Home')).toBeInTheDocument()
    expect(screen.getByText('Shared CRM shell')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong loading quotes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.queryByText('job-list:desktop')).not.toBeInTheDocument()

    consoleError.mockRestore()
  })
})
