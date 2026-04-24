'use client'

import { useEffect, useMemo, useState } from 'react'
import type { QuoteHomeBootstrapReadModel } from '@/lib/quotes/collectionData'
import { buildQuoteHomePageVm, type QuoteHomePageActions } from '../_home/quoteHomePageVm'
import { useQuotesHomeData } from './useQuotesHomeData'
import { useQuotesHomeDelete } from './useQuotesHomeDelete'
import { useQuotesHomeSearch } from './useQuotesHomeSearch'
import { useQuoteVersionWorkflow } from './useQuoteVersionWorkflow'
import { filterQuoteHomeJobs, resolveQuoteHomeSelectedJobId } from './quoteHomePagePolicy'

export function useQuotesHomePage(initialData?: QuoteHomeBootstrapReadModel | null) {
  const homeResource = useQuotesHomeData(initialData)
  const [actionWarning, setActionWarning] = useState<string | null>(null)
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
    requestDelete: (value: string | { estimate_id: string }) => {
      setActionWarning(null)
      const estimateId = typeof value === 'string' ? value : value.estimate_id
      const estimate =
        workflow.versions.items.find((item) => item.estimate_id === estimateId) ?? null
      if (estimate) {
        deleteController.requestDeleteVersion(estimate)
      }
    },
    cancelDelete: deleteController.cancelDelete,
    confirmDelete: async () => {
      const deleted = await deleteController.confirmDeleteVersion()
      if (!deleted) {
        return false
      }

      setActionWarning(null)
      const [bootstrapRefresh, versionsRefresh] = await Promise.all([
        homeResource.attemptRefresh({
          preserveDataOnError: true,
          reportError: false,
        }),
        workflow.versions.attemptRefresh({
          preserveDataOnError: true,
          reportError: false,
        }),
      ])

      if (bootstrapRefresh.ok && versionsRefresh.ok) {
        return true
      }

      const refreshFailures: string[] = []
      if (!bootstrapRefresh.ok && bootstrapRefresh.error) {
        refreshFailures.push(`Home refresh failed. ${bootstrapRefresh.error}`)
      }
      if (!versionsRefresh.ok && versionsRefresh.error) {
        refreshFailures.push(`Versions refresh failed. ${versionsRefresh.error}`)
      }

      setActionWarning(
        `Quote deleted, but follow-up refresh failed. Reload the page if the quote still appears. ${refreshFailures.join(' ')}`
      )
      return true
    },
    refresh: async () => {
      setActionWarning(null)
      return workflow.actions.refresh()
    },
  }

  return buildQuoteHomePageVm(
    {
      actionWarning,
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
