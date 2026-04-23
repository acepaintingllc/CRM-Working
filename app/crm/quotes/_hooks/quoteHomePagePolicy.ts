'use client'

import type { QuoteHomeEligibleJobReadModel } from '@/lib/quotes/collectionData'

export function resolveQuoteHomeSelectedJobId(
  jobs: QuoteHomeEligibleJobReadModel[],
  currentJobId: string
) {
  if (currentJobId && jobs.some((job) => job.id === currentJobId)) {
    return currentJobId
  }

  return jobs[0]?.id ?? ''
}

export function filterQuoteHomeJobs(
  jobs: QuoteHomeEligibleJobReadModel[],
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return jobs

  return jobs.filter((job) => {
    const haystack = `${job.title} ${job.customer_name ?? ''} ${job.customer_address ?? ''}`.toLowerCase()
    return haystack.includes(normalizedQuery)
  })
}
