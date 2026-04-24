import type { QuoteHomeSummaryReadModel } from '@/lib/quotes/collectionData'
import type { QuoteVersionKind } from '@/lib/quotes/versionCreation'
import {
  buildHeroSummaryText,
  buildQuoteHomeJobListItemVm,
  buildQuoteHomeVersionItemVm,
  buildQuotesHomeDeleteDialogVm,
  buildQuotesHomeFeedbackVm,
  buildQuotesHomeSelectedJobVm,
  buildQuotesHomeVersionEmptyMessage,
  buildQuotesHomeVersionHeading,
  buildSearchResultVm,
  buildSummaryCards,
} from './quoteHomePresentation'
import type {
  QuoteHomeJob,
  QuoteHomeJobVersion,
  QuotesHomeCreateVm,
  QuotesHomeDeleteDialogVm,
  QuotesHomeFeedbackBannerVm,
  QuotesHomeHeaderVm,
  QuotesHomeJobListVm,
  QuotesHomeSelectedJobVm,
  QuotesHomeVersionListVm,
  SummaryCardVm,
} from './quoteHomeTypes'

type SearchResultSource = Parameters<typeof buildSearchResultVm>[0]

export type QuoteHomePageActions = {
  setSearchQuery: (value: string) => void
  setSearchFocused: (value: boolean) => void
  setJobQuery: (value: string) => void
  setSelectedJobId: (value: string) => void
  setVersionName: (value: string) => void
  setVersionKind: (value: QuoteVersionKind) => void
  create: () => Promise<unknown>
  retrySearch: () => void
  requestDelete: (value: string | { estimate_id: string }) => void
  cancelDelete: () => void
  confirmDelete: () => Promise<boolean>
  refresh: () => Promise<boolean>
}

export type QuoteHomePageVmState = {
  actionWarning: string | null
  searchQuery: string
  searchFocused: boolean
  jobQuery: string
  selectedJobId: string
  selectedJob: QuoteHomeJob | null
  filteredJobs: QuoteHomeJob[]
  actions: QuoteHomePageActions
}

export type QuoteHomePageVmResources = {
  home: {
    summary: QuoteHomeSummaryReadModel | null
    jobs: QuoteHomeJob[]
    loading: boolean
    bootstrapError: string | null
  }
  search: {
    loading: boolean
    emptyMessage: string | null
    error: string | null
    canRetry: boolean
    results: SearchResultSource[]
  }
  workflow: {
    versions: {
      items: QuoteHomeJobVersion[]
      error: string | null
      totalVersions: number
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
  feedback: QuotesHomeFeedbackBannerVm
  summaryCards: SummaryCardVm[]
  jobList: QuotesHomeJobListVm
  selectedJob: QuotesHomeSelectedJobVm
  versionList: QuotesHomeVersionListVm
  create: QuotesHomeCreateVm
  mobileSummaryCards: SummaryCardVm[]
  dialogs: {
    delete: QuotesHomeDeleteDialogVm
  }
  actions: QuoteHomePageActions
}

const EMPTY_FEEDBACK_VM = {
  tone: 'warning' as const,
  title: '',
  details: [],
  sources: [],
}

function buildMobileSummaryCards(summaryCards: SummaryCardVm[]) {
  return [summaryCards[0], summaryCards[3]].filter(
    (card): card is SummaryCardVm => card != null
  )
}

export function buildQuoteHomePageVm(
  state: QuoteHomePageVmState,
  resources: QuoteHomePageVmResources
): QuoteHomePageVm {
  const summaryCards = buildSummaryCards(resources.home.summary)
  const feedbackVm =
    buildQuotesHomeFeedbackVm({
      homeFailures: resources.home.bootstrapError
        ? [{ source: 'bootstrap', message: resources.home.bootstrapError }]
        : [],
      jobVersionsError: resources.workflow.versions.error,
      createError: resources.workflow.create.error,
      deleteError: resources.delete.error,
      actionWarning: state.actionWarning,
    }) ?? EMPTY_FEEDBACK_VM
  const versionCount =
    state.selectedJob?.version_count ?? resources.workflow.versions.totalVersions

  return {
    header: {
      heroSummaryText: buildHeroSummaryText(resources.home.summary),
      searchQuery: state.searchQuery,
      searchFocused: state.searchFocused,
      searchLoading: resources.search.loading,
      searchEmptyMessage: resources.search.emptyMessage,
      searchErrorMessage: resources.search.error,
      searchCanRetry: resources.search.canRetry,
      searchResults: resources.search.results.map(buildSearchResultVm),
    },
    feedback: {
      loading: resources.home.loading,
      ...feedbackVm,
    },
    summaryCards,
    jobList: {
      loading: resources.home.loading,
      searchQuery: state.jobQuery,
      selectedJobId: state.selectedJobId,
      items: state.filteredJobs.map((job) =>
        buildQuoteHomeJobListItemVm(job, job.version_count, {
          selectedJobId: state.selectedJobId,
        })
      ),
      mobileItems: resources.home.jobs
        .slice(0, 10)
        .map((job) => buildQuoteHomeJobListItemVm(job, job.version_count, { mobile: true })),
      emptyState:
        resources.home.jobs.length === 0
          ? 'no_jobs'
          : state.filteredJobs.length === 0
            ? 'no_matches'
            : 'none',
    },
    selectedJob: buildQuotesHomeSelectedJobVm(
      state.selectedJob,
      versionCount,
      resources.home.loading
    ),
    versionList: {
      heading: buildQuotesHomeVersionHeading(
        state.selectedJob,
        resources.workflow.versions.items
      ),
      emptyMessage: buildQuotesHomeVersionEmptyMessage(
        state.selectedJob,
        resources.workflow.versions.items
      ),
      items: resources.workflow.versions.items.map((estimate) =>
        buildQuoteHomeVersionItemVm(estimate, resources.delete.deletingId)
      ),
    },
    create: {
      creating: resources.workflow.create.creating,
      loading: resources.home.loading,
      selectedJobName: state.selectedJob?.title ?? null,
      versionName: resources.workflow.create.versionName,
      versionKind: resources.workflow.create.versionKind,
      canCreate: resources.workflow.create.canCreate,
    },
    mobileSummaryCards: buildMobileSummaryCards(summaryCards),
    dialogs: {
      delete: buildQuotesHomeDeleteDialogVm(
        resources.delete.confirmingDelete,
        resources.delete.deletingId
      ),
    },
    actions: state.actions,
  }
}
