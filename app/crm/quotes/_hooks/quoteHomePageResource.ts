'use client'

import { useEffect, useMemo } from 'react'
import type { QuoteHomeBootstrapReadModel } from '@/lib/quotes/collectionData'
import type {
  QuoteHomePageActions,
  QuoteHomePageVmInput,
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

type QuoteHomePageStateResource = ReturnType<typeof useQuoteHomePageState>
type QuoteHomeVersionWorkflowResource = ReturnType<typeof useQuoteVersionWorkflow>
type QuoteHomeSearchResource = ReturnType<typeof useQuotesHomeSearch>
type QuoteHomePageControllerResource = ReturnType<typeof useQuoteHomePageController>

export type QuoteHomePageResourceFacade = {
  resources: {
    page: QuoteHomePageStateResource
    home: QuoteHomeDataResourceContract
    search: QuoteHomeSearchResource
    workflow: QuoteHomeVersionWorkflowResource
    controller: QuoteHomePageControllerResource
    delete: QuoteHomePageControllerResource['deleteState']
  }
  vmInput: QuoteHomePageVmInput
}

function useSyncQuoteHomeLoadedJobsToPageSelection(
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
  deleteResource: QuoteHomePageControllerResource['deleteState']
}) {
  const { homeResource, searchResource, workflow, deleteResource } = params

  return useMemo<QuoteHomePageVmResources>(
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

export function useQuoteHomePageResource(
  initialData?: QuoteHomeBootstrapReadModel | null
): QuoteHomePageResourceFacade {
  const pageState = useQuoteHomePageState(
    initialData?.jobs.items ?? [],
    initialData?.selected_job_id ?? ''
  )

  const homeResource = useQuotesHomeData(initialData, {
    jobQuery: pageState.jobQuery,
  })

  const searchResource = useQuotesHomeSearch(pageState.searchQuery)
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

  useSyncQuoteHomeLoadedJobsToPageSelection(pageState, homeResource)

  const controller = useQuoteHomePageController({
    resources: {
      home: homeResource,
      versions: workflow.versions,
      create: workflow.create,
      search: searchResource,
      pageActions: pageState.actions,
    },
  })

  const vmState = useQuoteHomeVmState({
    pageState,
    homeResource,
    actions: controller.actions,
    actionWarning: controller.actionWarning,
  })
  const vmResources = useQuoteHomeVmResources({
    homeResource,
    searchResource,
    workflow,
    deleteResource: controller.deleteState,
  })

  const vmInput = useMemo<QuoteHomePageVmInput>(
    () => ({
      state: vmState,
      resources: vmResources,
    }),
    [vmResources, vmState]
  )

  return {
    resources: {
      page: pageState,
      home: homeResource,
      search: searchResource,
      workflow,
      controller,
      delete: controller.deleteState,
    },
    vmInput,
  }
}
