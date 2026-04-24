'use client'

import { useCallback, useMemo } from 'react'
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
import { useQuoteHomePageState } from './useQuoteHomePageState'

export function useQuotesHomePage(
  initialData?: QuoteHomeBootstrapReadModel | null
): QuoteHomePageVm {
  const pageState = useQuoteHomePageState(
    initialData?.jobs.items ?? [],
    initialData?.selected_job_id ?? ''
  )
  const { jobQuery } = pageState
  const homeResource = useQuotesHomeData(initialData, {
    jobQuery,
    onJobsChange: pageState.setJobsForSelection,
  })
  const {
    searchQuery,
    searchFocused,
    selectedJobId,
    actions: stateActions,
  } = pageState
  const searchState = useQuotesHomeSearch(searchQuery)
  const selectedJob = useMemo(
    () => homeResource.jobs.find((job) => job.id === selectedJobId) ?? null,
    [homeResource.jobs, selectedJobId]
  )
  const { attemptRefresh: attemptRefreshHome } = homeResource
  const refreshHomeContext = useCallback(async () => {
    const result = await attemptRefreshHome()
    return result.ok
  }, [attemptRefreshHome])
  const workflow = useQuoteVersionWorkflow({
    jobId: selectedJobId,
    selectedJob,
    loading: homeResource.loading,
    onRefresh: refreshHomeContext,
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

  const actions: QuoteHomePageActions = useMemo(
    () => ({
      ...stateActions,
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
    [
      stateActions,
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

  const homeVmResource = useMemo(
    () => ({
      summary: homeResource.summary,
      jobs: homeResource.jobs,
      hasMore: homeResource.hasMore,
      jobsLoading: homeResource.jobsLoading,
      loading: homeResource.loading,
      bootstrapError: homeResource.bootstrapError,
    }),
    [
      homeResource.summary,
      homeResource.jobs,
      homeResource.hasMore,
      homeResource.jobsLoading,
      homeResource.loading,
      homeResource.bootstrapError,
    ]
  )
  const searchVmResource = useMemo(
    () => ({
      loading: searchState.loading,
      emptyMessage: searchState.emptyMessage,
      error: searchState.error,
      canRetry: searchState.canRetry,
      results: searchState.results,
    }),
    [
      searchState.loading,
      searchState.emptyMessage,
      searchState.error,
      searchState.canRetry,
      searchState.results,
    ]
  )
  const workflowVmResource = useMemo(
    () => ({
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
    }),
    [
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
    ]
  )
  const deleteVmResource = useMemo(
    () => ({
      confirmingDelete: deleteController.confirmingDelete,
      deletingId: deleteController.deletingId,
      error: deleteController.error,
    }),
    [deleteController.confirmingDelete, deleteController.deletingId, deleteController.error]
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
          home: homeVmResource,
          search: searchVmResource,
          workflow: workflowVmResource,
          delete: deleteVmResource,
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
      homeVmResource,
      searchVmResource,
      workflowVmResource,
      deleteVmResource,
    ]
  )
}
