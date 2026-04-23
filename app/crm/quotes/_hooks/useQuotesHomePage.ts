'use client'

import { useEffect, useMemo, useState } from 'react'
import type {
  QuoteHomeBootstrapPageReadModel,
  QuoteHomeBootstrapReadModel,
} from '@/lib/quotes/collectionData'
import { useQuotesHomeData } from './useQuotesHomeData'
import { useQuotesHomeDelete } from './useQuotesHomeDelete'
import { useQuotesHomeSearch } from './useQuotesHomeSearch'
import { useQuoteVersionWorkflow } from './useQuoteVersionWorkflow'
import { filterQuoteHomeJobs, resolveQuoteHomeSelectedJobId } from './quoteHomePagePolicy'
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
import type { QuotesHomeJobListVm, QuotesHomePageSections } from '../_home/quoteHomeTypes'

export function useQuotesHomePage(
  initialData?: QuoteHomeBootstrapReadModel | QuoteHomeBootstrapPageReadModel | null
) {
  const homeResource = useQuotesHomeData(initialData)
  const [actionWarning, setActionWarning] = useState<string | null>(null)
  const [deletedEstimateIds, setDeletedEstimateIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [jobQuery, setJobQuery] = useState('')
  const [selectedJobId, setSelectedJobId] = useState('')
  const searchState = useQuotesHomeSearch(searchQuery)
  const selectedJob = homeResource.jobs.find((job) => job.id === selectedJobId) ?? null
  const filteredJobs = useMemo(
    () => filterQuoteHomeJobs(homeResource.jobs, jobQuery),
    [homeResource.jobs, jobQuery]
  )
  const workflow = useQuoteVersionWorkflow({
    jobId: selectedJobId,
    selectedJob,
    loading: homeResource.loading,
    onRefresh: homeResource.refresh,
  })
  const deleteController = useQuotesHomeDelete()

  useEffect(() => {
    const nextSelectedJobId = resolveQuoteHomeSelectedJobId(homeResource.jobs, selectedJobId)
    if (nextSelectedJobId !== selectedJobId) {
      setSelectedJobId(nextSelectedJobId)
    }
  }, [homeResource.jobs, selectedJobId])

  useEffect(() => {
    setDeletedEstimateIds([])
  }, [selectedJobId])

  const visibleVersions = useMemo(
    () =>
      workflow.versions.items.filter((estimate) => !deletedEstimateIds.includes(estimate.estimate_id)),
    [deletedEstimateIds, workflow.versions.items]
  )

  const summaryCards = buildSummaryCards(homeResource.summary)
  const jobListItems = filteredJobs.map((job) =>
    buildQuoteHomeJobListItemVm(job, homeResource.versionCountByJob[job.id] ?? 0, {
      selectedJobId,
    })
  )
  const mobileItems = homeResource.jobs
    .slice(0, 10)
    .map((job) =>
      buildQuoteHomeJobListItemVm(job, homeResource.versionCountByJob[job.id] ?? 0, {
        mobile: true,
      })
    )
  const versionItems = visibleVersions.map((estimate) =>
    buildQuoteHomeVersionItemVm(estimate, deleteController.deletingId)
  )
  const feedbackVm = buildQuotesHomeFeedbackVm({
    homeFailures: homeResource.bootstrapError
      ? [{ source: 'bootstrap', message: homeResource.bootstrapError }]
      : [],
    jobVersionsError: workflow.versions.error,
    createError: workflow.create.error,
    deleteError: deleteController.error,
    actionWarning,
  })
  const resolvedFeedbackVm = feedbackVm ?? {
    tone: 'warning' as const,
    title: '',
    details: [],
    sources: [],
  }
  const versionCount = homeResource.versionCountByJob[selectedJobId] ?? visibleVersions.length
  const deleteTargetsById = useMemo(() => {
    return new Map(visibleVersions.map((item) => [item.estimate_id, item]))
  }, [visibleVersions])

  const sections: QuotesHomePageSections = {
    headerVm: {
      heroSummaryText: buildHeroSummaryText(homeResource.summary),
      searchQuery,
      searchFocused,
      searchLoading: searchState.loading,
      searchEmptyMessage: searchState.emptyMessage,
      searchErrorMessage: searchState.error,
      searchCanRetry: searchState.canRetry,
      searchResults: searchState.results.map(buildSearchResultVm),
    },
    feedbackVm: {
      loading: homeResource.loading,
      ...resolvedFeedbackVm,
    },
    summaryCards,
    jobListVm: {
      loading: homeResource.loading,
      searchQuery: jobQuery,
      selectedJobId,
      items: jobListItems,
      mobileItems,
      emptyState:
        homeResource.jobs.length === 0
          ? 'no_jobs'
          : jobListItems.length === 0
            ? 'no_matches'
            : 'none',
    } satisfies QuotesHomeJobListVm,
    selectedJobVm: buildQuotesHomeSelectedJobVm(selectedJob, versionCount, homeResource.loading),
    versionListVm: {
      heading: buildQuotesHomeVersionHeading(selectedJob, visibleVersions),
      emptyMessage: buildQuotesHomeVersionEmptyMessage(selectedJob, visibleVersions),
      items: versionItems,
    },
    createVm: {
      creating: workflow.create.creating,
      loading: homeResource.loading,
      selectedJobName: selectedJob?.title ?? null,
      versionName: workflow.create.versionName,
      versionKind: workflow.create.versionKind,
      canCreate: workflow.create.canCreate,
    },
    mobileSummaryCards: [summaryCards[0], summaryCards[3]].filter(Boolean),
    deleteDialogVm: buildQuotesHomeDeleteDialogVm(
      deleteController.confirmingDelete,
      deleteController.deletingId
    ),
  }

  return {
    header: sections.headerVm,
    feedback: sections.feedbackVm,
    summaryCards: sections.summaryCards,
    jobList: sections.jobListVm,
    selectedJob: sections.selectedJobVm,
    versionList: sections.versionListVm,
    create: sections.createVm,
    mobileSummaryCards: sections.mobileSummaryCards,
    dialogs: {
      delete: sections.deleteDialogVm,
    },
    actions: {
      setSearchQuery,
      setSearchFocused,
      setJobQuery,
      setSelectedJobId,
      setVersionName: workflow.actions.setVersionName,
      setVersionKind: workflow.actions.setVersionKind,
      create: workflow.actions.create,
      retrySearch: searchState.retry,
      requestDelete: (value: string | { estimate_id: string }) => {
        setActionWarning(null)
        const estimateId = typeof value === 'string' ? value : value.estimate_id
        const estimate = deleteTargetsById.get(estimateId) ?? null
        if (estimate) {
          deleteController.requestDeleteVersion(estimate)
        }
      },
      cancelDelete: deleteController.cancelDelete,
      confirmDelete: async () => {
        const deletedEstimate = deleteController.confirmingDelete
        const deleted = await deleteController.confirmDeleteVersion()
        if (!deleted || !deletedEstimate) {
          return false
        }

        setActionWarning(null)
        homeResource.applyDeletedVersion(deletedEstimate)
        setDeletedEstimateIds((current) =>
          current.includes(deletedEstimate.estimate_id)
            ? current
            : [...current, deletedEstimate.estimate_id]
        )
        workflow.versions.removeVersion(deletedEstimate.estimate_id)

        const [bootstrapRefresh, versionsRefresh] = await Promise.all([
          homeResource.attemptRefresh({
            preserveDataOnError: true,
            reportError: false,
          }),
          workflow.versions.attemptRefresh({
            preserveDataOnError: true,
            reportError: false,
          }),
        ])

        if (bootstrapRefresh.ok && versionsRefresh.ok) {
          setDeletedEstimateIds([])
          return true
        }

        const refreshFailures: string[] = []
        if (!bootstrapRefresh.ok && bootstrapRefresh.error) {
          refreshFailures.push(`Home refresh failed. ${bootstrapRefresh.error}`)
        }
        if (!versionsRefresh.ok && versionsRefresh.error) {
          refreshFailures.push(`Versions refresh failed. ${versionsRefresh.error}`)
        }

        setActionWarning(
          `Quote deleted, but follow-up refresh failed. Showing locally reconciled data. ${refreshFailures.join(' ')}`
        )
        return true
      },
      refresh: async () => {
        setActionWarning(null)
        setDeletedEstimateIds([])
        return workflow.actions.refresh()
      },
    },
  }
}
