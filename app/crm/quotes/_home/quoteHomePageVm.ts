import type { QuoteHomeSummaryReadModel } from '@/lib/quotes/collectionData'
import type { QuoteVersionKind } from '@/lib/quotes/versionCreation'
import {
  buildHeroSummaryText,
  buildQuoteHomeJobListItemVm,
  buildQuotesHomeCreateVm,
  buildQuotesHomeJobListEmptyStateBody,
  buildQuoteHomeVersionItemVm,
  buildQuotesHomeDeleteDialogVm,
  buildQuotesHomeFeedbackVm,
  buildQuotesHomeSearchCanRetry,
  buildQuotesHomeSearchEmptyMessage,
  buildQuotesHomeSelectedJobVm,
  buildQuotesHomeVersionDetail,
  buildQuotesHomeVersionEmptyMessage,
  buildQuotesHomeVersionHeading,
  buildSearchResultVm,
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
  resources: QuoteHomePageVmResources
): QuoteHomePageVm {
  const summaryCards = buildSummaryCards(resources.home.summary).map((card) => ({
    ...card,
    displayValue: resources.home.loading
      ? '...'
      : card.value,
  }))
  const bootstrapBlocksJobList =
    !resources.home.loading &&
    resources.home.jobs.length === 0 &&
    Boolean(resources.home.bootstrapError)
  const jobListErrorMessage =
    resources.home.jobsError ??
    (bootstrapBlocksJobList ? resources.home.bootstrapError : null)
  const hasJobListLoadError = Boolean(jobListErrorMessage)
  const feedbackVm = buildQuotesHomeFeedbackVm({
    homeFailures: resources.home.bootstrapError
      ? [{ source: 'bootstrap', message: resources.home.bootstrapError }]
      : [],
    jobVersionsError: null,
    createError: resources.workflow.create.error,
    deleteError: resources.delete.error,
    actionWarning: state.actionWarning,
  })
  const versionCount = state.selectedJob
    ? resources.workflow.versions.hasResolved
      ? resources.workflow.versions.totalVersions
      : state.selectedJob.version_count
    : resources.workflow.versions.totalVersions
  const searchEmptyMessage = buildQuotesHomeSearchEmptyMessage({
    query: resources.search.query,
    loading: resources.search.loading,
    error: resources.search.error,
    resultCount: resources.search.results.length,
  })
  const searchCanRetry = buildQuotesHomeSearchCanRetry({
    query: resources.search.query,
    loading: resources.search.loading,
  })

  const jobListEmptyState = hasJobListLoadError
    ? 'none'
    : resources.home.jobs.length === 0
      ? 'no_jobs'
      : state.visibleJobs.length === 0
        ? 'no_matches'
        : 'none'

  return {
    header: {
      heroSummaryText: buildHeroSummaryText(resources.home.summary),
      searchQuery: state.searchQuery,
      searchFocused: state.searchFocused,
      searchLoading: resources.search.loading,
      searchEmptyMessage,
      searchErrorMessage: resources.search.error,
      searchCanRetry,
      searchResults: resources.search.results.map(buildSearchResultVm),
    },
    loading: resources.home.loading,
    feedback: feedbackVm,
    summaryCards,
    jobList: {
      loading: resources.home.loading || resources.home.jobsLoading,
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
      emptyStateBody: buildQuotesHomeJobListEmptyStateBody(jobListEmptyState),
    },
    selectedJob: buildQuotesHomeSelectedJobVm(
      state.selectedJob,
      versionCount,
      resources.home.loading
    ),
    versionList: {
      heading: buildQuotesHomeVersionHeading(state.selectedJob, versionCount),
      detail: buildQuotesHomeVersionDetail(state.selectedJob, {
        loadedVersions: resources.workflow.versions.items.length,
        totalVersions: versionCount,
        hasMore: resources.workflow.versions.hasMore,
      }),
      emptyMessage: buildQuotesHomeVersionEmptyMessage(
        state.selectedJob,
        resources.workflow.versions.items
      ),
      items: resources.workflow.versions.items.map((estimate) =>
        buildQuoteHomeVersionItemVm(estimate, resources.delete.deletingId)
      ),
      hasMore: resources.workflow.versions.hasMore,
      loadingMore: resources.workflow.versions.loadingMore,
      errorMessage: resources.workflow.versions.error,
      canRetry: Boolean(resources.workflow.versions.error),
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
