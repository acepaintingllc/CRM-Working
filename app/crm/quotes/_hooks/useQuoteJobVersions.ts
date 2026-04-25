'use client'

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
} from 'react'
import type {
  QuoteJobVersionsPageReadModel,
  QuoteJobVersionsReadModel,
  QuoteHomeJobVersionItemReadModel,
} from '@/lib/quotes/quoteHomeTypes'
import { loadQuoteJobVersions } from '@/lib/quotes/client'
import {
  createInitialJobVersionsState,
  createJobVersionsCache,
  emptyJobVersions,
  getCachedJobVersionsPage,
  hydrateJobVersionsCache,
  jobVersionsErrorMessage,
  mergeJobVersionsPages,
  readJobVersionsPage,
  reduceJobVersionsResourceState,
  type JobVersionsReducerAction,
  type JobVersionsCache,
  type JobVersionsRequestPurpose,
} from './jobVersionsCache'
import {
  beginQuotePagedAsyncRequest,
  cancelQuotePagedAsyncRequests,
  finishQuotePagedAsyncRequest,
  runQuotePagedAsyncLoadMoreRequest,
  runQuotePagedAsyncRequest,
  useQuotePagedAsyncLifecycle,
  type QuotePagedAsyncLifecycle,
  type QuotePagedAsyncRequest,
} from './quotePagedAsyncLifecycle'

type UseQuoteJobVersionsOptions = {
  enabled?: boolean
  initialData?: QuoteJobVersionsPageReadModel | null
}

type LoadOptions = {
  force?: boolean
  preserveDataOnError?: boolean
  reportError?: boolean
  cursor?: string | null
  append?: boolean
}

type FreshLoadOptions = Pick<
  LoadOptions,
  'force' | 'preserveDataOnError' | 'reportError'
>
type LoadMoreOptions = Pick<
  LoadOptions,
  'cursor' | 'preserveDataOnError' | 'reportError'
>
export type QuoteHomeVersionsLoadResult =
  | { ok: true; error: null }
  | { ok: false; error: string | null }
type JobVersionsOperationDetails = {
  jobId: string
  purpose: JobVersionsRequestPurpose
  cursor?: string | null
}
type JobVersionsOperation = QuotePagedAsyncRequest<JobVersionsOperationDetails>

type JobVersionsRequestLifecycle =
  QuotePagedAsyncLifecycle<JobVersionsOperation>

type JobVersionsCommitOptions = {
  clearError: boolean
  settleFresh?: boolean
  settleLoadMore?: boolean
}

export type QuoteHomeVersionsResourceContract = {
  data: QuoteJobVersionsReadModel
  pageData: QuoteJobVersionsPageReadModel
  items: QuoteHomeJobVersionItemReadModel[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  hasResolved: boolean
  loadMore: () => Promise<boolean>
  refresh: () => Promise<boolean>
  attemptRefresh: (
    options?: Pick<LoadOptions, 'preserveDataOnError' | 'reportError'>,
  ) => Promise<QuoteHomeVersionsLoadResult>
}

function beginFreshJobVersionsRequest(
  lifecycle: JobVersionsRequestLifecycle,
  jobId: string,
): JobVersionsOperation {
  return beginQuotePagedAsyncRequest<JobVersionsOperationDetails>(
    lifecycle,
    {
      jobId,
      purpose: 'fresh',
    },
    {
      cancelLoadMore: true,
    },
  )
}

export function cancelJobVersionsRequests(
  lifecycle: JobVersionsRequestLifecycle,
) {
  cancelQuotePagedAsyncRequests(lifecycle)
}

function cacheAndCommitJobVersionsPage(
  cache: JobVersionsCache,
  dispatch: Dispatch<JobVersionsReducerAction>,
  page: QuoteJobVersionsPageReadModel,
  options: JobVersionsCommitOptions,
) {
  cache.set(page.job_id, page)
  dispatch({
    type: 'commitPage',
    page,
    clearError: options.clearError,
    settleFresh: options.settleFresh ?? false,
    settleLoadMore: options.settleLoadMore ?? false,
  })
}

async function loadFreshJobVersionsPage({
  jobId,
  cache,
  lifecycle,
  dispatch,
  options,
}: {
  jobId: string
  cache: JobVersionsCache
  lifecycle: JobVersionsRequestLifecycle
  dispatch: Dispatch<JobVersionsReducerAction>
  options?: FreshLoadOptions
}): Promise<QuoteHomeVersionsLoadResult> {
  const request = beginFreshJobVersionsRequest(lifecycle, jobId)
  const cachedPage = getCachedJobVersionsPage(cache, jobId, {
    force: options?.force,
  })

  if (cachedPage) {
    finishQuotePagedAsyncRequest(lifecycle, request, () => {
      cacheAndCommitJobVersionsPage(cache, dispatch, cachedPage, {
        clearError: true,
        settleFresh: true,
        settleLoadMore: true,
      })
    })
    return { ok: true, error: null }
  }

  const preserveDataOnError = options?.preserveDataOnError ?? false
  const reportError = options?.reportError ?? true

  dispatch({
    type: 'beginFresh',
    jobId,
    preserveDataOnError,
    reportError,
  })

  const result = await runQuotePagedAsyncRequest(lifecycle, request, {
    getErrorMessage: jobVersionsErrorMessage,
    load: async () => readJobVersionsPage(await loadQuoteJobVersions(jobId)),
    onSuccess: (_, response) =>
      cacheAndCommitJobVersionsPage(cache, dispatch, response, {
        clearError: reportError,
      }),
    onFailure: (_, error) =>
      dispatch({
        type: 'fail',
        jobId,
        purpose: 'fresh',
        error,
        preserveDataOnError,
        reportError,
      }),
    onFinish: () => dispatch({ type: 'finish', purpose: 'fresh' }),
  })

  return result.ok
    ? { ok: true, error: null }
    : { ok: false, error: result.error }
}

async function loadMoreJobVersionsPage({
  jobId,
  currentData,
  cache,
  lifecycle,
  dispatch,
  options,
}: {
  jobId: string
  currentData: QuoteJobVersionsPageReadModel
  cache: JobVersionsCache
  lifecycle: JobVersionsRequestLifecycle
  dispatch: Dispatch<JobVersionsReducerAction>
  options?: LoadMoreOptions
}): Promise<QuoteHomeVersionsLoadResult> {
  const cursor = options?.cursor ?? null
  const preserveDataOnError = options?.preserveDataOnError ?? true
  const reportError = options?.reportError ?? true

  const result = await runQuotePagedAsyncLoadMoreRequest<
    JobVersionsOperationDetails,
    QuoteJobVersionsPageReadModel
  >(
    lifecycle,
    {
      jobId,
      purpose: 'load_more',
      cursor,
    },
    cursor,
    {
      getErrorMessage: jobVersionsErrorMessage,
      onStart: () =>
        dispatch({
          type: 'beginLoadMore',
          reportError,
        }),
      load: () =>
        loadQuoteJobVersions(jobId, {
          cursor,
        }).then(readJobVersionsPage),
      onSuccess: (_, response) =>
        cacheAndCommitJobVersionsPage(
          cache,
          dispatch,
          mergeJobVersionsPages(currentData, response),
          {
            clearError: reportError,
          },
        ),
      onFailure: (_, error) =>
        dispatch({
          type: 'fail',
          jobId,
          purpose: 'load_more',
          error,
          preserveDataOnError,
          reportError,
        }),
      onFinish: () => dispatch({ type: 'finish', purpose: 'load_more' }),
    },
  )

  if (result === null) {
    return { ok: false, error: null }
  }

  return result.ok
    ? { ok: true, error: null }
    : { ok: false, error: result.error }
}

export function useQuoteJobVersions(
  jobId: string,
  options?: UseQuoteJobVersionsOptions,
) {
  const enabled = options?.enabled ?? true
  const initialData = options?.initialData ?? null
  const cacheRef = useRef(createJobVersionsCache())
  const lifecycle = useQuotePagedAsyncLifecycle<JobVersionsOperation>({
    trackLoadMore: true,
  })
  const [state, dispatch] = useReducer(
    reduceJobVersionsResourceState,
    {
      jobId,
      enabled,
      initialData,
    },
    createInitialJobVersionsState,
  )
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    const didHydrate = enabled
      ? hydrateJobVersionsCache(cacheRef.current, initialData)
      : false

    if (didHydrate && initialData?.job_id) {
      dispatch({ type: 'markResolved', jobId: initialData.job_id })
    }

    if (!enabled || initialData?.job_id !== jobId) {
      return
    }

    const request = beginFreshJobVersionsRequest(lifecycle, jobId)
    finishQuotePagedAsyncRequest(lifecycle, request, () => {
      cacheAndCommitJobVersionsPage(cacheRef.current, dispatch, initialData, {
        clearError: true,
        settleFresh: true,
        settleLoadMore: true,
      })
    })
  }, [enabled, initialData, jobId, lifecycle])

  const loadFresh = useCallback(
    async (targetJobId: string, loadOptions?: FreshLoadOptions) =>
      loadFreshJobVersionsPage({
        jobId: targetJobId,
        cache: cacheRef.current,
        lifecycle,
        dispatch,
        options: loadOptions,
      }),
    [lifecycle],
  )

  const loadNextPage = useCallback(
    async (targetJobId: string, loadOptions?: LoadMoreOptions) => {
      const currentData =
        stateRef.current.pageData.job_id === targetJobId
          ? stateRef.current.pageData
          : emptyJobVersions(targetJobId)

      return loadMoreJobVersionsPage({
        jobId: targetJobId,
        currentData,
        cache: cacheRef.current,
        lifecycle,
        dispatch,
        options: loadOptions,
      })
    },
    [lifecycle],
  )

  const load = useCallback(
    async (
      targetJobId: string,
      loadOptions?: LoadOptions,
    ): Promise<QuoteHomeVersionsLoadResult> => {
      if (!targetJobId || !enabled) {
        cancelJobVersionsRequests(lifecycle)
        dispatch({ type: 'reset', jobId: '' })
        return { ok: false, error: null }
      }

      if (loadOptions?.append) {
        return loadNextPage(targetJobId, loadOptions)
      }

      return loadFresh(targetJobId, loadOptions)
    },
    [enabled, lifecycle, loadFresh, loadNextPage],
  )

  useEffect(() => {
    void load(jobId)
  }, [jobId, load])

  const refresh = useCallback(async () => {
    if (!enabled) return false

    const result = await load(jobId, {
      force: true,
      preserveDataOnError: true,
    })

    return result.ok
  }, [enabled, jobId, load])

  const attemptRefresh = useCallback(
    async (loadOptions?: {
      preserveDataOnError?: boolean
      reportError?: boolean
    }) => {
      if (!enabled) return { ok: false as const, error: null }

      return load(jobId, {
        force: true,
        preserveDataOnError: loadOptions?.preserveDataOnError,
        reportError: loadOptions?.reportError,
      })
    },
    [enabled, jobId, load],
  )

  const loadMore = useCallback(async () => {
    const cursor = stateRef.current.pageData.next_cursor

    if (!enabled || state.loading || state.loadingMore) {
      return false
    }

    const result = await load(jobId, {
      append: true,
      cursor,
      preserveDataOnError: true,
    })

    return result.ok
  }, [enabled, jobId, load, state.loading, state.loadingMore])

  const hasResolved = Boolean(
    enabled && jobId && state.resolvedJobIds.has(jobId),
  )

  return {
    data: state.pageData as QuoteJobVersionsReadModel,
    pageData: state.pageData,
    items: state.pageData.items as QuoteHomeJobVersionItemReadModel[],
    loading: state.loading,
    loadingMore: state.loadingMore,
    error: state.error,
    hasMore: Boolean(state.pageData.next_cursor),
    hasResolved,
    loadMore,
    refresh,
    attemptRefresh,
  } satisfies QuoteHomeVersionsResourceContract
}
