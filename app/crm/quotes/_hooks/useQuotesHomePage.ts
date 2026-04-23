'use client'

import { useMemo, useState } from 'react'
import { useQuoteJobVersions } from './useQuoteJobVersions'
import { useQuoteVersionCreation } from './useQuoteVersionCreation'
import { useQuotesHomeData } from './useQuotesHomeData'
import { useQuotesHomeDelete } from './useQuotesHomeDelete'
import { useQuotesHomeSelection } from './useQuotesHomeSelection'
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

export function useQuotesHomePage() {
  const dataState = useQuotesHomeData()
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
  })
  const resolvedFeedbackVm = feedbackVm ?? {
    tone: 'warning' as const,
    title: null,
    details: [],
    sources: [],
  }
  const versionCount = selection.versionCountByJob[selection.selectedJobId] ?? jobVersionsState.data.total_versions
  const deleteTargetsById = useMemo(() => {
    return new Map(jobVersionsState.items.map((item) => [item.estimate_id, item]))
  }, [jobVersionsState.items])

  return {
    feedbackVm: {
      loading: dataState.loading,
      ...resolvedFeedbackVm,
      hasData: true,
      summary: dataState.summary,
    },
    headerVm: {
      heroSummaryText: buildHeroSummaryText(dataState.summary),
      searchQuery: selection.searchQuery,
      searchFocused: selection.searchFocused,
      searchLoading: searchState.loading,
      searchEmptyMessage: searchState.emptyMessage,
      searchErrorMessage: searchState.error,
      searchCanRetry: searchState.canRetry,
      searchResults: searchState.results.map(buildSearchResultVm),
    },
    summaryCards,
    mobileVm: {
      summaryCards: [summaryCards[0], summaryCards[3]].filter(Boolean),
    },
    jobListVm: {
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
      items: versionItems,
    },
    createVm: {
      creating: createController.creating,
      loading: dataState.loading,
      selectedJobName: selection.selectedJob?.title ?? null,
      versionName: createController.versionName,
      versionKind: createController.versionKind,
      canCreate: Boolean(selection.selectedJob) && !createController.creating && !dataState.loading,
    },
    deleteDialogVm: buildQuotesHomeDeleteDialogVm(
      deleteController.confirmingDelete,
      deleteController.deletingId
    ),
    actions: {
      setSearchQuery: selection.setSearchQuery,
      setSearchFocused: selection.setSearchFocused,
      setJobQuery: selection.setJobQuery,
      setSelectedJobId: selection.setSelectedJobId,
      setVersionName: createController.setVersionName,
      setVersionKind: createController.setVersionKind,
      createVersion: createController.createVersion,
      retrySearch: searchState.retry,
      requestDeleteVersion: (value: string | { estimate_id: string }) => {
        const estimateId = typeof value === 'string' ? value : value.estimate_id
        const estimate = deleteTargetsById.get(estimateId) ?? null
        if (estimate) {
          deleteController.requestDeleteVersion(estimate)
        }
      },
      cancelDelete: deleteController.cancelDelete,
      confirmDeleteVersion: async () => {
        const deletedId = deleteController.confirmingDelete?.estimate_id ?? null
        const deleted = await deleteController.confirmDeleteVersion()
        if (deletedId && deleted) {
          jobVersionsState.removeVersion(deletedId)
          await jobVersionsState.refresh()
        }
      },
      refresh: async () => {
        const [homeRefreshed] = await Promise.all([dataState.refresh(), jobVersionsState.refresh()])
        return homeRefreshed
      },
    },
  }
}
