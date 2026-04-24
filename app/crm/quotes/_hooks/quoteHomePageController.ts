'use client'

import { useState } from 'react'
import type { QuoteHomeJobVersionItemReadModel } from '@/lib/quotes/collectionData'
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

type QuoteHomePageControllerHomeResource = {
  refresh: () => Promise<unknown>
  attemptRefresh: (
    options?: RefreshAttemptOptions
  ) => Promise<RefreshAttemptResult | { ok: boolean; error: string | null; data: unknown }>
}

type QuoteHomePageControllerVersionsResource = {
  items: QuoteHomeJobVersionItemReadModel[]
  refresh: () => Promise<boolean>
  attemptRefresh: (options?: RefreshAttemptOptions) => Promise<RefreshAttemptResult>
}

type QuoteHomePageDeleteController = {
  requestDeleteVersion: (estimate: QuoteHomeJobVersionItemReadModel) => void
  cancelDelete: () => void
  confirmDeleteVersion: () => Promise<boolean>
}

type UseQuoteHomePageControllerParams = {
  homeResource: QuoteHomePageControllerHomeResource
  versions: QuoteHomePageControllerVersionsResource
  deleteController: QuoteHomePageDeleteController
}

type QuoteHomePageControllerActions = Pick<
  QuoteHomePageActions,
  'requestDelete' | 'cancelDelete' | 'confirmDelete' | 'refresh'
>

function buildDeleteRefreshWarning(refreshFailures: string[]) {
  return {
    source: 'delete',
    message: `Quote deleted, but follow-up refresh failed. Reload the page if the quote still appears. ${refreshFailures.join(' ')}`,
  } satisfies QuoteHomeActionWarning
}

export function useQuoteHomePageController({
  homeResource,
  versions,
  deleteController,
}: UseQuoteHomePageControllerParams): {
  actionWarning: QuoteHomeActionWarning | null
  actions: QuoteHomePageControllerActions
} {
  const [actionWarning, setActionWarning] = useState<QuoteHomeActionWarning | null>(null)

  async function refresh() {
    setActionWarning(null)
    const [bootstrapOk, versionsOk] = await Promise.all([
      homeResource.refresh(),
      versions.refresh(),
    ])
    return Boolean(bootstrapOk && versionsOk)
  }

  const actions: QuoteHomePageControllerActions = {
    requestDelete: (value) => {
      setActionWarning(null)
      const estimateId = typeof value === 'string' ? value : value.estimate_id
      const estimate = versions.items.find((item) => item.estimate_id === estimateId) ?? null
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
        versions.attemptRefresh({
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

      setActionWarning(buildDeleteRefreshWarning(refreshFailures))
      return true
    },
    refresh,
  }

  return {
    actionWarning,
    actions,
  }
}
