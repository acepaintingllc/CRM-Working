export type ApiErrorPayload = {
  error?: unknown
}

export type ApiDataEnvelope<T> = {
  data: T
}

export type ApiReadMetaEnvelope<T> = {
  data: T
  meta?: Record<string, unknown>
}

export type ApiMutationEnvelope<T> = {
  data: T
  notice?: string | null
}

export type ParsedApiResponse<T = unknown> = {
  json: T | null
  text: string
}

export type RawApiResponse<TPayload = unknown> = {
  response: Response
  parsed: ParsedApiResponse<unknown>
  payload: TPayload | null
  errorMessage: string | null
}

export async function parseApiResponse<T = unknown>(
  response: Response
): Promise<ParsedApiResponse<T>> {
  const text = await response.text()
  if (!text.trim()) {
    return { json: null, text: '' }
  }

  try {
    return { json: JSON.parse(text) as T, text }
  } catch {
    return { json: null, text }
  }
}

function getPayloadError(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  const error = (payload as ApiErrorPayload).error
  if (typeof error === 'string' && error.trim()) return error
  if (!error || typeof error !== 'object') return null

  const message = (error as { message?: unknown }).message
  if (typeof message === 'string' && message.trim()) return message

  const code = (error as { code?: unknown }).code
  if (typeof code === 'string' && code.trim()) return `Request failed (${code}).`

  return null
}

export function getApiErrorMessage(
  response: Response,
  parsed: ParsedApiResponse<unknown>,
  fallback = 'Request failed.'
) {
  return (
    getPayloadError(parsed.json) ??
    (parsed.json == null && parsed.text.trim() ? parsed.text.trim() : null) ??
    response.statusText ??
    fallback
  )
}

export function getApiPayloadData<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    return null
  }

  return ((payload as ApiDataEnvelope<T>).data ?? null) as T | null
}

export async function requestApiWith<TResponse>(
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<TResponse> {
  const response = await fetcher(input, init)
  const parsed = await parseApiResponse<TResponse>(response)

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response, parsed))
  }

  return (parsed.json ?? null) as TResponse
}

export async function requestRawApiWith<TPayload = unknown>(
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  input: RequestInfo | URL,
  init?: RequestInit,
  fallbackErrorMessage = 'Request failed.'
): Promise<RawApiResponse<TPayload>> {
  const response = await fetcher(input, init)
  const parsed = await parseApiResponse(response)

  return {
    response,
    parsed,
    payload: getApiPayloadData<TPayload>(parsed.json),
    errorMessage: response.ok ? null : getApiErrorMessage(response, parsed, fallbackErrorMessage),
  }
}
