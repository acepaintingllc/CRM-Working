'use client'

import { useMemo } from 'react'
import type { QuoteHomeBootstrapReadModel } from '@/lib/quotes/collectionData'
import {
  buildQuoteHomePageVm,
  type QuoteHomePageVm,
} from '../_home/quoteHomePageVm'
import { useQuoteHomePageController } from './quoteHomePageController'
import { buildQuoteHomePageVmResources } from './quoteHomePageVmResources'
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
  const workflow = useQuoteVersionWorkflow({
    jobId: selectedJobId,
    selectedJob,
    loading: homeResource.loading,
    initialVersions:
      homeResource.initialSelectedJobVersions?.job_id === selectedJobId
        ? homeResource.initialSelectedJobVersions
        : null,
  })
  const deleteController = useQuotesHomeDelete()
  const workflowActions = useMemo(
    () => ({
      setVersionName: workflow.actions.setVersionName,
      setVersionKind: workflow.actions.setVersionKind,
      create: workflow.actions.create,
      loadMoreVersions: workflow.actions.loadMoreVersions,
    }),
    [
      workflow.actions.setVersionName,
      workflow.actions.setVersionKind,
      workflow.actions.create,
      workflow.actions.loadMoreVersions,
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

  const vmResources = useMemo(
    () =>
      buildQuoteHomePageVmResources({
        homeResource,
        searchState,
        workflow,
        deleteController,
      }),
    [homeResource, searchState, workflow, deleteController]
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
          actions: controller.actions,
        },
        vmResources
      ),
    [
      controller.actionWarning,
      controller.actions,
      searchQuery,
      searchFocused,
      jobQuery,
      selectedJobId,
      selectedJob,
      homeResource.jobs,
      vmResources,
    ]
  )
}
