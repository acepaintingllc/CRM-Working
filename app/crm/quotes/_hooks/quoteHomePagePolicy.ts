import type { QuoteHomeJobListItemReadModel } from '@/lib/quotes/collectionData'

export function normalizeQuoteHomeJobQuery(query: string) {
  return query.trim()
}

export function resolveQuoteHomeSelectedJobId(
  jobs: QuoteHomeJobListItemReadModel[],
  currentJobId: string
) {
  if (currentJobId && jobs.some((job) => job.id === currentJobId)) {
    return currentJobId
  }

  return jobs[0]?.id ?? ''
}
