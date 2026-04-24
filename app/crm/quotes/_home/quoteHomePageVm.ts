import type { QuoteHomeSummaryReadModel } from '@/lib/quotes/collectionData'
import type { QuoteVersionKind } from '@/lib/quotes/versionCreation'
import {
  buildHeroSummaryText,
  buildQuoteHomeJobListItemVm,
  buildQuotesHomeCreateVm,
  buildQuotesHomeJobListEmptyState,
  buildQuotesHomeJobListEmptyStateBody,
  buildQuotesHomeJobListStatus,
  buildQuoteHomeVersionItemVm,
  buildQuotesHomeDeleteDialogVm,
  buildQuotesHomeFeedbackVm,
  buildQuotesHomeSearchEmptyMessage,
  buildQuotesHomeSearchStatus,
  buildQuotesHomeSelectedJobVersionCount,
  buildQuotesHomeSelectedJobVm,
  buildQuotesHomeVersionListStatus,
  buildQuotesHomeVersionDetail,
  buildQuotesHomeVersionEmptyMessage,
  buildQuotesHomeVersionHeading,
  buildSearchResultVm,
  QUOTES_HOME_LOADING_COPY,
  buildSummaryCards,
} from './quoteHomePresentation'
import type {
  QuoteHomeActionWarning,
  QuoteHomeJob,
  QuoteHomeJobVersion,
  QuoteHomeSearchResult,
  QuotesHomeCreateVm,
  QuotesHomeDeleteDialogVm,
  QuotesHomeFeedbackBannerVm,
  QuotesHomeHeaderVm,
  QuotesHomeJobListVm,
  QuotesHomeSelectedJobVm,
  QuotesHomeVersionListVm,
  SummaryCardVm,
} from './quoteHomeTypes'

export type QuoteHomePageActions = {
  setSearchQuery: (value: string) => void
  setSearchFocused: (value: boolean) => void
  setJobQuery: (value: string) => void
  setSelectedJobId: (value: string) => void
  loadMore: () => Promise<void>
  setVersionName: (value: string) => void
  setVersionKind: (value: QuoteVersionKind) => void
  create: () => Promise<unknown>
  loadMoreVersions: () => Promise<boolean>
  retryJobs: () => Promise<boolean>
  retryVersions: () => Promise<boolean>
  retrySearch: () => void
  requestDelete: (value: string | { estimate_id: string }) => void
  cancelDelete: () => void
  confirmDelete: () => Promise<boolean>
  refresh: () => Promise<boolean>
}

export type QuoteHomePageVmState = {
  actionWarning: QuoteHomeActionWarning | null
  searchQuery: string
  searchFocused: boolean
  jobQuery: string
  selectedJobId: string
  selectedJob: QuoteHomeJob | null
  visibleJobs: QuoteHomeJob[]
  actions: QuoteHomePageActions
}

export type QuoteHomePageVmResources = {
  home: {
    summary: QuoteHomeSummaryReadModel | null
    jobs: QuoteHomeJob[]
    hasMore: boolean
    jobsLoading: boolean
    loading: boolean
    bootstrapError: string | null
    jobsError: string | null
  }
  search: {
    query: string
    loading: boolean
    error: string | null
    results: QuoteHomeSearchResult[]
  }
  workflow: {
    versions: {
      items: QuoteHomeJobVersion[]
      error: string | null
      totalVersions: number
      hasMore: boolean
      loadingMore: boolean
      hasResolved: boolean
    }
    create: {
      creating: boolean
      error: string | null
      versionName: string
      versionKind: QuoteVersionKind
      canCreate: boolean
    }
  }
  delete: {
    confirmingDelete: QuoteHomeJobVersion | null
    deletingId: string | null
    error: string | null
  }
}

export type QuoteHomePageVm = {
  header: QuotesHomeHeaderVm
  loading: boolean
  feedback: QuotesHomeFeedbackBannerVm
  summaryCards: SummaryCardVm[]
  jobList: QuotesHomeJobListVm
  selectedJob: QuotesHomeSelectedJobVm
  versionList: QuotesHomeVersionListVm
  create: QuotesHomeCreateVm
  dialogs: {
    delete: QuotesHomeDeleteDialogVm
  }
  actions: QuoteHomePageActions
}

export function buildQuoteHomePageVm(
  state: QuoteHomePageVmState,
  resources: QuoteHomePageVmResources,
  options: { includeVersionFailureInFeedback?: boolean } = {}
): QuoteHomePageVm {
  const jobListErrorMessage = buildQuotesHomeJobListErrorMessage(resources)
  const hasJobListLoadError = Boolean(jobListErrorMessage)
  const selectedJobVersionCount = buildQuotesHomeSelectedJobVersionCount({
    selectedJob: state.selectedJob,
    totalVersions: resources.workflow.versions.totalVersions,
    hasResolved: resources.workflow.versions.hasResolved,
  })
  const jobListEmptyState = buildQuotesHomeJobListEmptyState({
    hasLoadError: hasJobListLoadError,
    totalJobCount: resources.home.jobs.length,
    visibleJobCount: state.visibleJobs.length,
  })
  const jobListEmptyStateBody =
    buildQuotesHomeJobListEmptyStateBody(jobListEmptyState)
  const jobListLoading = resources.home.loading || resources.home.jobsLoading
  const jobListStatus = buildQuotesHomeJobListStatus({
    loading: jobListLoading,
    errorMessage: jobListErrorMessage,
    canRetry: hasJobListLoadError,
    emptyState: jobListEmptyState,
    emptyStateBody: jobListEmptyStateBody,
  })
  const searchState = buildQuoteHomeSearchState(resources)
  const versionEmptyMessage = buildQuotesHomeVersionEmptyMessage(
    state.selectedJob,
    resources.workflow.versions.items
  )
  const versionErrorMessage = resources.workflow.versions.error
  const versionCanRetry = Boolean(versionErrorMessage)
  const versionStatus = buildQuotesHomeVersionListStatus({
    errorMessage: versionErrorMessage,
    canRetry: versionCanRetry,
    emptyMessage: versionEmptyMessage,
  })
  const feedbackVm = buildQuotesHomeFeedbackVm({
    homeFailures: buildQuoteHomeLoadFailures(resources),
    jobVersionsError: options.includeVersionFailureInFeedback === false
      ? null
      : resources.workflow.versions.error,
    createError: resources.workflow.create.error,
    deleteError: resources.delete.error,
    actionWarning: state.actionWarning,
  })
  const summaryCards = buildSummaryCards(resources.home.summary).map((card) => ({
    ...card,
    displayValue: resources.home.loading
      ? '...'
      : card.value,
  }))

  return {
    header: {
      heroSummaryText: buildHeroSummaryText(resources.home.summary),
      searchQuery: state.searchQuery,
      searchFocused: state.searchFocused,
      searchLoading: resources.search.loading,
      searchEmptyMessage: searchState.emptyMessage,
      searchErrorMessage: resources.search.error,
      searchCanRetry: searchState.canRetry,
      searchResults: resources.search.results.map(buildSearchResultVm),
      searchStatus: searchState.status,
    },
    loading: resources.home.loading,
    feedback: feedbackVm,
    summaryCards,
    jobList: {
      loading: jobListLoading,
      searchQuery: state.jobQuery,
      selectedJobId: state.selectedJobId,
      hasMore: resources.home.hasMore,
      items: state.visibleJobs.map((job) =>
        buildQuoteHomeJobListItemVm(job, job.version_count, {
          selectedJobId: state.selectedJobId,
        })
      ),
      errorMessage: jobListErrorMessage,
      canRetry: hasJobListLoadError,
      emptyState: jobListEmptyState,
      emptyStateBody: jobListEmptyStateBody,
      status: jobListStatus,
      loadMoreLabel: QUOTES_HOME_LOADING_COPY.jobsLoadMore,
      loadingMoreLabel: QUOTES_HOME_LOADING_COPY.jobsLoadingMore,
    },
    selectedJob: buildQuotesHomeSelectedJobVm(
      state.selectedJob,
      selectedJobVersionCount,
      resources.home.loading
    ),
    versionList: {
      heading: buildQuotesHomeVersionHeading(
        state.selectedJob,
        selectedJobVersionCount
      ),
      detail: buildQuotesHomeVersionDetail(state.selectedJob, {
        loadedVersions: resources.workflow.versions.items.length,
        totalVersions: selectedJobVersionCount,
        hasMore: resources.workflow.versions.hasMore,
      }),
      emptyMessage: versionEmptyMessage,
      items: resources.workflow.versions.items.map((estimate) =>
        buildQuoteHomeVersionItemVm(estimate, resources.delete.deletingId)
      ),
      hasMore: resources.workflow.versions.hasMore,
      loadingMore: resources.workflow.versions.loadingMore,
      errorMessage: versionErrorMessage,
      canRetry: versionCanRetry,
      status: versionStatus,
      loadMoreLabel: QUOTES_HOME_LOADING_COPY.versionsLoadMore,
      loadingMoreLabel: QUOTES_HOME_LOADING_COPY.versionsLoadingMore,
    },
    create: buildQuotesHomeCreateVm({
      creating: resources.workflow.create.creating,
      loading: resources.home.loading,
      selectedJobName: state.selectedJob?.title ?? null,
      versionName: resources.workflow.create.versionName,
      versionKind: resources.workflow.create.versionKind,
      canCreate: resources.workflow.create.canCreate,
    }),
    dialogs: {
      delete: buildQuotesHomeDeleteDialogVm(
        resources.delete.confirmingDelete,
        resources.delete.deletingId
      ),
    },
    actions: state.actions,
  }
}

function buildQuoteHomeLoadFailures(
  resources: QuoteHomePageVmResources
): Array<{ source: 'bootstrap'; message: string }> {
  return resources.home.bootstrapError
    ? [{ source: 'bootstrap', message: resources.home.bootstrapError }]
    : []
}

function buildQuotesHomeJobListErrorMessage(
  resources: QuoteHomePageVmResources
) {
  if (resources.home.jobsError) return resources.home.jobsError

  const bootstrapBlocksJobList =
    !resources.home.loading &&
    resources.home.jobs.length === 0 &&
    Boolean(resources.home.bootstrapError)

  return bootstrapBlocksJobList ? resources.home.bootstrapError : null
}

function buildQuoteHomeSearchState(resources: QuoteHomePageVmResources) {
  const params = {
    query: resources.search.query,
    loading: resources.search.loading,
    error: resources.search.error,
    resultCount: resources.search.results.length,
  }
  const status = buildQuotesHomeSearchStatus(params)

  return {
    emptyMessage: buildQuotesHomeSearchEmptyMessage(params),
    canRetry:
      status.kind === 'error'
        ? status.canRetry
        : Boolean(resources.search.query) && !resources.search.loading,
    status,
  }
}
