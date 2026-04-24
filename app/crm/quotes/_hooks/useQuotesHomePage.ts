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
import { filterQuoteHomeJobs, resolveQuoteHomeSelectedJobId } from './quoteHomePagePolicy'

export function useQuotesHomePage(
  initialData?: QuoteHomeBootstrapReadModel | null
): QuoteHomePageVm {
  const homeResource = useQuotesHomeData(initialData)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [jobQuery, setJobQuery] = useState('')
  const [selectedJobId, setSelectedJobId] = useState(homeResource.initialSelectedJobId ?? '')
  const searchState = useQuotesHomeSearch(searchQuery)
  const selectedJob = homeResource.jobs.find((job) => job.id === selectedJobId) ?? null
  const filteredJobs = useMemo(
    () => filterQuoteHomeJobs(homeResource.jobs, jobQuery),
    [homeResource.jobs, jobQuery]
  )
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

  const actions: QuoteHomePageActions = {
    setSearchQuery,
    setSearchFocused,
    setJobQuery,
    setSelectedJobId,
    setVersionName: workflow.actions.setVersionName,
    setVersionKind: workflow.actions.setVersionKind,
    create: workflow.actions.create,
    retrySearch: searchState.retry,
    requestDelete: controller.actions.requestDelete,
    cancelDelete: controller.actions.cancelDelete,
    confirmDelete: controller.actions.confirmDelete,
    refresh: controller.actions.refresh,
  }

  return buildQuoteHomePageVm(
    {
      actionWarning: controller.actionWarning,
      searchQuery,
      searchFocused,
      jobQuery,
      selectedJobId,
      selectedJob,
      filteredJobs,
      actions,
    },
    {
      home: {
        summary: homeResource.summary,
        jobs: homeResource.jobs,
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
  )
}
