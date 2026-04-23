'use client'

<<<<<<< Updated upstream
import { useMemo, useState } from 'react'
=======
import { useEffect, useState } from 'react'
>>>>>>> Stashed changes
import type { QuoteHomeBootstrapReadModel } from '@/lib/quotes/collectionData'
import { useQuoteJobVersions } from './useQuoteJobVersions'
import { useQuoteVersionCreation } from './useQuoteVersionCreation'
import { useQuotesHomeData } from './useQuotesHomeData'
import { useQuotesHomeDelete } from './useQuotesHomeDelete'
<<<<<<< Updated upstream
import { useQuotesHomeSelection } from './useQuotesHomeSelection'
=======
import { useQuoteVersionWorkflow } from './useQuoteVersionWorkflow'
>>>>>>> Stashed changes
import { useQuotesHomeSearch } from './useQuotesHomeSearch'
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
} from '../_home/quoteHomePresentation'
import type { QuotesHomeJobListVm } from '../_home/quoteHomeTypes'

export function useQuotesHomePage(initialData?: QuoteHomeBootstrapReadModel | null) {
<<<<<<< Updated upstream
  const dataState = useQuotesHomeData(initialData)
  const selection = useQuotesHomeSelection({
    jobCounts: dataState.jobCounts,
    jobs: dataState.jobs,
  })
  const searchState = useQuotesHomeSearch(selection.searchQuery)
  const jobVersionsState = useQuoteJobVersions(selection.selectedJobId)
  const createController = useQuoteVersionCreation(selection.selectedJob)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteController = useQuotesHomeDelete({
    refresh: dataState.refresh,
    setDeleteError,
  })

  const summaryCards = buildSummaryCards(dataState.summary)
  const jobListItems = selection.filteredJobs.map((job) =>
    buildQuoteHomeJobListItemVm(job, selection.versionCountByJob[job.id] ?? 0, {
      selectedJobId: selection.selectedJobId,
    })
  )
  const mobileItems = dataState.jobs
    .slice(0, 10)
    .map((job) => buildQuoteHomeJobListItemVm(job, selection.versionCountByJob[job.id] ?? 0, { mobile: true }))
  const versionItems = jobVersionsState.items.map((estimate) =>
    buildQuoteHomeVersionItemVm(estimate, deleteController.deletingId)
  )
  const homeFailures = Object.values(dataState.failures).filter(
    (failure): failure is NonNullable<(typeof dataState.failures)[keyof typeof dataState.failures]> =>
      failure !== null
  )
  const feedbackVm = buildQuotesHomeFeedbackVm({
    homeFailures,
    jobVersionsError: jobVersionsState.error,
    createError: createController.error,
    deleteError,
=======
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [jobQuery, setJobQuery] = useState(initialData?.jobs.query ?? '')

  const home = useQuotesHomeData(initialData)
  const searchState = useQuotesHomeSearch(searchQuery)
  const deleteController = useQuotesHomeDelete()
  const workflow = useQuoteVersionWorkflow({
    jobId: home.selectedJobId,
    selectedJob: home.selectedJob,
    initialVersions:
      initialData?.selected_job_versions?.job_id === home.selectedJobId
        ? initialData.selected_job_versions
        : null,
    loading: home.loading,
    onRefresh: home.refresh,
  })

  useEffect(() => {
    setJobQuery(home.jobsPage.query)
  }, [home.jobsPage.query])

  const summaryCards = buildSummaryCards(home.summary)
  const jobListItems = home.jobs.map((job) =>
    buildQuoteHomeJobListItemVm(job, {
      selectedJobId: home.selectedJobId,
    })
  )
  const mobileItems = home.jobs.slice(0, 10).map((job) =>
    buildQuoteHomeJobListItemVm(job, {
      mobile: true,
    })
  )
  const versionItems = workflow.versions.items.map((estimate) =>
    buildQuoteHomeVersionItemVm(estimate, deleteController.deletingId)
  )

  const feedbackVm = buildQuotesHomeFeedbackVm({
    homeFailures: home.bootstrapError
      ? [{ source: 'bootstrap', message: home.bootstrapError }]
      : [],
    jobsError: home.jobsError,
    jobVersionsError: workflow.versions.error,
    createError: workflow.create.error,
    deleteError: deleteController.error,
    actionWarning: null,
>>>>>>> Stashed changes
  })
  const resolvedFeedbackVm = feedbackVm ?? {
    tone: 'warning' as const,
    title: null,
    details: [],
    sources: [],
  }
<<<<<<< Updated upstream
  const versionCount = selection.versionCountByJob[selection.selectedJobId] ?? jobVersionsState.data.total_versions
  const deleteTargetsById = useMemo(() => {
    return new Map(jobVersionsState.items.map((item) => [item.estimate_id, item]))
  }, [jobVersionsState.items])
=======
>>>>>>> Stashed changes

  return {
    feedbackVm: {
      loading: dataState.loading,
      ...resolvedFeedbackVm,
      hasData: true,
      summary: dataState.summary,
    },
    headerVm: {
<<<<<<< Updated upstream
      heroSummaryText: buildHeroSummaryText(dataState.summary),
      searchQuery: selection.searchQuery,
      searchFocused: selection.searchFocused,
=======
      heroSummaryText: buildHeroSummaryText(home.summary),
      searchQuery,
      searchFocused,
>>>>>>> Stashed changes
      searchLoading: searchState.loading,
      searchEmptyMessage: searchState.emptyMessage,
      searchErrorMessage: searchState.error,
      searchCanRetry: searchState.canRetry,
      searchResults: searchState.results.map(buildSearchResultVm),
    },
<<<<<<< Updated upstream
=======
    feedbackVm: {
      loading: home.loading,
      ...resolvedFeedbackVm,
    },
>>>>>>> Stashed changes
    summaryCards,
    mobileVm: {
      summaryCards: [summaryCards[0], summaryCards[3]].filter(Boolean),
    },
    jobListVm: {
<<<<<<< Updated upstream
      loading: dataState.loading,
      searchQuery: selection.jobQuery,
      selectedJobId: selection.selectedJobId,
      items: jobListItems,
      mobileItems,
      emptyState:
        dataState.jobs.length === 0
          ? 'no_jobs'
          : jobListItems.length === 0
            ? 'no_matches'
            : 'none',
    } satisfies QuotesHomeJobListVm,
    selectedJobVm: buildQuotesHomeSelectedJobVm(
      selection.selectedJob,
      versionCount,
      dataState.loading
    ),
    versionListVm: {
      heading: buildQuotesHomeVersionHeading(selection.selectedJob, jobVersionsState.items),
      emptyMessage: buildQuotesHomeVersionEmptyMessage(selection.selectedJob, jobVersionsState.items),
=======
      loading: home.loading,
      loadingMore: home.jobsLoadingMore,
      searchQuery: jobQuery,
      selectedJobId: home.selectedJobId,
      items: jobListItems,
      mobileItems,
      emptyState: home.jobs.length === 0 ? (jobQuery ? 'no_matches' : 'no_jobs') : 'none',
      hasMore: home.hasMoreJobs,
    } satisfies QuotesHomeJobListVm,
    selectedJobVm: buildQuotesHomeSelectedJobVm(
      home.selectedJob,
      workflow.versions.data.total_versions,
      home.loading
    ),
    versionListVm: {
      heading: buildQuotesHomeVersionHeading(home.selectedJob, workflow.versions.items),
      emptyMessage: buildQuotesHomeVersionEmptyMessage(home.selectedJob, workflow.versions.items),
>>>>>>> Stashed changes
      items: versionItems,
      hasMore: workflow.versions.hasMore,
      loadingMore: workflow.versions.loadingMore,
    },
    createVm: {
<<<<<<< Updated upstream
      creating: createController.creating,
      loading: dataState.loading,
      selectedJobName: selection.selectedJob?.title ?? null,
      versionName: createController.versionName,
      versionKind: createController.versionKind,
      canCreate: Boolean(selection.selectedJob) && !createController.creating && !dataState.loading,
=======
      creating: workflow.create.creating,
      loading: home.loading,
      selectedJobName: home.selectedJob?.title ?? null,
      versionName: workflow.create.versionName,
      versionKind: workflow.create.versionKind,
      canCreate: workflow.create.canCreate,
>>>>>>> Stashed changes
    },
    deleteDialogVm: buildQuotesHomeDeleteDialogVm(
      deleteController.confirmingDelete,
      deleteController.deletingId
    ),
    actions: {
<<<<<<< Updated upstream
      setSearchQuery: selection.setSearchQuery,
      setSearchFocused: selection.setSearchFocused,
      setJobQuery: selection.setJobQuery,
      setSelectedJobId: selection.setSelectedJobId,
      setVersionName: createController.setVersionName,
      setVersionKind: createController.setVersionKind,
      createVersion: createController.createVersion,
      retrySearch: searchState.retry,
      requestDeleteVersion: (value: string | { estimate_id: string }) => {
=======
      setSearchQuery,
      setSearchFocused,
      setJobQuery: (query: string) => {
        setJobQuery(query)
        void home.setJobQuery(query)
      },
      loadMoreJobs: () => home.loadMoreJobs(),
      setSelectedJobId: home.setSelectedJobId,
      setVersionName: workflow.actions.setVersionName,
      setVersionKind: workflow.actions.setVersionKind,
      create: workflow.actions.create,
      retrySearch: searchState.retry,
      requestDelete: (value: string | { estimate_id: string }) => {
>>>>>>> Stashed changes
        const estimateId = typeof value === 'string' ? value : value.estimate_id
        const estimate = workflow.versions.items.find((item) => item.estimate_id === estimateId) ?? null
        if (estimate) {
          deleteController.requestDeleteVersion(estimate)
        }
      },
      cancelDelete: deleteController.cancelDelete,
      confirmDeleteVersion: async () => {
        const deletedId = deleteController.confirmingDelete?.estimate_id ?? null
        const deleted = await deleteController.confirmDeleteVersion()
<<<<<<< Updated upstream
        if (deletedId && deleted) {
          jobVersionsState.removeVersion(deletedId)
          await jobVersionsState.refresh()
        }
      },
      refresh: async () => {
        const [homeRefreshed] = await Promise.all([dataState.refresh(), jobVersionsState.refresh()])
        return homeRefreshed
=======
        if (!deleted || !deletedEstimate) return false

        home.setSummary((current) => ({
          ...current,
          total_versions: Math.max(0, current.total_versions - 1),
          draft_count:
            deletedEstimate.version_state === 'draft'
              ? Math.max(0, current.draft_count - 1)
              : current.draft_count,
          sent_or_awaiting_count: deletedEstimate.is_sent_estimate
            ? Math.max(0, current.sent_or_awaiting_count - 1)
            : current.sent_or_awaiting_count,
          live_count:
            deletedEstimate.version_state === 'live'
              ? Math.max(0, current.live_count - 1)
              : current.live_count,
          pipeline_total: Math.max(0, current.pipeline_total - (deletedEstimate.final_total ?? 0)),
        }))
        home.setJobsPage((current) => ({
          ...current,
          items: current.items.map((job) =>
            job.id === deletedEstimate.job_id
              ? { ...job, version_count: Math.max(0, job.version_count - 1) }
              : job
          ),
        }))
        workflow.versions.removeVersion(deletedEstimate.estimate_id)

        await Promise.all([
          home.attemptRefresh({ preserveDataOnError: true, reportError: false }),
          workflow.versions.attemptRefresh({ preserveDataOnError: true, reportError: false }),
        ])
        return true
      },
      refresh: async () => {
        await Promise.all([home.refresh(), workflow.actions.refreshVersions()])
>>>>>>> Stashed changes
      },
      loadMoreVersions: workflow.actions.loadMoreVersions,
    },
  }
}
