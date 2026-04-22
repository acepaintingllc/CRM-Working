export type ApiErrorPayload = {
  error?: unknown
}

export type ApiDataEnvelope<T> = {
  data: T
}

export type ApiMutationEnvelope<T> = {
  data: T
  notice?: string | null
}

export type ParsedApiResponse<T = unknown> = {
  json: T | null
  text: string
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
  return typeof error === 'string' && error.trim() ? error : null
}

export function getApiErrorMessage(
  response: Response,
  parsed: ParsedApiResponse<unknown>,
  fallback = 'Request failed.'
) {
  return (
    getPayloadError(parsed.json) ??
    (parsed.text.trim() ? parsed.text.trim() : null) ??
    response.statusText ??
    fallback
  )
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
