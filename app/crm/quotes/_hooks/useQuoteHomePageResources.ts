'use client'

import { useEffect, useMemo } from 'react'
import type { QuoteHomeBootstrapReadModel } from '@/lib/quotes/collectionData'
import type {
  QuoteHomePageActions,
  QuoteHomePageVmResources,
  QuoteHomePageVmState,
} from '../_home/quoteHomePageVm'
import { useQuoteHomePageController } from './quoteHomePageController'
import { buildQuoteHomePageVmResources } from './quoteHomePageVmResources'
import { useQuoteHomePageState } from './useQuoteHomePageState'
import { useQuoteVersionWorkflow } from './useQuoteVersionWorkflow'
import { useQuotesHomeData } from './useQuotesHomeData'
import { useQuotesHomeDelete } from './useQuotesHomeDelete'
import { useQuotesHomeSearch } from './useQuotesHomeSearch'

type QuoteHomeStateActions = Pick<
  QuoteHomePageActions,
  'setSearchQuery' | 'setSearchFocused' | 'setJobQuery' | 'setSelectedJobId'
>

type QuoteHomeWorkflowActions = Pick<
  QuoteHomePageActions,
  | 'setVersionName'
  | 'setVersionKind'
  | 'create'
  | 'loadMoreVersions'
  | 'retryVersions'
>

type QuoteHomePageResources = {
  vmState: QuoteHomePageVmState
  vmResources: QuoteHomePageVmResources
}

export function useQuoteHomePageResources(
  initialData?: QuoteHomeBootstrapReadModel | null
): QuoteHomePageResources {
  const pageState = useQuoteHomePageState(
    initialData?.jobs.items ?? [],
    initialData?.selected_job_id ?? ''
  )

  const homeResource = useQuotesHomeData(initialData, {
    jobQuery: pageState.jobQuery,
  })

  const searchState = useQuotesHomeSearch(pageState.searchQuery)
  const initialVersionsForSelectedJob =
    homeResource.initialSelectedJobVersions?.job_id === pageState.selectedJobId
      ? homeResource.initialSelectedJobVersions
      : null

  const workflow = useQuoteVersionWorkflow({
    jobId: pageState.selectedJobId,
    selectedJob: pageState.selectedJob,
    loading: homeResource.loading,
    initialVersions: initialVersionsForSelectedJob,
  })

  const deleteController = useQuotesHomeDelete()
  const { reconcileLoadedJobs } = pageState

  useEffect(() => {
    reconcileLoadedJobs(homeResource.jobs, homeResource.jobsPage.query, {
      preferredSelectedJobId: homeResource.initialSelectedJobId,
    })
  }, [
    homeResource.initialSelectedJobId,
    homeResource.jobs,
    homeResource.jobsPage.query,
    reconcileLoadedJobs,
  ])

  const stateActions = useMemo<QuoteHomeStateActions>(
    () => ({
      setSearchQuery: pageState.actions.setSearchQuery,
      setSearchFocused: pageState.actions.setSearchFocused,
      setJobQuery: pageState.actions.setJobQuery,
      setSelectedJobId: pageState.actions.setSelectedJobId,
    }),
    [
      pageState.actions.setSearchQuery,
      pageState.actions.setSearchFocused,
      pageState.actions.setJobQuery,
      pageState.actions.setSelectedJobId,
    ]
  )

  const workflowActions = useMemo<QuoteHomeWorkflowActions>(
    () => ({
      setVersionName: workflow.actions.setVersionName,
      setVersionKind: workflow.actions.setVersionKind,
      create: workflow.actions.create,
      loadMoreVersions: workflow.actions.loadMoreVersions,
      retryVersions: workflow.actions.refreshVersions,
    }),
    [
      workflow.actions.setVersionName,
      workflow.actions.setVersionKind,
      workflow.actions.create,
      workflow.actions.loadMoreVersions,
      workflow.actions.refreshVersions,
    ]
  )

  const controller = useQuoteHomePageController({
    homeResource,
    versions: workflow.versions,
    deleteController,
    stateActions,
    loadMoreJobs: homeResource.loadMore,
    workflowActions,
    retrySearch: searchState.retry,
  })
  const { confirmingDelete, deletingId, error: deleteError } = controller.deleteState

  const vmState = useMemo<QuoteHomePageVmState>(
    () => ({
      actionWarning: controller.actionWarning,
      searchQuery: pageState.searchQuery,
      searchFocused: pageState.searchFocused,
      jobQuery: pageState.jobQuery,
      selectedJobId: pageState.selectedJobId,
      selectedJob: pageState.selectedJob,
      visibleJobs: homeResource.jobs,
      actions: controller.actions,
    }),
    [
      controller.actionWarning,
      controller.actions,
      homeResource.jobs,
      pageState.jobQuery,
      pageState.searchFocused,
      pageState.searchQuery,
      pageState.selectedJob,
      pageState.selectedJobId,
    ]
  )

  const vmResources = useMemo(
    () =>
      buildQuoteHomePageVmResources({
        home: {
          summary: homeResource.summary,
          jobs: homeResource.jobs,
          hasMore: homeResource.hasMore,
          jobsLoading: homeResource.jobsLoading,
          loading: homeResource.loading,
          bootstrapError: homeResource.bootstrapError,
          jobsError: homeResource.jobsError,
        },
        search: {
          query: searchState.query,
          loading: searchState.loading,
          error: searchState.error,
          results: searchState.results,
        },
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
        delete: {
          confirmingDelete,
          deletingId,
          error: deleteError,
        },
      }),
    [
      confirmingDelete,
      deleteError,
      deletingId,
      homeResource.bootstrapError,
      homeResource.hasMore,
      homeResource.jobs,
      homeResource.jobsError,
      homeResource.jobsLoading,
      homeResource.loading,
      homeResource.summary,
      searchState.error,
      searchState.loading,
      searchState.query,
      searchState.results,
      workflow.create.canCreate,
      workflow.create.creating,
      workflow.create.error,
      workflow.create.versionKind,
      workflow.create.versionName,
      workflow.versions.error,
      workflow.versions.hasMore,
      workflow.versions.hasResolved,
      workflow.versions.items,
      workflow.versions.loadingMore,
      workflow.versions.pageData.total_versions,
    ]
  )

  return {
    vmState,
    vmResources,
  }
}
