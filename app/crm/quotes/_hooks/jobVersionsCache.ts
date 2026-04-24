import type { QuoteJobVersionsPageReadModel } from '@/lib/quotes/collectionData'

export type JobVersionsCache = {
  get(jobId: string): QuoteJobVersionsPageReadModel | null
  set(jobId: string, page: QuoteJobVersionsPageReadModel): void
  has(jobId: string): boolean
}

type CacheReadOptions = {
  force?: boolean
}

export function emptyJobVersions(jobId: string): QuoteJobVersionsPageReadModel {
  return {
    job_id: jobId,
    total_versions: 0,
    limit: 25,
    next_cursor: null,
    items: [],
  }
}

export function isHydratableJobVersionsPage(
  page: QuoteJobVersionsPageReadModel | null
): page is QuoteJobVersionsPageReadModel {
  return Boolean(page?.job_id)
}

export function initialJobVersionsPage(
  jobId: string,
  enabled: boolean,
  initialData: QuoteJobVersionsPageReadModel | null
): QuoteJobVersionsPageReadModel {
  if (!enabled) return emptyJobVersions('')
  return initialData ?? emptyJobVersions(jobId)
}

export function mergeJobVersionsPages(
  currentData: QuoteJobVersionsPageReadModel,
  nextPage: QuoteJobVersionsPageReadModel
): QuoteJobVersionsPageReadModel {
  const seenEstimateIds = new Set<string>()
  const items = [...currentData.items, ...nextPage.items].filter((item) => {
    if (seenEstimateIds.has(item.estimate_id)) {
      return false
    }

    seenEstimateIds.add(item.estimate_id)
    return true
  })

  return { ...nextPage, items }
}

export function getCachedJobVersionsPage(
  cache: JobVersionsCache,
  jobId: string,
  options?: CacheReadOptions
): QuoteJobVersionsPageReadModel | null {
  if (options?.force || !cache.has(jobId)) {
    return null
  }

  return cache.get(jobId) ?? emptyJobVersions(jobId)
}

export function hydrateJobVersionsCache(
  cache: JobVersionsCache,
  page: QuoteJobVersionsPageReadModel | null
): boolean {
  if (!isHydratableJobVersionsPage(page)) {
    return false
  }

  cache.set(page.job_id, page)
  return true
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
