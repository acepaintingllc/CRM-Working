'use client'

import { useQuoteVersionCreation } from './useQuoteVersionCreation'
import { useQuotesHomeData } from './useQuotesHomeData'
import { useQuotesHomeDelete } from './useQuotesHomeDelete'
import { useQuotesHomeSelection } from './useQuotesHomeSelection'
import {
  buildHeroSummaryText,
  buildQuoteHomeJobListItemVm,
  buildQuoteHomeVersionItemVm,
  buildQuotesHomeDeleteDialogVm,
  buildQuotesHomeSelectedJobVm,
  buildQuotesHomeVersionEmptyMessage,
  buildQuotesHomeVersionHeading,
  buildSearchResultVm,
  buildSummaryCards,
} from '../_home/quoteHomePresentation'
import type { QuotesHomeJobListVm } from '../_home/quoteHomeTypes'

const EMPTY_SUMMARY = {
  draft_count: 0,
  sent_or_awaiting_count: 0,
  live_count: 0,
  pipeline_total: 0,
}

export function useQuotesHomePage() {
  const dataState = useQuotesHomeData()
  const selection = useQuotesHomeSelection({
    data: dataState.data,
    jobs: dataState.jobs,
  })
  const createController = useQuoteVersionCreation(selection.selectedJob)
  const deleteController = useQuotesHomeDelete({
    refresh: dataState.refresh,
    setError: dataState.setError,
  })

  const summaryCards = buildSummaryCards(dataState.data)
  const jobListItems = selection.filteredJobs.map((job) =>
    buildQuoteHomeJobListItemVm(job, selection.versionCountByJob[job.id] ?? 0, {
      selectedJobId: selection.selectedJobId,
    })
  )
  const mobileItems = dataState.jobs
    .slice(0, 10)
    .map((job) => buildQuoteHomeJobListItemVm(job, selection.versionCountByJob[job.id] ?? 0, { mobile: true }))
  const versionItems = selection.selectedJobVersions.map((estimate) =>
    buildQuoteHomeVersionItemVm(estimate, deleteController.deletingId)
  )

  return {
    feedbackVm: {
      loading: dataState.loading,
      error: dataState.error ?? createController.error,
      hasData: Boolean(dataState.data),
      summary: dataState.data?.summary ?? EMPTY_SUMMARY,
    },
    headerVm: {
      heroSummaryText: buildHeroSummaryText(dataState.data),
      searchQuery: selection.searchQuery,
      searchFocused: selection.searchFocused,
      searchResults: selection.searchResults.map(buildSearchResultVm),
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
      selection.versionCountByJob[selection.selectedJobId] ??
        selection.selectedJobVersions.length,
      dataState.loading
    ),
    versionListVm: {
      heading: buildQuotesHomeVersionHeading(selection.selectedJob, selection.selectedJobVersions),
      emptyMessage: buildQuotesHomeVersionEmptyMessage(selection.selectedJob, selection.selectedJobVersions),
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
      requestDeleteVersion: (value: string | { estimate_id: string }) => {
        const estimateId = typeof value === 'string' ? value : value.estimate_id
        const estimate =
          dataState.data?.search_estimates.find((entry) => entry.estimate_id === estimateId) ?? null
        if (estimate) {
          deleteController.requestDeleteVersion(estimate)
        }
      },
      cancelDelete: deleteController.cancelDelete,
      confirmDeleteVersion: deleteController.confirmDeleteVersion,
      refresh: dataState.refresh,
    },
  }
}
