'use client'

import { useMemo, useState } from 'react'
import type { QuoteHomeBootstrapReadModel } from '@/lib/quotes/collectionData'
import { useQuoteJobVersions } from './useQuoteJobVersions'
import { useQuoteVersionCreation } from './useQuoteVersionCreation'
import { useQuotesHomeData } from './useQuotesHomeData'
import { useQuotesHomeDelete } from './useQuotesHomeDelete'
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
import type { QuotesHomeJobListVm, QuotesHomePageSections } from '../_home/quoteHomeTypes'

export function useQuotesHomePage(initialData?: QuoteHomeBootstrapReadModel | null) {
  const homeResource = useQuotesHomeData(initialData)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const searchState = useQuotesHomeSearch(searchQuery)
  const jobVersionsState = useQuoteJobVersions(homeResource.selectedJobId)
  const createController = useQuoteVersionCreation(homeResource.selectedJob)
  const deleteController = useQuotesHomeDelete()

  const summaryCards = buildSummaryCards(homeResource.summary)
  const jobListItems = homeResource.filteredJobs.map((job) =>
    buildQuoteHomeJobListItemVm(job, homeResource.versionCountByJob[job.id] ?? 0, {
      selectedJobId: homeResource.selectedJobId,
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
    homeResource.versionCountByJob[homeResource.selectedJobId] ?? jobVersionsState.data.total_versions
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
      searchQuery: homeResource.jobQuery,
      selectedJobId: homeResource.selectedJobId,
      items: jobListItems,
      mobileItems,
      emptyState:
        homeResource.jobs.length === 0
          ? 'no_jobs'
          : jobListItems.length === 0
            ? 'no_matches'
            : 'none',
    } satisfies QuotesHomeJobListVm,
    selectedJobVm: buildQuotesHomeSelectedJobVm(
      homeResource.selectedJob,
      versionCount,
      homeResource.loading
    ),
    versionListVm: {
      heading: buildQuotesHomeVersionHeading(homeResource.selectedJob, jobVersionsState.items),
      emptyMessage: buildQuotesHomeVersionEmptyMessage(homeResource.selectedJob, jobVersionsState.items),
      items: versionItems,
    },
    createVm: {
      creating: createController.creating,
      loading: homeResource.loading,
      selectedJobName: homeResource.selectedJob?.title ?? null,
      versionName: createController.versionName,
      versionKind: createController.versionKind,
      canCreate: Boolean(homeResource.selectedJob) && !createController.creating && !homeResource.loading,
    },
    mobileSummaryCards: [summaryCards[0], summaryCards[3]].filter(Boolean),
    deleteDialogVm: buildQuotesHomeDeleteDialogVm(
      deleteController.confirmingDelete,
      deleteController.deletingId
    ),
  }

  return {
    sections,
    actions: {
      setSearchQuery,
      setSearchFocused,
      setJobQuery: homeResource.setJobQuery,
      setSelectedJobId: homeResource.setSelectedJobId,
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
          const [homeRefreshed] = await Promise.all([
            homeResource.refresh(),
            jobVersionsState.refresh(),
          ])
          return homeRefreshed
        }
        return false
      },
      refresh: async () => {
        const [homeRefreshed] = await Promise.all([homeResource.refresh(), jobVersionsState.refresh()])
        return homeRefreshed
      },
    },
  }
}
