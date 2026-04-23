import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
  }
  renderDesktop?: boolean
  renderMobile?: boolean
  onJobQueryChange: (query: string) => void
  onSelectJob: (jobId: string) => void
}

type MockSummaryCard = {
  label: string
  value: string
  subtext?: string
}

type MockSummaryCardsProps = {
  cards: MockSummaryCard[]
  loading: boolean
}

type MockSelectedJobPanelProps = {
  vm: { title: string | null }
}

type MockVersionListProps = {
  vm: { heading: string }
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
  QuotesHomeJobList: ({ vm, renderDesktop = true, renderMobile = true, onJobQueryChange, onSelectJob }: MockJobListProps) => (
    <div>
      <div>job-list:{renderDesktop ? 'desktop' : 'mobile'}:{renderMobile ? 'mobile' : 'desktop'}</div>
      <div>job-empty:{vm.emptyState}</div>
      <button onClick={() => onJobQueryChange('garage')}>change job query</button>
      <button onClick={() => onSelectJob('job-2')}>select job</button>
    </div>
  ),
}))

vi.mock('../_home/QuotesHomeSummaryCards', () => ({
  QuotesHomeSummaryCards: ({ cards, loading }: MockSummaryCardsProps) => (
    <div>
      summary-cards:{cards.map((card) => `${card.label}:${card.value}`).join('|')}:{String(loading)}
    </div>
  ),
}))

vi.mock('../_home/QuotesHomeSelectedJobPanel', () => ({
  QuotesHomeSelectedJobPanel: ({ vm }: MockSelectedJobPanelProps) => <div>selected-job:{vm.title ?? 'none'}</div>,
}))

vi.mock('../_home/QuotesHomeVersionList', () => ({
  QuotesHomeVersionList: ({ vm, onRequestDelete }: MockVersionListProps) => (
    <div>
      <div>version-list:{vm.heading}</div>
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

describe('QuotesHomePage', () => {
  it('renders grouped sections and wires child callbacks through the page shell', () => {
    const actions = {
      setSearchFocused: vi.fn(),
      setSearchQuery: vi.fn(),
      retrySearch: vi.fn(),
      setJobQuery: vi.fn(),
      setSelectedJobId: vi.fn(),
      requestDelete: vi.fn(),
      setVersionKind: vi.fn(),
      setVersionName: vi.fn(),
      create: vi.fn(),
      cancelDelete: vi.fn(),
      confirmDelete: vi.fn(),
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
        items: [],
        mobileItems: [],
        emptyState: 'none',
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
        emptyMessage: null,
        items: [],
      },
      create: {
        creating: false,
        loading: false,
        selectedJobName: 'Kitchen',
        versionKind: 'standard',
        versionName: '',
        canCreate: true,
      },
      mobileSummaryCards: [
        { label: 'Drafts', value: '1', subtext: '1 draft version' },
        { label: 'Pipeline', value: '$1,800', subtext: 'Rollup-backed total' },
      ],
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
    expect(screen.getByText('summary-cards:Drafts:1|Pipeline:$1,800:false')).toBeInTheDocument()
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
    expect(actions.requestDelete).toHaveBeenCalledWith('estimate-2')
    expect(actions.setVersionKind).toHaveBeenCalledWith('revision')
    expect(actions.setVersionName).toHaveBeenCalledWith('Custom Revision')
    expect(actions.create).toHaveBeenCalledTimes(1)
    expect(actions.cancelDelete).toHaveBeenCalledTimes(1)
    expect(actions.confirmDelete).toHaveBeenCalledTimes(1)
  })
})
