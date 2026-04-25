'use client'

import { useCallback, useMemo, useState } from 'react'
import type {
  QuoteHomeBootstrapReadModel,
  QuoteHomeJobVersionItemReadModel,
  QuoteJobVersionsPageReadModel,
} from '@/lib/quotes/collectionData'
import { deleteQuoteVersion } from '@/lib/quotes/client'
import type { QuoteVersionKind } from '@/lib/quotes/versionCreation'
import type { QuoteHomePageActions } from '../_home/quoteHomePageVm'
import type { QuoteHomeActionWarning } from '../_home/quoteHomeTypes'
import {
  useQuotesHomeDelete,
  type QuoteHomeDeleteState,
} from './useQuotesHomeDelete'

type RefreshAttemptOptions = {
  preserveDataOnError?: boolean
  reportError?: boolean
}

type RefreshAttemptResult = {
  ok: boolean
  error: string | null
}

type BootstrapRefreshAttemptResult = RefreshAttemptResult & {
  data: QuoteHomeBootstrapReadModel | null
}

type QuoteHomePageControllerHomeResource = {
  attemptRefresh: (
    options?: RefreshAttemptOptions
  ) => Promise<BootstrapRefreshAttemptResult>
  retryJobs: () => Promise<boolean>
  loadMore: () => Promise<void>
}

type QuoteHomePageControllerVersionsResource = {
  pageData: QuoteJobVersionsPageReadModel
  items: QuoteHomeJobVersionItemReadModel[]
  loadMore: () => Promise<boolean>
  refresh: () => Promise<boolean>
  attemptRefresh: (options?: RefreshAttemptOptions) => Promise<RefreshAttemptResult>
}

type QuoteHomeStateActions = Pick<
  QuoteHomePageActions,
  'setSearchQuery' | 'setSearchFocused' | 'setJobQuery' | 'setSelectedJobId'
>

type QuoteHomeCreateActions = {
  setVersionName: (value: string) => void
  setVersionKind: (value: QuoteVersionKind) => void
  createVersion: () => Promise<unknown>
}

type QuoteHomeSearchResource = {
  retry: () => void
}

type UseQuoteHomePageControllerParams = {
  homeResource: QuoteHomePageControllerHomeResource
  versions: QuoteHomePageControllerVersionsResource
  create: QuoteHomeCreateActions
  search: QuoteHomeSearchResource
  stateActions: QuoteHomeStateActions
}

function buildDeleteRefreshWarning(refreshFailures: string[]) {
  const failureDetails = refreshFailures.length > 0
    ? ` ${refreshFailures.join(' ')}`
    : ''

  return {
    source: 'delete',
    message: `Quote deleted, but follow-up refresh failed. Reload the page if the quote still appears.${failureDetails}`,
  } satisfies QuoteHomeActionWarning
}

function buildRefreshFailureMessage(
  label: 'Home' | 'Versions',
  result: RefreshAttemptResult
) {
  if (result.ok) {
    return null
  }

  return result.error
    ? `${label} refresh failed. ${result.error}`
    : `${label} refresh failed.`
}

function bootstrapVersionsCoverActiveJob(
  bootstrap: QuoteHomeBootstrapReadModel | null,
  activeJobId: string
) {
  return Boolean(
    activeJobId &&
      bootstrap?.selected_job_id === activeJobId &&
      bootstrap.selected_job_versions?.job_id === activeJobId
  )
}

async function refreshQuoteHomeAfterDelete(
  refreshBootstrap: QuoteHomePageControllerHomeResource['attemptRefresh'],
  refreshVersions: QuoteHomePageControllerVersionsResource['attemptRefresh']
): Promise<{
  bootstrapRefresh: BootstrapRefreshAttemptResult
  versionsRefresh: RefreshAttemptResult
}> {
  const refreshOptions = {
    preserveDataOnError: true,
    reportError: false,
  }
  const bootstrapRefresh = await refreshBootstrap(refreshOptions)
  const versionsRefresh = await refreshVersions(refreshOptions)

  return {
    bootstrapRefresh,
    versionsRefresh,
  }
}

export function useQuoteHomePageController({
  homeResource,
  versions,
  create,
  search,
  stateActions,
}: UseQuoteHomePageControllerParams): {
  actionWarning: QuoteHomeActionWarning | null
  deleteState: QuoteHomeDeleteState
  actions: QuoteHomePageActions
} {
  const [actionWarning, setActionWarning] = useState<QuoteHomeActionWarning | null>(null)
  const deleteController = useQuotesHomeDelete()
  const {
    attemptRefresh: refreshBootstrap,
    loadMore: loadMoreJobs,
    retryJobs,
  } = homeResource
  const {
    attemptRefresh: refreshVersions,
    items: versionItems,
    loadMore: loadMoreVersions,
    pageData,
    refresh: refreshVersionsList,
  } = versions
  const {
    createVersion,
    setVersionKind,
    setVersionName,
  } = create
  const { retry: retrySearch } = search
  const {
    setJobQuery,
    setSearchFocused,
    setSearchQuery,
    setSelectedJobId,
  } = stateActions
  const {
    beginDelete,
    cancelDelete: cancelDeleteVersion,
    completeDelete,
    failDelete,
    requestDeleteVersion,
  } = deleteController
  const activeVersionsJobId = pageData.job_id

  const refresh = useCallback(async () => {
    setActionWarning(null)
    const bootstrapRefresh = await refreshBootstrap()
    if (!bootstrapRefresh.ok || !bootstrapRefresh.data) {
      return false
    }
    if (bootstrapVersionsCoverActiveJob(bootstrapRefresh.data, activeVersionsJobId)) {
      return true
    }
    return refreshVersionsList()
  }, [activeVersionsJobId, refreshBootstrap, refreshVersionsList])

  const createQuoteVersionForSelectedJob = useCallback(async () => {
    setActionWarning(null)
    return createVersion()
  }, [createVersion])

  const retryVersions = useCallback(() => {
    return refreshVersionsList()
  }, [refreshVersionsList])

  const requestDelete = useCallback(
    (value: string | { estimate_id: string }) => {
      setActionWarning(null)
      const estimateId = typeof value === 'string' ? value : value.estimate_id
      const estimate = versionItems.find((item) => item.estimate_id === estimateId) ?? null
      if (estimate) {
        requestDeleteVersion(estimate)
      }
    },
    [requestDeleteVersion, versionItems]
  )

  const cancelDelete = useCallback(() => {
    cancelDeleteVersion()
  }, [cancelDeleteVersion])

  const confirmDelete = useCallback(async () => {
    const estimate = beginDelete()
    if (!estimate) {
      return false
    }

    try {
      setActionWarning(null)
      await deleteQuoteVersion(estimate.estimate_id)
      completeDelete()

      const { bootstrapRefresh, versionsRefresh } = await refreshQuoteHomeAfterDelete(
        refreshBootstrap,
        refreshVersions
      )

      if (bootstrapRefresh.ok && versionsRefresh.ok) {
        return true
      }

      const refreshFailures: string[] = []
      const bootstrapFailure = buildRefreshFailureMessage('Home', bootstrapRefresh)
      const versionsFailure = buildRefreshFailureMessage('Versions', versionsRefresh)
      if (bootstrapFailure) {
        refreshFailures.push(bootstrapFailure)
      }
      if (versionsFailure) {
        refreshFailures.push(versionsFailure)
      }

      setActionWarning(buildDeleteRefreshWarning(refreshFailures))
      return true
    } catch (deleteError) {
      failDelete(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete quote.'
      )
      return false
    }
  }, [
    beginDelete,
    completeDelete,
    failDelete,
    refreshBootstrap,
    refreshVersions,
  ])

  const deleteState = useMemo<QuoteHomeDeleteState>(
    () => ({
      status: deleteController.status,
      confirmingDelete: deleteController.confirmingDelete,
      deletingId: deleteController.deletingId,
      error: deleteController.error,
      canCancel: deleteController.canCancel,
      canConfirm: deleteController.canConfirm,
    }),
    [
      deleteController.status,
      deleteController.confirmingDelete,
      deleteController.deletingId,
      deleteController.error,
      deleteController.canCancel,
      deleteController.canConfirm,
    ]
  )

  const actions = useMemo(
    () => ({
      setSearchQuery,
      setSearchFocused,
      setJobQuery,
      setSelectedJobId,
      loadMore: loadMoreJobs,
      setVersionName,
      setVersionKind,
      create: createQuoteVersionForSelectedJob,
      loadMoreVersions,
      retryJobs,
      retryVersions,
      retrySearch,
      requestDelete,
      cancelDelete,
      confirmDelete,
      refresh,
    }),
    [
      setSearchQuery,
      setSearchFocused,
      setJobQuery,
      setSelectedJobId,
      loadMoreJobs,
      setVersionName,
      setVersionKind,
      createQuoteVersionForSelectedJob,
      loadMoreVersions,
      retryVersions,
      retrySearch,
      retryJobs,
      requestDelete,
      cancelDelete,
      confirmDelete,
      refresh,
    ]
  )

  return {
    actionWarning,
    deleteState,
    actions,
  }
}
