'use client'

import { useEffect, useMemo } from 'react'
import type { QuoteHomeBootstrapReadModel } from '@/lib/quotes/collectionData'
import { useQuoteHomePageController } from './quoteHomePageController'
import { buildQuoteHomePageVmResources } from './quoteHomePageVmResources'
import { useQuoteHomePageState } from './useQuoteHomePageState'
import { useQuoteVersionWorkflow } from './useQuoteVersionWorkflow'
import { useQuotesHomeData } from './useQuotesHomeData'
import { useQuotesHomeDelete } from './useQuotesHomeDelete'
import { useQuotesHomeSearch } from './useQuotesHomeSearch'

export function useQuoteHomePageResources(
  initialData?: QuoteHomeBootstrapReadModel | null
) {
  const pageState = useQuoteHomePageState(
    initialData?.jobs.items ?? [],
    initialData?.selected_job_id ?? ''
  )
  const homeResource = useQuotesHomeData(initialData, {
    jobQuery: pageState.jobQuery,
  })
  const searchState = useQuotesHomeSearch(pageState.searchQuery)
  const workflow = useQuoteVersionWorkflow({
    jobId: pageState.selectedJobId,
    selectedJob: pageState.selectedJob,
    loading: homeResource.loading,
    initialVersions:
      homeResource.initialSelectedJobVersions?.job_id === pageState.selectedJobId
        ? homeResource.initialSelectedJobVersions
        : null,
  })
  const deleteController = useQuotesHomeDelete()
  const { setJobsForSelection } = pageState

  useEffect(() => {
    setJobsForSelection(homeResource.jobs, homeResource.jobsPage.query)
  }, [homeResource.jobs, homeResource.jobsPage.query, setJobsForSelection])

  const workflowActions = useMemo(
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
  const stateActions = useMemo(
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

  return {
    pageState,
    homeResource,
    controller,
    vmResources,
  }
}
