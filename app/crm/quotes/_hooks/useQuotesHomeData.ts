'use client'

import { useEffect, useMemo, useRef } from 'react'
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
  jobCounts: {
    items: [],
  },
  jobs: [],
}

function toLoadErrorMessage(scope: string, loadError: unknown) {
  return loadError instanceof Error ? loadError.message : `Failed to load ${scope}.`
}

export function useQuotesHomeData(initialData?: QuoteHomeBootstrapReadModel | null) {
  const latestLoadedBootstrapRef = useRef(initialData ?? EMPTY_BOOTSTRAP)
  const resource = useResource<QuoteHomeBootstrapReadModel>({
    initialData: initialData ?? EMPTY_BOOTSTRAP,
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
  const bootstrapRef = useRef(resource.data)

  useEffect(() => {
    bootstrapRef.current = resource.data
  }, [resource.data])

  const resolvedBootstrap = resource.data
  const versionCountByJob = useMemo(() => {
    return resolvedBootstrap.jobCounts.items.reduce<Record<string, number>>((counts, item) => {
      counts[item.job_id] = item.version_count
      return counts
    }, {})
  }, [resolvedBootstrap.jobCounts.items])

  return {
    summary: resolvedBootstrap.summary,
    jobCounts: resolvedBootstrap.jobCounts,
    jobs: resolvedBootstrap.jobs,
    loading: resource.loading,
    bootstrapError: resource.error,
    versionCountByJob,
    refresh: async () => {
      const ok = await resource.refresh()
      return ok ? latestLoadedBootstrapRef.current : null
    },
  }
}
