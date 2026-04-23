'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useResource } from '@/app/crm/_hooks/useResource'
import type {
  QuoteHomeBootstrapReadModel,
  QuoteHomeJobVersionItemReadModel,
} from '@/lib/quotes/collectionData'
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
    applyDeletedVersion: (estimate: QuoteHomeJobVersionItemReadModel) => {
      resource.setData((current) => {
        const nextBootstrap = {
          ...current,
          summary: {
            ...current.summary,
            total_versions: Math.max(0, current.summary.total_versions - 1),
            draft_count:
              estimate.version_state === 'draft'
                ? Math.max(0, current.summary.draft_count - 1)
                : current.summary.draft_count,
            sent_or_awaiting_count: estimate.is_sent_estimate
              ? Math.max(0, current.summary.sent_or_awaiting_count - 1)
              : current.summary.sent_or_awaiting_count,
            live_count:
              estimate.version_state === 'live'
                ? Math.max(0, current.summary.live_count - 1)
                : current.summary.live_count,
            pipeline_total: Math.max(0, current.summary.pipeline_total - (estimate.final_total ?? 0)),
          },
          jobCounts: {
            ...current.jobCounts,
            items: current.jobCounts.items.map((item) =>
              item.job_id === estimate.job_id
                ? {
                    ...item,
                    version_count: Math.max(0, item.version_count - 1),
                  }
                : item
            ),
          },
        }
        latestLoadedBootstrapRef.current = nextBootstrap
        return nextBootstrap
      })
    },
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
