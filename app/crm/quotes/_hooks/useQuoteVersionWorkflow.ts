'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { EligibleQuoteVersionJob } from '@/lib/quotes/versionCreation'
import type { QuoteJobVersionsPageReadModel } from '@/lib/quotes/collectionData'
import { useQuoteJobVersions } from './useQuoteJobVersions'
import { useQuoteVersionCreation } from './useQuoteVersionCreation'

type UseQuoteVersionWorkflowOptions = {
  jobId: string
  selectedJob: EligibleQuoteVersionJob | null
  loading?: boolean
  blockCreateWhileVersionsLoading?: boolean
  onRefresh?: (() => Promise<unknown>) | null
  initialVersions?: QuoteJobVersionsPageReadModel | null
}

function useLatestCallback<TArgs extends unknown[], TResult>(
  callback: (...args: TArgs) => TResult
): (...args: TArgs) => TResult {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  return useCallback((...args: TArgs) => callbackRef.current(...args), [])
}

export function useQuoteVersionWorkflow({
  jobId,
  selectedJob,
  loading = false,
  blockCreateWhileVersionsLoading = false,
  onRefresh = null,
  initialVersions = null,
}: UseQuoteVersionWorkflowOptions) {
  const versions = useQuoteJobVersions(jobId, {
    enabled: Boolean(jobId),
    initialData: initialVersions,
  })
  const createController = useQuoteVersionCreation(selectedJob)
  const { setError, setVersionKind, setVersionName } = createController
  const {
    data: versionsData,
    pageData: versionsPageData,
    items: versionsItems,
    loading: versionsLoading,
    loadingMore: versionsLoadingMore,
    error: versionsError,
    hasMore: versionsHasMore,
    hasResolved: versionsHasResolved,
    loadMore: loadMoreVersions,
    refresh: refreshVersions,
    attemptRefresh: attemptRefreshVersions,
  } = versions
  const hasJobContext = Boolean(jobId)
  const hasSelectedJob = Boolean(selectedJob)

  useEffect(() => {
    setVersionName('')
    setVersionKind('standard')
    setError(null)
  }, [jobId, setError, setVersionKind, setVersionName])

  const createVersion = useLatestCallback(createController.createVersion)

  const refresh = useCallback(async () => {
    const [contextResult, versionsResult] = await Promise.all([
      onRefresh ? onRefresh() : Promise.resolve(true),
      refreshVersions(),
    ])

    return Boolean(contextResult && versionsResult)
  }, [onRefresh, refreshVersions])

  const versionsState = useMemo(
    () => ({
      data: versionsData,
      pageData: versionsPageData,
      items: versionsItems,
      loading: versionsLoading,
      loadingMore: versionsLoadingMore,
      error: versionsError,
      hasMore: versionsHasMore,
      hasResolved: versionsHasResolved,
      loadMore: loadMoreVersions,
      refresh: refreshVersions,
      attemptRefresh: attemptRefreshVersions,
    }),
    [
      attemptRefreshVersions,
      loadMoreVersions,
      refreshVersions,
      versionsData,
      versionsError,
      versionsHasMore,
      versionsHasResolved,
      versionsItems,
      versionsLoading,
      versionsLoadingMore,
      versionsPageData,
    ]
  )

  const createState = useMemo(
    () => ({
      creating: createController.creating,
      error: createController.error,
      versionKind: createController.versionKind,
      versionName: createController.versionName,
      setVersionKind: createController.setVersionKind,
      setVersionName: createController.setVersionName,
      setError: createController.setError,
      createVersion,
      canCreate:
        hasSelectedJob &&
        !createController.creating &&
        !loading &&
        (!blockCreateWhileVersionsLoading || !versionsState.loading),
    }),
    [
      blockCreateWhileVersionsLoading,
      createController.creating,
      createController.error,
      createController.setError,
      createController.setVersionKind,
      createController.setVersionName,
      createController.versionKind,
      createController.versionName,
      createVersion,
      hasSelectedJob,
      loading,
      versionsState.loading,
    ]
  )

  const actions = useMemo(
    () => ({
      setVersionName: createController.setVersionName,
      setVersionKind: createController.setVersionKind,
      create: createVersion,
      refresh,
      refreshVersions,
      loadMoreVersions,
    }),
    [
      createController.setVersionKind,
      createController.setVersionName,
      createVersion,
      loadMoreVersions,
      refresh,
      refreshVersions,
    ]
  )

  return useMemo(
    () => ({
      hasJobContext,
      hasSelectedJob,
      versions: versionsState,
      create: createState,
      actions,
    }),
    [actions, createState, hasJobContext, hasSelectedJob, versionsState]
  )
}
