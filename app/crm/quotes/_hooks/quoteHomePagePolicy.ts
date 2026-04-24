import type { QuoteHomeJobListItemReadModel } from '@/lib/quotes/collectionData'

export function resolveQuoteHomeSelectedJobId(
  jobs: QuoteHomeJobListItemReadModel[],
  currentJobId: string
) {
  if (currentJobId && jobs.some((job) => job.id === currentJobId)) {
    return currentJobId
  }

  return jobs[0]?.id ?? ''
}

export function filterQuoteHomeJobs(
  jobs: QuoteHomeJobListItemReadModel[],
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return jobs

  return jobs.filter((job) => {
    const haystack = `${job.title} ${job.customer_name ?? ''} ${job.customer_address ?? ''}`.toLowerCase()
    return haystack.includes(normalizedQuery)
  })
}
