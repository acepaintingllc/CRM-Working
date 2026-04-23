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
  const [jobQuery, setJobQuery] = useState('')
  const [selectedJobId, setSelectedJobId] = useState('')
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
    } else {
      setBootstrap(bootstrapRef.current ?? EMPTY_BOOTSTRAP)
      setBootstrapError(toLoadErrorMessage('quote home bootstrap', bootstrapResult.reason))
    }

    setLoading(false)
    return bootstrapResult.status === 'fulfilled'
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

  useEffect(() => {
    setSelectedJobId((current) => {
      if (current && resolvedBootstrap.jobs.some((job) => job.id === current)) return current
      return resolvedBootstrap.jobs[0]?.id ?? ''
    })
  }, [resolvedBootstrap.jobs])

  const selectedJob = resolvedBootstrap.jobs.find((job) => job.id === selectedJobId) ?? null

  const filteredJobs = useMemo(() => {
    const q = jobQuery.trim().toLowerCase()
    if (!q) return resolvedBootstrap.jobs
    return resolvedBootstrap.jobs.filter((job) => {
      const haystack =
        `${job.title} ${job.customer_name ?? ''} ${job.customer_address ?? ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [jobQuery, resolvedBootstrap.jobs])

  return {
    summary: resolvedBootstrap.summary,
    jobCounts: resolvedBootstrap.jobCounts,
    jobs: resolvedBootstrap.jobs,
    loading,
    bootstrapError,
    jobQuery,
    setJobQuery,
    selectedJobId,
    setSelectedJobId,
    selectedJob,
    filteredJobs,
    versionCountByJob,
    refresh,
  }
}
