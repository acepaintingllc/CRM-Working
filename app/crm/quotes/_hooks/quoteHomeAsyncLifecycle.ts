type MutableRef<T> = {
  current: T
}

export type QuoteHomeAsyncLifecycle<TRequest extends { requestId: number }> = {
  currentRequestRef: MutableRef<number>
  activeRequestRef?: MutableRef<TRequest | null>
}

export type QuoteHomeAsyncRequest<TDetails extends object = object> = TDetails & {
  requestId: number
}

export function beginQuoteHomeAsyncRequest<TDetails extends object>(
  lifecycle: QuoteHomeAsyncLifecycle<QuoteHomeAsyncRequest<TDetails>>,
  details: TDetails
): QuoteHomeAsyncRequest<TDetails> {
  const request = {
    ...details,
    requestId: lifecycle.currentRequestRef.current + 1,
  }

  lifecycle.currentRequestRef.current = request.requestId

  if (lifecycle.activeRequestRef) {
    lifecycle.activeRequestRef.current = request
  }

  return request
}

export function cancelQuoteHomeAsyncRequests<TRequest extends { requestId: number }>(
  lifecycle: QuoteHomeAsyncLifecycle<TRequest>
) {
  lifecycle.currentRequestRef.current += 1

  if (lifecycle.activeRequestRef) {
    lifecycle.activeRequestRef.current = null
  }
}

export function isQuoteHomeAsyncRequestCurrent<TRequest extends { requestId: number }>(
  lifecycle: QuoteHomeAsyncLifecycle<TRequest>,
  request: TRequest
): boolean {
  if (lifecycle.currentRequestRef.current !== request.requestId) {
    return false
  }

  return lifecycle.activeRequestRef
    ? lifecycle.activeRequestRef.current?.requestId === request.requestId
    : true
}

export function finishQuoteHomeAsyncRequest<TRequest extends { requestId: number }>(
  lifecycle: QuoteHomeAsyncLifecycle<TRequest>,
  request: TRequest,
  finish: () => void
): boolean {
  if (!isQuoteHomeAsyncRequestCurrent(lifecycle, request)) {
    return false
  }

  if (lifecycle.activeRequestRef) {
    lifecycle.activeRequestRef.current = null
  }

  finish()
  return true
}
