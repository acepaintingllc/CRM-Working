'use client'

import { useMemo, useRef } from 'react'

type MutableRef<T> = {
  current: T
}

export type QuotePagedAsyncRequest<TDetails extends object = object> =
  TDetails & {
    requestId: number
  }

export type QuotePagedAsyncLifecycle<TRequest extends { requestId: number }> = {
  currentRequestRef: MutableRef<number>
  activeRequestRef?: MutableRef<TRequest | null>
  activeLoadMoreRequestRef?: MutableRef<TRequest | null>
}

export type QuotePagedAsyncRunResult<TData> =
  | {
      ok: true
      data: TData
      error: null
      stale: false
    }
  | {
      ok: false
      data: null
      error: string | null
      stale: boolean
    }

export type QuotePagedAsyncRunHandlers<
  TRequest extends { requestId: number },
  TData,
> = {
  load: (request: TRequest) => Promise<TData>
  getErrorMessage: (loadError: unknown) => string
  isCurrent?: (request: TRequest) => boolean
  onSuccess?: (request: TRequest, data: TData) => void
  onFailure?: (request: TRequest, error: string, loadError: unknown) => void
  onFinish?: (request: TRequest) => void
}

type BeginQuotePagedAsyncRequestOptions = {
  cancelLoadMore?: boolean
  trackLoadMore?: boolean
}

type UseQuotePagedAsyncLifecycleOptions = {
  trackLoadMore?: boolean
}

export function useQuotePagedAsyncLifecycle<
  TRequest extends { requestId: number },
>(
  options?: UseQuotePagedAsyncLifecycleOptions,
): QuotePagedAsyncLifecycle<TRequest> {
  const currentRequestRef = useRef(0)
  const activeRequestRef = useRef<TRequest | null>(null)
  const activeLoadMoreRequestRef = useRef<TRequest | null>(null)
  const trackLoadMore = options?.trackLoadMore ?? false

  return useMemo(
    () => ({
      currentRequestRef,
      activeRequestRef,
      ...(trackLoadMore ? { activeLoadMoreRequestRef } : {}),
    }),
    [trackLoadMore],
  )
}

export function beginQuotePagedAsyncRequest<TDetails extends object>(
  lifecycle: QuotePagedAsyncLifecycle<QuotePagedAsyncRequest<TDetails>>,
  details: TDetails,
  options?: BeginQuotePagedAsyncRequestOptions,
): QuotePagedAsyncRequest<TDetails> {
  const request = {
    ...details,
    requestId: lifecycle.currentRequestRef.current + 1,
  }

  lifecycle.currentRequestRef.current = request.requestId

  if (lifecycle.activeRequestRef) {
    lifecycle.activeRequestRef.current = request
  }

  if (lifecycle.activeLoadMoreRequestRef) {
    if (options?.trackLoadMore) {
      lifecycle.activeLoadMoreRequestRef.current = request
    } else if (options?.cancelLoadMore) {
      lifecycle.activeLoadMoreRequestRef.current = null
    }
  }

  return request
}

export function startQuotePagedAsyncRequest<TDetails extends object>(
  lifecycle: QuotePagedAsyncLifecycle<QuotePagedAsyncRequest<TDetails>>,
  details: TDetails,
  onStart?: (request: QuotePagedAsyncRequest<TDetails>) => void,
  options?: BeginQuotePagedAsyncRequestOptions,
): QuotePagedAsyncRequest<TDetails> {
  const request = beginQuotePagedAsyncRequest(lifecycle, details, options)
  onStart?.(request)
  return request
}

export function cancelQuotePagedAsyncRequests<
  TRequest extends { requestId: number },
>(lifecycle: QuotePagedAsyncLifecycle<TRequest>) {
  lifecycle.currentRequestRef.current += 1

  if (lifecycle.activeRequestRef) {
    lifecycle.activeRequestRef.current = null
  }

  if (lifecycle.activeLoadMoreRequestRef) {
    lifecycle.activeLoadMoreRequestRef.current = null
  }
}

export function isQuotePagedAsyncRequestCurrent<
  TRequest extends { requestId: number },
>(lifecycle: QuotePagedAsyncLifecycle<TRequest>, request: TRequest): boolean {
  if (lifecycle.currentRequestRef.current !== request.requestId) {
    return false
  }

  return lifecycle.activeRequestRef
    ? lifecycle.activeRequestRef.current?.requestId === request.requestId
    : true
}

export function finishQuotePagedAsyncRequest<
  TRequest extends { requestId: number },
>(
  lifecycle: QuotePagedAsyncLifecycle<TRequest>,
  request: TRequest,
  finish: () => void,
): boolean {
  if (!isQuotePagedAsyncRequestCurrent(lifecycle, request)) {
    return false
  }

  if (lifecycle.activeRequestRef) {
    lifecycle.activeRequestRef.current = null
  }

  if (
    lifecycle.activeLoadMoreRequestRef?.current?.requestId === request.requestId
  ) {
    lifecycle.activeLoadMoreRequestRef.current = null
  }

  finish()
  return true
}

export function canStartQuotePagedAsyncLoadMoreRequest<
  TRequest extends { requestId: number },
>(
  lifecycle: QuotePagedAsyncLifecycle<TRequest>,
  cursor: string | null | undefined,
): boolean {
  const activeLoadMoreRequest =
    lifecycle.activeLoadMoreRequestRef?.current ?? null
  return Boolean(cursor) && activeLoadMoreRequest === null
}

export function beginQuotePagedAsyncLoadMoreRequest<TDetails extends object>(
  lifecycle: QuotePagedAsyncLifecycle<QuotePagedAsyncRequest<TDetails>>,
  details: TDetails,
  cursor: string | null | undefined,
): QuotePagedAsyncRequest<TDetails> | null {
  if (!canStartQuotePagedAsyncLoadMoreRequest(lifecycle, cursor)) {
    return null
  }

  return beginQuotePagedAsyncRequest(lifecycle, details, {
    trackLoadMore: true,
  })
}

export function finishQuotePagedAsyncLoadMoreRequest<
  TRequest extends { requestId: number },
>(lifecycle: QuotePagedAsyncLifecycle<TRequest>, request: TRequest) {
  if (
    lifecycle.activeLoadMoreRequestRef?.current?.requestId === request.requestId
  ) {
    lifecycle.activeLoadMoreRequestRef.current = null
  }
}

export function beginQuotePagedAsyncLoadMoreKey(
  activeKeysRef: MutableRef<Set<string>>,
  key: string,
): boolean {
  if (activeKeysRef.current.has(key)) {
    return false
  }

  activeKeysRef.current.add(key)
  return true
}

export function finishQuotePagedAsyncLoadMoreKey(
  activeKeysRef: MutableRef<Set<string>>,
  key: string,
) {
  activeKeysRef.current.delete(key)
}

export function clearQuotePagedAsyncLoadMoreKeys(
  activeKeysRef: MutableRef<Set<string>>,
) {
  activeKeysRef.current.clear()
}

export async function runQuotePagedAsyncLoadMoreRequest<
  TDetails extends object,
  TData,
>(
  lifecycle: QuotePagedAsyncLifecycle<QuotePagedAsyncRequest<TDetails>>,
  details: TDetails,
  cursor: string | null | undefined,
  handlers: QuotePagedAsyncRunHandlers<
    QuotePagedAsyncRequest<TDetails>,
    TData
  > & {
    onStart?: (request: QuotePagedAsyncRequest<TDetails>) => void
  },
): Promise<QuotePagedAsyncRunResult<TData> | null> {
  const request = beginQuotePagedAsyncLoadMoreRequest(
    lifecycle,
    details,
    cursor,
  )

  if (request === null) {
    return null
  }

  handlers.onStart?.(request)

  return runQuotePagedAsyncRequest(lifecycle, request, handlers)
}

export async function runQuotePagedAsyncLoadMoreKey<T>(
  activeKeysRef: MutableRef<Set<string>>,
  key: string,
  run: () => Promise<T>,
): Promise<T | null> {
  if (!beginQuotePagedAsyncLoadMoreKey(activeKeysRef, key)) {
    return null
  }

  try {
    return await run()
  } finally {
    finishQuotePagedAsyncLoadMoreKey(activeKeysRef, key)
  }
}

export async function runQuotePagedAsyncRequest<
  TRequest extends { requestId: number },
  TData,
>(
  lifecycle: QuotePagedAsyncLifecycle<TRequest>,
  request: TRequest,
  handlers: QuotePagedAsyncRunHandlers<TRequest, TData>,
): Promise<QuotePagedAsyncRunResult<TData>> {
  const isCurrent = () =>
    handlers.isCurrent
      ? handlers.isCurrent(request)
      : isQuotePagedAsyncRequestCurrent(lifecycle, request)

  try {
    let data: TData

    try {
      data = await handlers.load(request)
    } catch (loadError) {
      if (!isCurrent()) {
        return {
          ok: false,
          data: null,
          error: null,
          stale: true,
        }
      }

      const error = handlers.getErrorMessage(loadError)
      handlers.onFailure?.(request, error, loadError)

      return {
        ok: false,
        data: null,
        error,
        stale: false,
      }
    }

    if (!isCurrent()) {
      return {
        ok: false,
        data: null,
        error: null,
        stale: true,
      }
    }

    handlers.onSuccess?.(request, data)

    return {
      ok: true,
      data,
      error: null,
      stale: false,
    }
  } finally {
    finishQuotePagedAsyncRequest(lifecycle, request, () => {
      handlers.onFinish?.(request)
    })
  }
}
