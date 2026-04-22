'use client'

import { useQuoteVersionCreation } from './useQuoteVersionCreation'
import { useQuotesHomeData } from './useQuotesHomeData'
import { useQuotesHomeDelete } from './useQuotesHomeDelete'
import { useQuotesHomeSelection } from './useQuotesHomeSelection'

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
    setData: dataState.setData,
    setError: dataState.setError,
  })

  return {
    feedbackVm: {
      loading: dataState.loading,
      error: dataState.error ?? createController.error,
      hasData: Boolean(dataState.data),
      summary: dataState.data?.summary ?? EMPTY_SUMMARY,
    },
    headerVm: {
      searchQuery: selection.searchQuery,
      searchFocused: selection.searchFocused,
      searchResults: selection.searchResults,
      heroSummaryText: selection.heroSummaryText,
    },
    summaryCards: selection.summaryCards,
    mobileVm: {
      summaryCards: selection.mobileSummaryCards,
      jobs: dataState.jobs.slice(0, 10),
    },
    jobListVm: {
      loading: dataState.loading,
      jobs: dataState.jobs,
      filteredJobs: selection.filteredJobs,
      jobQuery: selection.jobQuery,
      selectedJobId: selection.selectedJobId,
      versionCountByJob: selection.versionCountByJob,
    },
    selectedJobVm: {
      loading: dataState.loading,
      selectedJob: selection.selectedJob,
      selectedJobVersionsCount: selection.selectedJobVersions.length,
    },
    versionListVm: {
      selectedJob: selection.selectedJob,
      versions: selection.selectedJobVersions,
      deletingId: deleteController.deletingId,
    },
    createVm: {
      loading: dataState.loading,
      creating: createController.creating,
      selectedJob: selection.selectedJob,
      versionName: createController.versionName,
      versionKind: createController.versionKind,
    },
    deleteDialogVm: {
      estimate: deleteController.confirmingDelete,
      deletingId: deleteController.deletingId,
    },
    actions: {
      setSearchQuery: selection.setSearchQuery,
      setSearchFocused: selection.setSearchFocused,
      setJobQuery: selection.setJobQuery,
      setSelectedJobId: selection.setSelectedJobId,
      setVersionName: createController.setVersionName,
      setVersionKind: createController.setVersionKind,
      createVersion: createController.createVersion,
      requestDeleteVersion: deleteController.requestDeleteVersion,
      cancelDelete: deleteController.cancelDelete,
      confirmDeleteVersion: deleteController.confirmDeleteVersion,
    },
  }
}
