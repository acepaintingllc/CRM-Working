'use client'

import { useEffect, useMemo } from 'react'
import type { QuoteHomeBootstrapReadModel } from '@/lib/quotes/collectionData'
import type {
  QuoteHomePageActions,
  QuoteHomePageVmResources,
  QuoteHomePageVmState,
} from '../_home/quoteHomePageVm'
import {
  buildQuoteHomePageVmResourceInputs,
  buildQuoteHomePageVmResources,
} from './quoteHomePageVmResources'
import { useQuoteHomePageState } from './useQuoteHomePageState'
import { useQuoteVersionWorkflow } from './useQuoteVersionWorkflow'
import { useQuotesHomeData, type QuoteHomeDataResourceContract } from './useQuotesHomeData'
import { useQuotesHomeSearch } from './useQuotesHomeSearch'
import { useQuoteHomePageController } from './quoteHomePageController'

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

type QuoteHomePageStateResource = ReturnType<typeof useQuoteHomePageState>
type QuoteHomeVersionWorkflowResource = ReturnType<typeof useQuoteVersionWorkflow>
type QuoteHomeSearchResource = ReturnType<typeof useQuotesHomeSearch>

function useReconcileQuoteHomeJobs(
  pageState: QuoteHomePageStateResource,
  homeResource: QuoteHomeDataResourceContract
) {
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
}

function useQuoteHomeStateActions(pageState: QuoteHomePageStateResource) {
  return useMemo<QuoteHomeStateActions>(
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
}

function useQuoteHomeWorkflowActions(workflow: QuoteHomeVersionWorkflowResource) {
  return useMemo<QuoteHomeWorkflowActions>(
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
}

function useQuoteHomeVmState(params: {
  pageState: QuoteHomePageStateResource
  homeResource: QuoteHomeDataResourceContract
  actions: QuoteHomePageActions
  actionWarning: QuoteHomePageVmState['actionWarning']
}) {
  const { pageState, homeResource, actions, actionWarning } = params

  return useMemo<QuoteHomePageVmState>(
    () => ({
      actionWarning,
      searchQuery: pageState.searchQuery,
      searchFocused: pageState.searchFocused,
      jobQuery: pageState.jobQuery,
      selectedJobId: pageState.selectedJobId,
      selectedJob: pageState.selectedJob,
      visibleJobs: homeResource.jobs,
      actions,
    }),
    [
      actionWarning,
      actions,
      homeResource.jobs,
      pageState.jobQuery,
      pageState.searchFocused,
      pageState.searchQuery,
      pageState.selectedJob,
      pageState.selectedJobId,
    ]
  )
}

function useQuoteHomeVmResources(params: {
  homeResource: QuoteHomeDataResourceContract
  searchResource: QuoteHomeSearchResource
  workflow: QuoteHomeVersionWorkflowResource
  deleteResource: ReturnType<typeof useQuoteHomePageController>['deleteState']
}) {
  const { homeResource, searchResource, workflow, deleteResource } = params

  return useMemo(
    () =>
      buildQuoteHomePageVmResources(
        buildQuoteHomePageVmResourceInputs({
          homeResource,
          searchResource,
          versionsResource: workflow.versions,
          createResource: workflow.create,
          deleteResource,
        })
      ),
    [deleteResource, homeResource, searchResource, workflow.create, workflow.versions]
  )
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

  useReconcileQuoteHomeJobs(pageState, homeResource)

  const stateActions = useQuoteHomeStateActions(pageState)
  const workflowActions = useQuoteHomeWorkflowActions(workflow)

  const controller = useQuoteHomePageController({
    homeResource,
    versions: workflow.versions,
    stateActions,
    loadMoreJobs: homeResource.loadMore,
    workflowActions,
    retrySearch: searchState.retry,
  })

  const vmState = useQuoteHomeVmState({
    pageState,
    homeResource,
    actions: controller.actions,
    actionWarning: controller.actionWarning,
  })
  const vmResources = useQuoteHomeVmResources({
    homeResource,
    searchResource: searchState,
    workflow,
    deleteResource: controller.deleteState,
  })

  return {
    vmState,
    vmResources,
  }
}
