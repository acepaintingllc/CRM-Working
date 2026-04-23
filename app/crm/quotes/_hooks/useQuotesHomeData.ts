'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const [bootstrap, setBootstrap] = useState<QuoteHomeBootstrapReadModel | null>(initialData ?? null)
  const [loading, setLoading] = useState(!initialData)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const requestIdRef = useRef(0)
  const initialDataRef = useRef(initialData)
  const bootstrapRef = useRef<QuoteHomeBootstrapReadModel | null>(initialData ?? null)

  useEffect(() => {
    bootstrapRef.current = bootstrap
  }, [bootstrap])

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setBootstrapError(null)

    const [bootstrapResult] = await Promise.allSettled([
      loadQuoteHomeBootstrap<QuoteHomeBootstrapReadModel>(),
    ])

    if (requestIdRef.current !== requestId) return false

    if (bootstrapResult.status === 'fulfilled') {
      setBootstrap(bootstrapResult.value)
      setLoading(false)
      return bootstrapResult.value
    } else {
      setBootstrap(bootstrapRef.current ?? EMPTY_BOOTSTRAP)
      setBootstrapError(toLoadErrorMessage('quote home bootstrap', bootstrapResult.reason))
      setLoading(false)
      return null
    }
  }, [])

  useEffect(() => {
    if (initialDataRef.current) {
      initialDataRef.current = null
      return
    }
    void refresh()
  }, [refresh])

  const resolvedBootstrap = bootstrap ?? EMPTY_BOOTSTRAP
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
    loading,
    bootstrapError,
    versionCountByJob,
    refresh,
  }
}
