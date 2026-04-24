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
  const interactionState = useQuoteHomePageState(
    initialData?.jobs.items ?? [],
    initialData?.selected_job_id ?? ''
  )

  const homeData = useQuotesHomeData(initialData, {
    jobQuery: interactionState.jobQuery,
  })

  const searchResource = useQuotesHomeSearch(interactionState.searchQuery)
  const selectedJobBootstrapVersions =
    homeData.initialSelectedJobVersions?.job_id === interactionState.selectedJobId
      ? homeData.initialSelectedJobVersions
      : null

  const versionWorkflow = useQuoteVersionWorkflow({
    jobId: interactionState.selectedJobId,
    selectedJob: interactionState.selectedJob,
    loading: homeData.loading,
    initialVersions: selectedJobBootstrapVersions,
  })

  const { reconcileLoadedJobs } = interactionState

  useEffect(() => {
    reconcileLoadedJobs(homeData.jobs, homeData.jobsPage.query, {
      preferredSelectedJobId: homeData.initialSelectedJobId,
    })
  }, [
    homeData.initialSelectedJobId,
    homeData.jobs,
    homeData.jobsPage.query,
    reconcileLoadedJobs,
  ])

  const stateActions = useMemo<QuoteHomeStateActions>(
    () => ({
      setSearchQuery: interactionState.actions.setSearchQuery,
      setSearchFocused: interactionState.actions.setSearchFocused,
      setJobQuery: interactionState.actions.setJobQuery,
      setSelectedJobId: interactionState.actions.setSelectedJobId,
    }),
    [
      interactionState.actions.setSearchQuery,
      interactionState.actions.setSearchFocused,
      interactionState.actions.setJobQuery,
      interactionState.actions.setSelectedJobId,
    ]
  )

  const workflowActions = useMemo<QuoteHomeWorkflowActions>(
    () => ({
      setVersionName: versionWorkflow.actions.setVersionName,
      setVersionKind: versionWorkflow.actions.setVersionKind,
      create: versionWorkflow.actions.create,
      loadMoreVersions: versionWorkflow.actions.loadMoreVersions,
      retryVersions: versionWorkflow.actions.refreshVersions,
    }),
    [
      versionWorkflow.actions.setVersionName,
      versionWorkflow.actions.setVersionKind,
      versionWorkflow.actions.create,
      versionWorkflow.actions.loadMoreVersions,
      versionWorkflow.actions.refreshVersions,
    ]
  )

  const pageController = useQuoteHomePageController({
    homeResource: homeData,
    versions: versionWorkflow.versions,
    stateActions,
    loadMoreJobs: homeData.loadMore,
    workflowActions,
    retrySearch: searchResource.retry,
  })
  const { confirmingDelete, deletingId, error: deleteError } =
    pageController.deleteState

  const vmState = useMemo<QuoteHomePageVmState>(
    () => ({
      actionWarning: pageController.actionWarning,
      searchQuery: interactionState.searchQuery,
      searchFocused: interactionState.searchFocused,
      jobQuery: interactionState.jobQuery,
      selectedJobId: interactionState.selectedJobId,
      selectedJob: interactionState.selectedJob,
      actions: pageController.actions,
    }),
    [
      interactionState.jobQuery,
      interactionState.searchFocused,
      interactionState.searchQuery,
      interactionState.selectedJob,
      interactionState.selectedJobId,
      pageController.actionWarning,
      pageController.actions,
    ]
  )

  const vmResources = useMemo(
    () =>
      buildQuoteHomePageVmResources({
        home: {
          summary: homeData.summary,
          jobs: homeData.jobs,
          hasMore: homeData.hasMore,
          jobsLoading: homeData.jobsLoading,
          loading: homeData.loading,
          bootstrapError: homeData.bootstrapError,
          jobsError: homeData.jobsError,
        },
        search: {
          query: searchResource.query,
          loading: searchResource.loading,
          error: searchResource.error,
          results: searchResource.results,
        },
        versions: {
          items: versionWorkflow.versions.items,
          error: versionWorkflow.versions.error,
          totalVersions: versionWorkflow.versions.pageData.total_versions,
          hasMore: versionWorkflow.versions.hasMore,
          loadingMore: versionWorkflow.versions.loadingMore,
          hasResolved: versionWorkflow.versions.hasResolved,
        },
        create: {
          creating: versionWorkflow.create.creating,
          error: versionWorkflow.create.error,
          versionName: versionWorkflow.create.versionName,
          versionKind: versionWorkflow.create.versionKind,
          canCreate: versionWorkflow.create.canCreate,
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
      homeData.bootstrapError,
      homeData.hasMore,
      homeData.jobs,
      homeData.jobsError,
      homeData.jobsLoading,
      homeData.loading,
      homeData.summary,
      searchResource.error,
      searchResource.loading,
      searchResource.query,
      searchResource.results,
      versionWorkflow.create.canCreate,
      versionWorkflow.create.creating,
      versionWorkflow.create.error,
      versionWorkflow.create.versionKind,
      versionWorkflow.create.versionName,
      versionWorkflow.versions.error,
      versionWorkflow.versions.hasMore,
      versionWorkflow.versions.hasResolved,
      versionWorkflow.versions.items,
      versionWorkflow.versions.loadingMore,
      versionWorkflow.versions.pageData.total_versions,
    ]
  )

  return {
    vmState,
    vmResources,
  }
}
