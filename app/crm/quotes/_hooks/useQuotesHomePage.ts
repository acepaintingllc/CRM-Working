'use client'

import { useEffect, useMemo, useState } from 'react'
import type { QuoteHomeBootstrapReadModel } from '@/lib/quotes/collectionData'
import {
  buildQuoteHomePageVm,
  type QuoteHomePageActions,
  type QuoteHomePageVm,
} from '../_home/quoteHomePageVm'
import { useQuoteHomePageController } from './quoteHomePageController'
import { useQuotesHomeData } from './useQuotesHomeData'
import { useQuotesHomeDelete } from './useQuotesHomeDelete'
import { useQuotesHomeSearch } from './useQuotesHomeSearch'
import { useQuoteVersionWorkflow } from './useQuoteVersionWorkflow'
import { resolveQuoteHomeSelectedJobId } from './quoteHomePagePolicy'

export function useQuotesHomePage(
  initialData?: QuoteHomeBootstrapReadModel | null
): QuoteHomePageVm {
  const initialJobQuery = initialData?.jobs.query ?? ''
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [jobQuery, setJobQuery] = useState(initialJobQuery)
  const homeResource = useQuotesHomeData(initialData, { jobQuery })
  const [selectedJobId, setSelectedJobId] = useState(
    () => resolveQuoteHomeSelectedJobId(homeResource.jobs, homeResource.initialSelectedJobId ?? '')
  )
  const searchState = useQuotesHomeSearch(searchQuery)
  const selectedJob = homeResource.jobs.find((job) => job.id === selectedJobId) ?? null
  const workflow = useQuoteVersionWorkflow({
    jobId: selectedJobId,
    selectedJob,
    loading: homeResource.loading,
    onRefresh: homeResource.refresh,
    initialVersions:
      homeResource.initialSelectedJobVersions?.job_id === selectedJobId
        ? homeResource.initialSelectedJobVersions
        : null,
  })
  const deleteController = useQuotesHomeDelete()
  const controller = useQuoteHomePageController({
    homeResource,
    versions: workflow.versions,
    deleteController,
  })

  useEffect(() => {
    const nextSelectedJobId = resolveQuoteHomeSelectedJobId(homeResource.jobs, selectedJobId)
    if (nextSelectedJobId !== selectedJobId) {
      setSelectedJobId(nextSelectedJobId)
    }
  }, [homeResource.jobs, selectedJobId])

  const actions: QuoteHomePageActions = useMemo(
    () => ({
      setSearchQuery,
      setSearchFocused,
      setJobQuery,
      setSelectedJobId,
      loadMore: homeResource.loadMore,
      setVersionName: workflow.actions.setVersionName,
      setVersionKind: workflow.actions.setVersionKind,
      create: workflow.actions.create,
      loadMoreVersions: workflow.actions.loadMoreVersions,
      retrySearch: searchState.retry,
      requestDelete: controller.actions.requestDelete,
      cancelDelete: controller.actions.cancelDelete,
      confirmDelete: controller.actions.confirmDelete,
      refresh: controller.actions.refresh,
    }),
    // setState functions (setSearchQuery etc.) are stable by React guarantee, excluded from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      homeResource.loadMore,
      workflow.actions.setVersionName,
      workflow.actions.setVersionKind,
      workflow.actions.create,
      workflow.actions.loadMoreVersions,
      searchState.retry,
      controller.actions.requestDelete,
      controller.actions.cancelDelete,
      controller.actions.confirmDelete,
      controller.actions.refresh,
    ]
  )

  return useMemo(
    () =>
      buildQuoteHomePageVm(
        {
          actionWarning: controller.actionWarning,
          searchQuery,
          searchFocused,
          jobQuery,
          selectedJobId,
          selectedJob,
          visibleJobs: homeResource.jobs,
          actions,
        },
        {
          home: {
            summary: homeResource.summary,
            jobs: homeResource.jobs,
            hasMore: homeResource.hasMore,
            jobsLoading: homeResource.jobsLoading,
            loading: homeResource.loading,
            bootstrapError: homeResource.bootstrapError,
          },
          search: {
            loading: searchState.loading,
            emptyMessage: searchState.emptyMessage,
            error: searchState.error,
            canRetry: searchState.canRetry,
            results: searchState.results,
          },
          workflow: {
            versions: {
              items: workflow.versions.items,
              error: workflow.versions.error,
              totalVersions: workflow.versions.pageData.total_versions,
              hasMore: workflow.versions.hasMore,
              loadingMore: workflow.versions.loadingMore,
              hasResolved: workflow.versions.hasResolved,
            },
            create: {
              creating: workflow.create.creating,
              error: workflow.create.error,
              versionName: workflow.create.versionName,
              versionKind: workflow.create.versionKind,
              canCreate: workflow.create.canCreate,
            },
          },
          delete: {
            confirmingDelete: deleteController.confirmingDelete,
            deletingId: deleteController.deletingId,
            error: deleteController.error,
          },
        }
      ),
    [
      controller.actionWarning,
      searchQuery,
      searchFocused,
      jobQuery,
      selectedJobId,
      selectedJob,
      homeResource.jobs,
      actions,
      homeResource.summary,
      homeResource.hasMore,
      homeResource.jobsLoading,
      homeResource.loading,
      homeResource.bootstrapError,
      searchState.loading,
      searchState.emptyMessage,
      searchState.error,
      searchState.canRetry,
      searchState.results,
      workflow.versions.items,
      workflow.versions.error,
      workflow.versions.pageData.total_versions,
      workflow.versions.hasMore,
      workflow.versions.loadingMore,
      workflow.versions.hasResolved,
      workflow.create.creating,
      workflow.create.error,
      workflow.create.versionName,
      workflow.create.versionKind,
      workflow.create.canCreate,
      deleteController.confirmingDelete,
      deleteController.deletingId,
      deleteController.error,
    ]
  )
}
