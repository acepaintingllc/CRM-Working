import type { QuoteJobVersionsPageReadModel } from '@/lib/quotes/collectionData'

type JobVersionsCache = {
  get(jobId: string): QuoteJobVersionsPageReadModel | null
  set(jobId: string, page: QuoteJobVersionsPageReadModel): void
  has(jobId: string): boolean
}

export function createJobVersionsCache(): JobVersionsCache {
  const cache = new Map<string, QuoteJobVersionsPageReadModel>()

  return {
    get(jobId) {
      return cache.get(jobId) ?? null
    },
    set(jobId, page) {
      cache.set(jobId, page)
    },
    has(jobId) {
      return cache.has(jobId)
    },
  }
}
