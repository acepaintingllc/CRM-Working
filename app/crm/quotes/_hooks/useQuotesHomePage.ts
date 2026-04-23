'use client'

import { useEffect, useState } from 'react'
import type { QuoteHomeBootstrapReadModel } from '@/lib/quotes/collectionData'
import { useQuotesHomeData } from './useQuotesHomeData'
import { useQuotesHomeDelete } from './useQuotesHomeDelete'
import { useQuoteVersionWorkflow } from './useQuoteVersionWorkflow'
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
  })
  const resolvedFeedbackVm = feedbackVm ?? {
    tone: 'warning' as const,
    title: null,
    details: [],
    sources: [],
  }

  return {
    headerVm: {
      heroSummaryText: buildHeroSummaryText(home.summary),
      searchQuery,
      searchFocused,
      searchLoading: searchState.loading,
      searchEmptyMessage: searchState.emptyMessage,
      searchErrorMessage: searchState.error,
      searchCanRetry: searchState.canRetry,
      searchResults: searchState.results.map(buildSearchResultVm),
    },
    feedbackVm: {
      loading: home.loading,
      ...resolvedFeedbackVm,
    },
    summaryCards,
    mobileVm: {
      summaryCards: [summaryCards[0], summaryCards[3]].filter(Boolean),
    },
    jobListVm: {
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
      items: versionItems,
      hasMore: workflow.versions.hasMore,
      loadingMore: workflow.versions.loadingMore,
    },
    createVm: {
      creating: workflow.create.creating,
      loading: home.loading,
      selectedJobName: home.selectedJob?.title ?? null,
      versionName: workflow.create.versionName,
      versionKind: workflow.create.versionKind,
      canCreate: workflow.create.canCreate,
    },
    deleteDialogVm: buildQuotesHomeDeleteDialogVm(
      deleteController.confirmingDelete,
      deleteController.deletingId
    ),
    actions: {
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
      createVersion: workflow.actions.create,
      retrySearch: searchState.retry,
      requestDelete: (value: string | { estimate_id: string }) => {
        const estimateId = typeof value === 'string' ? value : value.estimate_id
        const estimate = workflow.versions.items.find((item) => item.estimate_id === estimateId) ?? null
        if (estimate) {
          deleteController.requestDeleteVersion(estimate)
        }
      },
      cancelDelete: deleteController.cancelDelete,
      confirmDeleteVersion: async () => {
        const deletedEstimate = deleteController.confirmingDelete
        const deleted = await deleteController.confirmDeleteVersion()
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
      },
      loadMoreVersions: workflow.actions.loadMoreVersions,
      confirmDelete: deleteController.confirmDeleteVersion,
    },
    header: {
      heroSummaryText: buildHeroSummaryText(home.summary),
      searchQuery,
      searchFocused,
      searchLoading: searchState.loading,
      searchEmptyMessage: searchState.emptyMessage,
      searchErrorMessage: searchState.error,
      searchCanRetry: searchState.canRetry,
      searchResults: searchState.results.map(buildSearchResultVm),
    },
    feedback: {
      loading: home.loading,
      ...resolvedFeedbackVm,
    },
    jobList: {
      loading: home.loading,
      loadingMore: home.jobsLoadingMore,
      searchQuery: jobQuery,
      selectedJobId: home.selectedJobId,
      items: jobListItems,
      mobileItems,
      emptyState: home.jobs.length === 0 ? (jobQuery ? 'no_matches' : 'no_jobs') : 'none',
      hasMore: home.hasMoreJobs,
    },
    selectedJob: buildQuotesHomeSelectedJobVm(
      home.selectedJob,
      workflow.versions.data.total_versions,
      home.loading
    ),
    versionList: {
      heading: buildQuotesHomeVersionHeading(home.selectedJob, workflow.versions.items),
      emptyMessage: buildQuotesHomeVersionEmptyMessage(home.selectedJob, workflow.versions.items),
      items: versionItems,
      hasMore: workflow.versions.hasMore,
      loadingMore: workflow.versions.loadingMore,
    },
    create: {
      creating: workflow.create.creating,
      loading: home.loading,
      selectedJobName: home.selectedJob?.title ?? null,
      versionName: workflow.create.versionName,
      versionKind: workflow.create.versionKind,
      canCreate: workflow.create.canCreate,
    },
    mobileSummaryCards: [summaryCards[0], summaryCards[3]].filter(Boolean),
    dialogs: {
      delete: buildQuotesHomeDeleteDialogVm(
        deleteController.confirmingDelete,
        deleteController.deletingId
      ),
    },
  }
}
