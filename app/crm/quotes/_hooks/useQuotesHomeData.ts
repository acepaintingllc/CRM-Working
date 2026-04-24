'use client'

import { useRef } from 'react'
import { useResource } from '@/app/crm/_hooks/useResource'
import type { QuoteHomeBootstrapReadModel } from '@/lib/quotes/collectionData'
import { loadQuoteHomeBootstrap } from '@/lib/quotes/client'

const EMPTY_BOOTSTRAP: QuoteHomeBootstrapReadModel = {
  summary: {
    total_versions: 0,
    draft_count: 0,
    sent_or_awaiting_count: 0,
    live_count: 0,
    pipeline_total: 0,
  },
  jobs: {
    query: '',
    limit: 25,
    next_cursor: null,
    items: [],
  },
  selected_job_id: null,
  selected_job_versions: null,
}

function toLoadErrorMessage(scope: string, loadError: unknown) {
  return loadError instanceof Error ? loadError.message : `Failed to load ${scope}.`
}

export function useQuotesHomeData(initialData?: QuoteHomeBootstrapReadModel | null) {
  const resolvedInitialData = initialData ?? EMPTY_BOOTSTRAP
  const latestLoadedBootstrapRef = useRef(resolvedInitialData)
  const resource = useResource<QuoteHomeBootstrapReadModel>({
    initialData: resolvedInitialData,
    initialLoading: !initialData,
    skipInitialLoad: Boolean(initialData),
    resetOnError: false,
    load: async () => {
      const nextBootstrap = await loadQuoteHomeBootstrap<QuoteHomeBootstrapReadModel>()
      latestLoadedBootstrapRef.current = nextBootstrap
      return nextBootstrap
    },
    getErrorMessage: (loadError) => toLoadErrorMessage('quote home bootstrap', loadError),
  })

  return {
    bootstrap: resource.data,
    summary: resource.data.summary,
    jobsPage: resource.data.jobs,
    jobs: resource.data.jobs.items,
    initialSelectedJobId: resource.data.selected_job_id,
    initialSelectedJobVersions: resource.data.selected_job_versions,
    loading: resource.loading,
    bootstrapError: resource.error,
    refresh: async () => {
      const ok = await resource.refresh()
      return ok ? latestLoadedBootstrapRef.current : null
    },
    attemptRefresh: async (options?: { preserveDataOnError?: boolean; reportError?: boolean }) => {
      const result = await resource.attemptRefresh(options)
      return {
        ok: result.ok,
        error: result.error,
        data: result.ok ? latestLoadedBootstrapRef.current : null,
      }
    },
  }
}
