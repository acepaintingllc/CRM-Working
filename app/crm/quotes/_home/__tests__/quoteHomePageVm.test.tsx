import { describe, expect, it, vi } from 'vitest'
import type {
  QuoteHomeJobListItemReadModel,
  QuoteHomeJobVersionItemReadModel,
  QuoteHomeSearchResultReadModel,
} from '@/lib/quotes/quoteHomeTypes'
import {
  buildQuoteHomePageVm,
  type QuoteHomePageActions,
  type QuoteHomePageVmResources,
  type QuoteHomePageVmState,
} from '../quoteHomePageVm'
import {
  QUOTES_HOME_JOB_LIST_NO_JOBS_BODY,
  QUOTE_META_SEPARATOR,
} from '../quoteHomePresentation'

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K]
}

const jobOne: QuoteHomeJobListItemReadModel = {
  id: 'job-1',
  customer_id: 'customer-1',
  customer_name: 'Alice',
  customer_address: '123 Main',
  title: 'Kitchen',
  description: null,
  status: 'estimate_pending',
  created_at: '2026-04-21T10:00:00.000Z',
  estimate_date: null,
  estimate_sent_at: null,
  scheduled_date: null,
  scheduled_end_date: null,
  scheduled_email_sent_at: null,
  completed_at: null,
  completed_email_sent_at: null,
  closeout_notes: null,
  linked_estimate_id: null,
  version_count: 2,
}

const jobTwo: QuoteHomeJobListItemReadModel = {
  ...jobOne,
  id: 'job-2',
  customer_id: 'customer-2',
  customer_name: 'Bob',
  customer_address: '456 Oak',
  title: 'Garage',
  status: 'estimate_sent',
  version_count: 1,
}

const versionOne: QuoteHomeJobVersionItemReadModel = {
  estimate_id: 'estimate-1',
  job_id: 'job-1',
  customer_id: 'customer-1',
  version_name: 'Version A',
  version_state: 'draft',
  version_kind: 'standard',
  version_sort_order: 1,
  job_title: 'Kitchen',
  customer_name: 'Alice',
  final_total: 500,
  updated_at: '2026-04-20T10:00:00.000Z',
  created_at: '2026-04-19T10:00:00.000Z',
  is_sent_estimate: false,
}

const versionTwo: QuoteHomeJobVersionItemReadModel = {
  ...versionOne,
  estimate_id: 'estimate-2',
  version_name: 'Version B',
  version_state: 'live',
  version_kind: 'revision',
  version_sort_order: 2,
  final_total: 1300,
  updated_at: '2026-04-21T10:00:00.000Z',
  created_at: '2026-04-20T10:00:00.000Z',
  is_sent_estimate: true,
}

const searchResult: QuoteHomeSearchResultReadModel = {
  estimate_id: 'estimate-search-1',
  job_id: 'job-1',
  customer_id: 'customer-1',
  version_name: 'Search Match',
  version_state: 'live',
  version_kind: 'revision',
  job_title: 'Kitchen',
  customer_name: 'Alice',
  final_total: 900,
  updated_at: '2026-04-22T10:00:00.000Z',
  is_sent_estimate: true,
}

function buildActions(): QuoteHomePageActions {
  return {
    setSearchQuery: vi.fn(),
    setSearchFocused: vi.fn(),
    setJobQuery: vi.fn(),
    setSelectedJobId: vi.fn(),
    loadMore: vi.fn(async () => undefined),
    setVersionName: vi.fn(),
    setVersionKind: vi.fn(),
    create: vi.fn(async () => null),
    loadMoreVersions: vi.fn(async () => false),
    retryJobs: vi.fn(async () => true),
    retryVersions: vi.fn(async () => true),
    retrySearch: vi.fn(),
    requestDelete: vi.fn(),
    cancelDelete: vi.fn(),
    confirmDelete: vi.fn(async () => true),
    refresh: vi.fn(async () => true),
  }
}

function buildResources(
  overrides?: DeepPartial<QuoteHomePageVmResources>
): QuoteHomePageVmResources {
  return {
    home: {
      summary: {
        total_versions: 3,
        draft_count: 1,
        sent_or_awaiting_count: 1,
        live_count: 1,
        pipeline_total: 1800,
      },
      jobs: [jobOne, jobTwo],
      hasMore: false,
      jobsLoading: false,
      loading: false,
      bootstrapError: null,
      jobsError: null,
      ...overrides?.home,
      latestVersion: overrides?.home?.latestVersion ?? null,
    },
    search: {
      query: '',
      loading: false,
      error: null,
      results: [],
      ...overrides?.search,
    },
    workflow: {
      versions: {
        items: [versionTwo, versionOne],
        error: null,
        totalVersions: 2,
        hasMore: false,
        loadingMore: false,
        hasResolved: true,
        ...overrides?.workflow?.versions,
      },
      create: {
        creating: false,
        error: null,
        versionName: '',
        versionKind: 'standard',
        canCreate: true,
        ...overrides?.workflow?.create,
      },
    },
    delete: {
      confirmingDelete: null,
      deletingId: null,
      error: null,
      ...overrides?.delete,
    },
  }
}

function buildState(overrides?: Partial<QuoteHomePageVmState>): QuoteHomePageVmState {
  return {
    actionWarning: null,
    searchQuery: '',
    searchFocused: false,
    jobQuery: '',
    selectedJobId: 'job-1',
    selectedJob: jobOne,
    visibleJobs: [jobOne, jobTwo],
    actions: buildActions(),
    ...overrides,
  }
}

describe('buildQuoteHomePageVm', () => {
  it('uses null-summary fallbacks without changing the page shape', () => {
    const vm = buildQuoteHomePageVm(
      buildState(),
      buildResources({
        home: {
          summary: null,
        },
      })
    )

    expect(vm.header.heroSummaryText).toBe(
      'Build and track quote versions with live status, totals, and search.'
    )
    expect(vm.summaryCards.map((card) => card.value)).toEqual(['0', '0', '0', '$0'])
    expect(vm.loading).toBe(false)
    expect(vm.feedback).toBeNull()
  })

  it('preserves empty-jobs state when no eligible jobs exist', () => {
    const actions = buildActions()
    const vm = buildQuoteHomePageVm(
      buildState({
        selectedJobId: '',
        selectedJob: null,
        visibleJobs: [],
        actions,
      }),
      buildResources({
        home: {
          jobs: [],
        },
        workflow: {
          versions: {
            items: [],
            totalVersions: 0,
            hasMore: false,
            loadingMore: false,
            hasResolved: false,
          },
          create: {
            canCreate: false,
          },
        },
      })
    )

    expect(vm.jobList).toEqual(expect.objectContaining({
      loading: false,
      searchQuery: '',
      selectedJobId: '',
      hasMore: false,
      items: [],
      errorMessage: null,
      canRetry: false,
      emptyState: 'no_jobs',
      emptyStateBody: QUOTES_HOME_JOB_LIST_NO_JOBS_BODY,
    }))
    expect(vm.jobList.status).toEqual({
      kind: 'empty',
      emptyState: 'no_jobs',
      title: 'No eligible jobs yet',
      body: QUOTES_HOME_JOB_LIST_NO_JOBS_BODY,
    })
    expect(vm.selectedJob.emptyMessage).toBe(
      'Select a job from the left to view versions and create the next one.'
    )
    expect(vm.versionList).toEqual(expect.objectContaining({
      heading: 'Pick a job first',
      detail: null,
      emptyMessage: 'Versions will appear here once a job is selected.',
      items: [],
      hasMore: false,
      loadingMore: false,
      errorMessage: null,
      canRetry: false,
    }))
    expect(vm.versionList.status).toEqual({
      kind: 'empty',
      message: 'Versions will appear here once a job is selected.',
    })
    expect(vm.create.selectedJobName).toBeNull()
    expect(vm.actions).toBe(actions)
  })

  it('builds the selected-job view model from the selected job context', () => {
    const vm = buildQuoteHomePageVm(
      buildState({
        searchQuery: 'revision',
      }),
      buildResources({
        workflow: {
          versions: {
            totalVersions: 99,
            hasResolved: true,
          },
          create: {
            versionName: 'Kitchen Revision',
            versionKind: 'revision',
          },
        },
      })
    )

    expect(vm.jobList.items).toEqual([
      expect.objectContaining({ id: 'job-1', isSelected: true }),
      expect.objectContaining({ id: 'job-2', isSelected: false }),
    ])
    expect(vm.jobList.hasMore).toBe(false)
    expect(vm.selectedJob).toEqual({
      loading: false,
      state: 'selected',
      emptyMessage: null,
      title: 'Kitchen',
      customerLine: `Alice${QUOTE_META_SEPARATOR}123 Main`,
      jobHref: '/crm/jobs/job-1',
      stats: [
        { label: 'Customer', value: 'Alice' },
        { label: 'Job Status', value: 'Estimate Pending' },
        { label: 'Versions', value: '99' },
      ],
    })
    expect(vm.versionList).toEqual(
      expect.objectContaining({
        heading: '99 versions under this job',
        detail: 'Showing 2 of 99 versions - reload to see all.',
      })
    )
    expect(vm.create).toEqual(
      expect.objectContaining({
        creating: false,
        loading: false,
        selectedJobName: 'Kitchen',
        versionName: 'Kitchen Revision',
        versionKind: 'revision',
        canCreate: true,
        createButtonLabel: 'Create version',
        versionKindOptions: expect.arrayContaining([
          { value: 'standard', label: 'Standard' },
          { value: 'revision', label: 'Revision' },
        ]),
      })
    )
  })

  it('builds header search result view models from search result resources', () => {
    const vm = buildQuoteHomePageVm(
      buildState({
        searchQuery: 'search',
        searchFocused: true,
      }),
      buildResources({
        search: {
          results: [searchResult],
        },
      })
    )

    expect(vm.header.searchResults).toEqual([
      {
        id: 'estimate-search-1',
        href: '/crm/quotes/estimate-search-1',
        title: 'Search Match',
        meta: 'Kitchen\nAlice / Live',
      },
    ])
  })

  it('derives search loading state without empty or retry display affordances', () => {
    const vm = buildQuoteHomePageVm(
      buildState({
        searchQuery: 'kitchen',
        searchFocused: true,
      }),
      buildResources({
        search: {
          query: 'kitchen',
          loading: true,
          results: [],
        },
      })
    )

    expect(vm.header.searchLoading).toBe(true)
    expect(vm.header.searchEmptyMessage).toBeNull()
    expect(vm.header.searchErrorMessage).toBeNull()
    expect(vm.header.searchCanRetry).toBe(false)
    expect(vm.header.searchResults).toEqual([])
  })

  it('derives search error state as retryable when a query is active', () => {
    const vm = buildQuoteHomePageVm(
      buildState({
        searchQuery: 'broken',
      }),
      buildResources({
        search: {
          query: 'broken',
          error: 'search failed',
          results: [],
        },
      })
    )

    expect(vm.header.searchEmptyMessage).toBeNull()
    expect(vm.header.searchErrorMessage).toBe('search failed')
    expect(vm.header.searchCanRetry).toBe(true)
    expect(vm.header.searchResults).toEqual([])
  })

  it('derives search empty state from resource query and result count', () => {
    const vm = buildQuoteHomePageVm(
      buildState({
        searchQuery: 'missing',
      }),
      buildResources({
        search: {
          query: 'missing',
          results: [],
        },
      })
    )

    expect(vm.header.searchEmptyMessage).toBe('No quote versions match "missing".')
    expect(vm.header.searchErrorMessage).toBeNull()
    expect(vm.header.searchCanRetry).toBe(true)
    expect(vm.header.searchResults).toEqual([])
  })

  it('derives search result state without empty messaging', () => {
    const vm = buildQuoteHomePageVm(
      buildState({
        searchQuery: 'search',
      }),
      buildResources({
        search: {
          query: 'search',
          results: [searchResult],
        },
      })
    )

    expect(vm.header.searchEmptyMessage).toBeNull()
    expect(vm.header.searchErrorMessage).toBeNull()
    expect(vm.header.searchCanRetry).toBe(true)
    expect(vm.header.searchResults).toHaveLength(1)
  })

  it('builds the no-selected-job state without hiding the available job list', () => {
    const vm = buildQuoteHomePageVm(
      buildState({
        selectedJobId: '',
        selectedJob: null,
      }),
      buildResources({
        workflow: {
          versions: {
            items: [],
            totalVersions: 4,
            hasMore: false,
            loadingMore: false,
            hasResolved: false,
          },
          create: {
            canCreate: false,
          },
        },
      })
    )

    expect(vm.jobList.emptyState).toBe('none')
    expect(vm.jobList.emptyStateBody).toBeNull()
    expect(vm.jobList.errorMessage).toBeNull()
    expect(vm.jobList.canRetry).toBe(false)
    expect(vm.selectedJob.title).toBeNull()
    expect(vm.selectedJob.emptyMessage).toBe(
      'Select a job from the left to view versions and create the next one.'
    )
    expect(vm.versionList).toEqual(expect.objectContaining({
      heading: 'Pick a job first',
      detail: null,
      emptyMessage: 'Versions will appear here once a job is selected.',
      items: [],
      hasMore: false,
      loadingMore: false,
      errorMessage: null,
      canRetry: false,
    }))
    expect(vm.versionList.status).toEqual({
      kind: 'empty',
      message: 'Versions will appear here once a job is selected.',
    })
    expect(vm.create.selectedJobName).toBeNull()
    expect(vm.create.canCreate).toBe(false)
  })

  it('threads job pagination affordances into the job list vm', () => {
    const vm = buildQuoteHomePageVm(
      buildState(),
      buildResources({
        home: {
          hasMore: true,
        },
      })
    )

    expect(vm.jobList.hasMore).toBe(true)
  })

  it('falls back to the selected job count until the versions page resolves', () => {
    const vm = buildQuoteHomePageVm(
      buildState(),
      buildResources({
        workflow: {
          versions: {
            items: [],
            totalVersions: 0,
            hasMore: false,
            loadingMore: false,
            hasResolved: false,
          },
        },
      })
    )

    expect(vm.selectedJob.stats).toContainEqual({
      label: 'Versions',
      value: '2',
    })
    expect(vm.versionList.heading).toBe('2 versions under this job')
    expect(vm.versionList.detail).toBeNull()
  })

  it('threads selected-job version pagination affordances into the version list vm', () => {
    const vm = buildQuoteHomePageVm(
      buildState(),
      buildResources({
        workflow: {
          versions: {
            items: Array.from({ length: 25 }, (_, index) => ({
              ...versionOne,
              estimate_id: `estimate-${index + 1}`,
              version_name: `Version ${index + 1}`,
            })),
            totalVersions: 30,
            hasMore: true,
            loadingMore: true,
            hasResolved: true,
          },
        },
      })
    )

    expect(vm.selectedJob.stats).toContainEqual({
      label: 'Versions',
      value: '30',
    })
    expect(vm.versionList).toEqual(
      expect.objectContaining({
        heading: '30 versions under this job',
        detail: 'Showing 25 of 30 versions.',
        hasMore: true,
        loadingMore: true,
      })
    )
  })

  it('threads delete busy state into version row actions', () => {
    const vm = buildQuoteHomePageVm(
      buildState(),
      buildResources({
        delete: {
          deletingId: 'estimate-1',
        },
      })
    )

    expect(vm.versionList.items).toEqual([
      expect.objectContaining({
        id: 'estimate-2',
        deleting: false,
        deleteDisabled: true,
        deleteBusy: false,
        deleteButtonLabel: 'Delete',
        deleteButtonAriaLabel:
          'Delete quote version Version B unavailable while another version is deleting',
      }),
      expect.objectContaining({
        id: 'estimate-1',
        deleting: true,
        deleteDisabled: true,
        deleteBusy: true,
        deleteButtonLabel: 'Deleting...',
        deleteButtonAriaLabel: 'Deleting quote version Version A',
      }),
    ])
  })

  it('builds accessible destructive dialog state from the confirming version', () => {
    const vm = buildQuoteHomePageVm(
      buildState(),
      buildResources({
        delete: {
          confirmingDelete: versionOne,
          deletingId: 'estimate-1',
        },
      })
    )

    expect(vm.dialogs.delete).toEqual({
      isOpen: true,
      estimateId: 'estimate-1',
      versionName: 'Version A',
      jobTitle: 'Kitchen',
      deleting: true,
      title: 'Delete Version A?',
      description: 'Permanently delete quote version Version A from Kitchen.',
      closeLabel: 'Close delete confirmation',
      warning: 'This permanently deletes the quote version. This cannot be undone.',
      info:
        'The home page will refresh job counts and the selected job version list after delete.',
      cancelLabel: 'Cancel',
      cancelAriaLabel: 'Cancel deleting quote version Version A',
      confirmLabel: 'Delete Version A',
      confirmAriaLabel: 'Permanently delete quote version Version A from Kitchen',
      confirmingLabel: 'Deleting Version A...',
      confirmingAriaLabel: 'Deleting quote version Version A from Kitchen',
      confirmDisabled: true,
      cancelDisabled: true,
    })
  })

  it('threads selected-job version load failures into the version list vm', () => {
    const vm = buildQuoteHomePageVm(
      buildState(),
      buildResources({
        workflow: {
          versions: {
            items: [],
            error: 'versions failed',
            totalVersions: 0,
            hasMore: false,
            loadingMore: false,
            hasResolved: true,
          },
        },
      })
    )

    expect(vm.versionList.errorMessage).toBe('versions failed')
    expect(vm.versionList.canRetry).toBe(true)
    expect(vm.feedback).toEqual({
      tone: 'warning',
      title: 'Quote home loaded with errors',
      details: ['Job versions failed to load. versions failed'],
      sources: ['jobVersions'],
    })
  })

  it('keeps jobs-page failures inside the jobs pane when prior job data exists', () => {
    const vm = buildQuoteHomePageVm(
      buildState(),
      buildResources({
        home: {
          jobsError: 'jobs failed',
        },
      })
    )

    expect(vm.feedback).toBeNull()
    expect(vm.jobList.errorMessage).toBe('jobs failed')
    expect(vm.jobList.canRetry).toBe(true)
    expect(vm.jobList.items).toHaveLength(2)
  })

  it('derives the filtered job-list empty state when jobs exist but none are visible', () => {
    const vm = buildQuoteHomePageVm(
      buildState({
        jobQuery: 'missing',
        visibleJobs: [],
      }),
      buildResources()
    )

    expect(vm.jobList.emptyState).toBe('no_matches')
    expect(vm.jobList.emptyStateBody).toBeNull()
    expect(vm.jobList.errorMessage).toBeNull()
    expect(vm.jobList.canRetry).toBe(false)
  })

  it('surfaces create failures as deterministic action feedback', () => {
    const vm = buildQuoteHomePageVm(
      buildState(),
      buildResources({
        workflow: {
          create: {
            error: 'Create failed.',
          },
        },
      })
    )

    expect(vm.feedback).toEqual({
      tone: 'error',
      title: 'Quote action failed',
      details: ['Create failed.'],
      sources: ['create'],
    })
  })

  it('surfaces delete failures as deterministic action feedback', () => {
    const vm = buildQuoteHomePageVm(
      buildState(),
      buildResources({
        delete: {
          error: 'Delete failed.',
        },
      })
    )

    expect(vm.feedback).toEqual({
      tone: 'error',
      title: 'Quote action failed',
      details: ['Delete failed.'],
      sources: ['delete'],
    })
  })

  it('keeps job-list loading scoped to the jobs pane during server-backed queries', () => {
    const vm = buildQuoteHomePageVm(
      buildState(),
      buildResources({
        home: {
          jobsLoading: true,
        },
      })
    )

    expect(vm.loading).toBe(false)
    expect(vm.jobList.loading).toBe(true)
    expect(vm.selectedJob.loading).toBe(false)
    expect(vm.create.loading).toBe(false)
  })

  it('surfaces feedback when resource or action issues are present', () => {
    const vm = buildQuoteHomePageVm(
      buildState({
        actionWarning: {
          source: 'delete',
          message: 'Quote deleted, but the list refresh failed.',
        },
      }),
      buildResources({
        home: {
          bootstrapError: 'Network request timed out.',
        },
      })
    )

    expect(vm.feedback).toEqual({
      tone: 'warning',
      title: 'Quote action completed with refresh errors',
      details: [
        'Quote home failed to load. Network request timed out.',
        'Quote deleted, but the list refresh failed.',
      ],
      sources: ['bootstrap', 'delete'],
    })
  })

  it('maps bootstrap failures with no job data into a retryable job-list error state', () => {
    const vm = buildQuoteHomePageVm(
      buildState({
        selectedJobId: '',
        selectedJob: null,
        visibleJobs: [],
      }),
      buildResources({
        home: {
          jobs: [],
          bootstrapError: 'Network request timed out.',
        },
        workflow: {
          versions: {
            items: [],
            totalVersions: 0,
            hasMore: false,
            loadingMore: false,
            hasResolved: false,
          },
          create: {
            canCreate: false,
          },
        },
      })
    )

    expect(vm.jobList).toEqual(expect.objectContaining({
      loading: false,
      searchQuery: '',
      selectedJobId: '',
      hasMore: false,
      items: [],
      errorMessage: 'Network request timed out.',
      canRetry: true,
      emptyState: 'none',
      emptyStateBody: null,
    }))
    expect(vm.jobList.status).toEqual({
      kind: 'error',
      title: 'Jobs failed to load',
      message: 'Network request timed out.',
      canRetry: true,
      retryLabel: 'Retry jobs',
      retryingLabel: 'Retrying jobs...',
    })
  })

  it('keeps combined bootstrap and jobs-page failures distinct without duplicate feedback', () => {
    const vm = buildQuoteHomePageVm(
      buildState({
        selectedJobId: '',
        selectedJob: null,
        visibleJobs: [],
      }),
      buildResources({
        home: {
          jobs: [],
          bootstrapError: 'Bootstrap timed out.',
          jobsError: 'Jobs page timed out.',
        },
        workflow: {
          versions: {
            items: [],
            totalVersions: 0,
            hasMore: false,
            loadingMore: false,
            hasResolved: false,
          },
          create: {
            canCreate: false,
          },
        },
      })
    )

    expect(vm.feedback).toEqual({
      tone: 'warning',
      title: 'Quote home bootstrap failed to load',
      details: ['Quote home failed to load. Bootstrap timed out.'],
      sources: ['bootstrap'],
    })
    expect(vm.jobList.errorMessage).toBe('Jobs page timed out.')
    expect(vm.jobList.canRetry).toBe(true)
  })

  it('propagates loading state without showing empty selected-job messaging', () => {
    const vm = buildQuoteHomePageVm(
      buildState({
        selectedJobId: '',
        selectedJob: null,
      }),
      buildResources({
        home: {
          loading: true,
        },
        workflow: {
          versions: {
            items: [],
            totalVersions: 0,
            hasMore: false,
            loadingMore: false,
            hasResolved: false,
          },
          create: {
            canCreate: false,
          },
        },
      })
    )

    expect(vm.loading).toBe(true)
    expect(vm.jobList.loading).toBe(true)
    expect(vm.selectedJob).toEqual({
      loading: true,
      state: 'loading',
      emptyMessage: null,
      title: null,
      customerLine: null,
      jobHref: null,
      stats: [],
    })
    expect(vm.create.loading).toBe(true)
  })
})
