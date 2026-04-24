'use client'

import { useCallback, useMemo, useState } from 'react'
import type {
  QuoteHomeBootstrapReadModel,
  QuoteHomeJobVersionItemReadModel,
  QuoteJobVersionsPageReadModel,
} from '@/lib/quotes/collectionData'
import type { QuoteVersionKind } from '@/lib/quotes/versionCreation'
import type { QuoteHomePageActions } from '../_home/quoteHomePageVm'
import type { QuoteHomeActionWarning } from '../_home/quoteHomeTypes'

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
}

type QuoteHomePageControllerVersionsResource = {
  pageData: QuoteJobVersionsPageReadModel
  items: QuoteHomeJobVersionItemReadModel[]
  refresh: () => Promise<boolean>
  attemptRefresh: (options?: RefreshAttemptOptions) => Promise<RefreshAttemptResult>
}

type QuoteHomePageDeleteController = {
  requestDeleteVersion: (estimate: QuoteHomeJobVersionItemReadModel) => void
  cancelDelete: () => void
  confirmDeleteVersion: () => Promise<boolean>
}

type QuoteHomeStateActions = Pick<
  QuoteHomePageActions,
  'setSearchQuery' | 'setSearchFocused' | 'setJobQuery' | 'setSelectedJobId'
>

type QuoteHomeWorkflowActions = {
  setVersionName: (value: string) => void
  setVersionKind: (value: QuoteVersionKind) => void
  create: () => Promise<unknown>
  loadMoreVersions: () => Promise<boolean>
  retryVersions: () => Promise<boolean>
}

type UseQuoteHomePageControllerParams = {
  homeResource: QuoteHomePageControllerHomeResource
  versions: QuoteHomePageControllerVersionsResource
  deleteController: QuoteHomePageDeleteController
  stateActions: QuoteHomeStateActions
  loadMoreJobs: () => Promise<void>
  workflowActions: QuoteHomeWorkflowActions
  retrySearch: () => void
}

function buildDeleteRefreshWarning(refreshFailures: string[]) {
  return {
    source: 'delete',
    message: `Quote deleted, but follow-up refresh failed. Reload the page if the quote still appears. ${refreshFailures.join(' ')}`,
  } satisfies QuoteHomeActionWarning
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

async function refreshAfterDelete(
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
  deleteController,
  stateActions,
  loadMoreJobs,
  workflowActions,
  retrySearch,
}: UseQuoteHomePageControllerParams): {
  actionWarning: QuoteHomeActionWarning | null
  actions: QuoteHomePageActions
} {
  const [actionWarning, setActionWarning] = useState<QuoteHomeActionWarning | null>(null)
  const { attemptRefresh: refreshBootstrap, retryJobs } = homeResource
  const {
    attemptRefresh: refreshVersions,
    items: versionItems,
    pageData,
    refresh: refreshVersionsList,
  } = versions
  const {
    cancelDelete: cancelDeleteVersion,
    confirmDeleteVersion,
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
    const deleted = await confirmDeleteVersion()
    if (!deleted) {
      return false
    }

    setActionWarning(null)
    const { bootstrapRefresh, versionsRefresh } = await refreshAfterDelete(
      refreshBootstrap,
      refreshVersions
    )

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

    setActionWarning(buildDeleteRefreshWarning(refreshFailures))
    return true
  }, [
    confirmDeleteVersion,
    refreshBootstrap,
    refreshVersions,
  ])

  const actions = useMemo(
    () => ({
      ...stateActions,
      loadMore: loadMoreJobs,
      setVersionName: workflowActions.setVersionName,
      setVersionKind: workflowActions.setVersionKind,
      create: workflowActions.create,
      loadMoreVersions: workflowActions.loadMoreVersions,
      retryJobs,
      retryVersions: workflowActions.retryVersions,
      retrySearch,
      requestDelete,
      cancelDelete,
      confirmDelete,
      refresh,
    }),
    [
      stateActions,
      loadMoreJobs,
      workflowActions.setVersionName,
      workflowActions.setVersionKind,
      workflowActions.create,
      workflowActions.loadMoreVersions,
      workflowActions.retryVersions,
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
    actions,
  }
}
