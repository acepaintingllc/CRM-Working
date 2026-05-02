import type { QuoteJobVersionsPageReadModel } from '@/lib/quotes/quoteHomeTypes'

export type JobVersionsCache = {
  get(jobId: string): QuoteJobVersionsPageReadModel | null
  set(jobId: string, page: QuoteJobVersionsPageReadModel): void
  has(jobId: string): boolean
}

type CacheReadOptions = {
  force?: boolean
}

type InitialJobVersionsPageOptions = {
  jobId: string
  enabled: boolean
  initialData: QuoteJobVersionsPageReadModel | null
}

export type JobVersionsRequestPurpose = 'fresh' | 'load_more'

export type JobVersionsResourceState = {
  pageData: QuoteJobVersionsPageReadModel
  loading: boolean
  loadingMore: boolean
  error: string | null
  resolvedJobIds: ReadonlySet<string>
}

export type JobVersionsReducerAction =
  | {
      type: 'reset'
      jobId: string
    }
  | {
      type: 'markResolved'
      jobId: string
    }
  | {
      type: 'beginFresh'
      jobId: string
      preserveDataOnError: boolean
      reportError: boolean
    }
  | {
      type: 'beginLoadMore'
      reportError: boolean
    }
  | {
      type: 'commitPage'
      page: QuoteJobVersionsPageReadModel
      clearError: boolean
      settleFresh: boolean
      settleLoadMore: boolean
    }
  | {
      type: 'fail'
      jobId: string
      purpose: JobVersionsRequestPurpose
      error: string
      preserveDataOnError: boolean
      reportError: boolean
    }
  | {
      type: 'finish'
      purpose: JobVersionsRequestPurpose
    }
  | {
      type: 'removeVersion'
      estimateId: string
    }

type InitialJobVersionsStateOptions = {
  jobId: string
  enabled: boolean
  initialData: QuoteJobVersionsPageReadModel | null
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
  page: QuoteJobVersionsPageReadModel | null,
): page is QuoteJobVersionsPageReadModel {
  return Boolean(page?.job_id)
}

export function initialJobVersionsPage(
  jobId: string,
  enabled: boolean,
  initialData: QuoteJobVersionsPageReadModel | null,
): QuoteJobVersionsPageReadModel {
  if (!enabled) return emptyJobVersions('')
  if (initialData?.job_id === jobId) return initialData
  return emptyJobVersions(jobId)
}

export function resolveInitialJobVersionsPage({
  jobId,
  enabled,
  initialData,
}: InitialJobVersionsPageOptions): QuoteJobVersionsPageReadModel {
  return initialJobVersionsPage(jobId, enabled, initialData)
}

export function mergeJobVersionsPages(
  currentData: QuoteJobVersionsPageReadModel,
  nextPage: QuoteJobVersionsPageReadModel,
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

export function jobVersionsErrorMessage(loadError: unknown): string {
  return loadError instanceof Error
    ? loadError.message
    : 'Failed to load job quote versions.'
}

export function readJobVersionsPage(
  value: unknown,
): QuoteJobVersionsPageReadModel {
  if (
    value &&
    typeof value === 'object' &&
    typeof Reflect.get(value, 'job_id') === 'string' &&
    Array.isArray(Reflect.get(value, 'items'))
  ) {
    return value as QuoteJobVersionsPageReadModel
  }

  throw new Error('Failed to load job quote versions.')
}

export function createInitialJobVersionsState({
  jobId,
  enabled,
  initialData,
}: InitialJobVersionsStateOptions): JobVersionsResourceState {
  const resolvedJobIds =
    enabled && initialData?.job_id
      ? new Set([initialData.job_id])
      : new Set<string>()

  return {
    pageData: resolveInitialJobVersionsPage({
      jobId,
      enabled,
      initialData,
    }),
    loading: false,
    loadingMore: false,
    error: null,
    resolvedJobIds,
  }
}

function markJobVersionsResolved(
  resolvedJobIds: ReadonlySet<string>,
  jobId: string,
): ReadonlySet<string> {
  if (!jobId || resolvedJobIds.has(jobId)) {
    return resolvedJobIds
  }

  const nextResolvedJobIds = new Set(resolvedJobIds)
  nextResolvedJobIds.add(jobId)
  return nextResolvedJobIds
}

export function reduceJobVersionsResourceState(
  state: JobVersionsResourceState,
  action: JobVersionsReducerAction,
): JobVersionsResourceState {
  switch (action.type) {
    case 'reset':
      return {
        ...state,
        pageData: emptyJobVersions(action.jobId),
        loading: false,
        loadingMore: false,
        error: null,
      }

    case 'markResolved':
      return {
        ...state,
        resolvedJobIds: markJobVersionsResolved(
          state.resolvedJobIds,
          action.jobId,
        ),
      }

    case 'beginFresh':
      return {
        ...state,
        pageData: action.preserveDataOnError
          ? state.pageData
          : emptyJobVersions(action.jobId),
        loading: true,
        loadingMore: false,
        error: action.reportError ? null : state.error,
      }

    case 'beginLoadMore':
      return {
        ...state,
        loadingMore: true,
        error: action.reportError ? null : state.error,
      }

    case 'commitPage':
      return {
        ...state,
        pageData: action.page,
        loading: action.settleFresh ? false : state.loading,
        loadingMore: action.settleLoadMore ? false : state.loadingMore,
        error: action.clearError ? null : state.error,
        resolvedJobIds: markJobVersionsResolved(
          state.resolvedJobIds,
          action.page.job_id,
        ),
      }

    case 'fail':
      return {
        ...state,
        pageData: action.preserveDataOnError
          ? state.pageData
          : emptyJobVersions(action.jobId),
        loading: action.purpose === 'fresh' ? false : state.loading,
        loadingMore: action.purpose === 'load_more' ? false : state.loadingMore,
        error: action.reportError ? action.error : state.error,
      }

    case 'finish':
      return {
        ...state,
        loading: action.purpose === 'fresh' ? false : state.loading,
        loadingMore: action.purpose === 'load_more' ? false : state.loadingMore,
      }

    case 'removeVersion': {
      const nextItems = state.pageData.items.filter(
        (item) => item.estimate_id !== action.estimateId,
      )

      if (nextItems.length === state.pageData.items.length) {
        return state
      }

      return {
        ...state,
        pageData: {
          ...state.pageData,
          total_versions: Math.max(0, state.pageData.total_versions - 1),
          items: nextItems,
        },
      }
    }
  }
}

export function shouldReadJobVersionsCache(
  options?: CacheReadOptions,
): boolean {
  return options?.force !== true
}

export function getCachedJobVersionsPage(
  cache: JobVersionsCache,
  jobId: string,
  options?: CacheReadOptions,
): QuoteJobVersionsPageReadModel | null {
  if (!shouldReadJobVersionsCache(options) || !cache.has(jobId)) {
    return null
  }

  return cache.get(jobId) ?? emptyJobVersions(jobId)
}

export function hydrateJobVersionsCache(
  cache: JobVersionsCache,
  page: QuoteJobVersionsPageReadModel | null,
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
