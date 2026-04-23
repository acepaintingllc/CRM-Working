'use client'

import { useCallback } from 'react'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { fetchJobList, type JobSummary } from '@/lib/jobs/client'
import { type QuoteHomeData } from '@/lib/quotes/collectionData'
import { loadQuoteHome } from '@/lib/quotes/client'
import {
  filterEligibleQuoteVersionJobs,
  type EligibleQuoteVersionJob,
} from '@/lib/quotes/versionCreation'

type QuoteHomeEligibleJob = EligibleQuoteVersionJob<JobSummary>

type QuotesHomeResource = {
  data: QuoteHomeData | null
  jobs: QuoteHomeEligibleJob[]
}

const emptyQuotesHomeResource: QuotesHomeResource = {
  data: null,
  jobs: [],
}

export function useQuotesHomeData() {
  const resource = useLoadableResource<QuotesHomeResource>({
    initialData: emptyQuotesHomeResource,
    load: async () => {
      const [homePayload, jobsPayload] = await Promise.all([
        loadQuoteHome<QuoteHomeData>(),
        fetchJobList(),
      ])

      return {
        data: homePayload,
        jobs: filterEligibleQuoteVersionJobs(jobsPayload),
      }
    },
    getErrorMessage: (loadError: unknown) =>
      loadError instanceof Error ? loadError.message : 'Failed to load quotes home.',
  })

  const setData = useCallback(
    (
      next:
        | QuoteHomeData
        | null
        | ((current: QuoteHomeData | null) => QuoteHomeData | null)
    ) => {
      resource.setData((current) => ({
        ...current,
        data: typeof next === 'function' ? next(current.data) : next,
      }))
    },
    [resource]
  )

  return {
    data: resource.data.data,
    setData,
    jobs: resource.data.jobs,
    loading: resource.loading,
    error: resource.error,
    setError: resource.setError,
    refresh: resource.refresh,
  }
}
