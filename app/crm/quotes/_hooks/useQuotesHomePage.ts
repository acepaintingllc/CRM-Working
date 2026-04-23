'use client'

import { useEffect, useMemo, useState } from 'react'
import type { QuoteHomeBootstrapReadModel } from '@/lib/quotes/collectionData'
import { useQuoteJobVersions } from './useQuoteJobVersions'
import { useQuoteVersionCreation } from './useQuoteVersionCreation'
import { useQuotesHomeData } from './useQuotesHomeData'
import { useQuotesHomeDelete } from './useQuotesHomeDelete'
import { useQuotesHomeSearch } from './useQuotesHomeSearch'
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

export function useQuotesHomePage(initialData?: QuoteHomeBootstrapReadModel | null) {
  const homeResource = useQuotesHomeData(initialData)
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
  const jobVersionsState = useQuoteJobVersions(selectedJobId)
  const createController = useQuoteVersionCreation(selectedJob)
  const deleteController = useQuotesHomeDelete()
  const { setError, setVersionKind, setVersionName } = createController

  useEffect(() => {
    const nextSelectedJobId = resolveQuoteHomeSelectedJobId(homeResource.jobs, selectedJobId)
    if (nextSelectedJobId !== selectedJobId) {
      setSelectedJobId(nextSelectedJobId)
    }
  }, [homeResource.jobs, selectedJobId])

  useEffect(() => {
    setVersionName('')
    setVersionKind('standard')
    setError(null)
  }, [selectedJob?.id, setError, setVersionKind, setVersionName])

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
  const versionItems = jobVersionsState.items.map((estimate) =>
    buildQuoteHomeVersionItemVm(estimate, deleteController.deletingId)
  )
  const feedbackVm = buildQuotesHomeFeedbackVm({
    homeFailures: homeResource.bootstrapError
      ? [{ source: 'bootstrap', message: homeResource.bootstrapError }]
      : [],
    jobVersionsError: jobVersionsState.error,
    createError: createController.error,
    deleteError: deleteController.error,
  })
  const resolvedFeedbackVm = feedbackVm ?? {
    tone: 'warning' as const,
    title: '',
    details: [],
    sources: [],
  }
  const versionCount =
    homeResource.versionCountByJob[selectedJobId] ?? jobVersionsState.data.total_versions
  const deleteTargetsById = useMemo(() => {
    return new Map(jobVersionsState.items.map((item) => [item.estimate_id, item]))
  }, [jobVersionsState.items])

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
      heading: buildQuotesHomeVersionHeading(selectedJob, jobVersionsState.items),
      emptyMessage: buildQuotesHomeVersionEmptyMessage(selectedJob, jobVersionsState.items),
      items: versionItems,
    },
    createVm: {
      creating: createController.creating,
      loading: homeResource.loading,
      selectedJobName: selectedJob?.title ?? null,
      versionName: createController.versionName,
      versionKind: createController.versionKind,
      canCreate: Boolean(selectedJob) && !createController.creating && !homeResource.loading,
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
      setVersionName: createController.setVersionName,
      setVersionKind: createController.setVersionKind,
      create: createController.createVersion,
      retrySearch: searchState.retry,
      requestDelete: (value: string | { estimate_id: string }) => {
        const estimateId = typeof value === 'string' ? value : value.estimate_id
        const estimate = deleteTargetsById.get(estimateId) ?? null
        if (estimate) {
          deleteController.requestDeleteVersion(estimate)
        }
      },
      cancelDelete: deleteController.cancelDelete,
      confirmDelete: async () => {
        const deleted = await deleteController.confirmDeleteVersion()
        if (deleted) {
          const [bootstrap] = await Promise.all([homeResource.refresh(), jobVersionsState.refresh()])
          return Boolean(bootstrap)
        }
        return false
      },
      refresh: async () => {
        const [bootstrap] = await Promise.all([homeResource.refresh(), jobVersionsState.refresh()])
        return Boolean(bootstrap)
      },
    },
  }
}
