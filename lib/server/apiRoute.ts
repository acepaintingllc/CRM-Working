import { parseUuidParam } from './routeUtils.ts'

type SessionResult =
  | { userId: string; orgId: string }
  | { error: string }
export type SessionOrg = Exclude<SessionResult, { error: string }>

export function jsonError(error: string, status: number) {
  return Response.json({ error }, { status })
}

type GuardResult = { ok: true } | { ok: false; response: ReturnType<typeof jsonError> }

const textEncoder = new TextEncoder()
const defaultMaxJsonBodyBytes = 256 * 1024

function parseContentLength(request: Request) {
  const raw = request.headers.get('content-length')
  if (raw == null || raw.trim() === '') return { ok: true as const, value: null as number | null }
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false as const, response: jsonError('Invalid Content-Length header.', 400) }
  }
  return { ok: true as const, value: parsed }
}

function isJsonContentType(contentType: string) {
  const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  return normalized === 'application/json' || normalized.endsWith('+json')
}

export function enforceContentLength(
  request: Request,
  maxBytes: number,
  message = 'Request body too large.'
): GuardResult {
  const parsed = parseContentLength(request)
  if (!parsed.ok) return parsed
  if (parsed.value != null && parsed.value > maxBytes) {
    return { ok: false, response: jsonError(message, 413) }
  }
  return { ok: true }
}

export function requireJsonContentType(request: Request): GuardResult {
  const contentType = request.headers.get('content-type') ?? ''
  if (!isJsonContentType(contentType)) {
    return { ok: false, response: jsonError('Expected application/json body.', 415) }
  }
  return { ok: true }
}

export function requireMultipartFormData(request: Request): GuardResult {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return { ok: false, response: jsonError('Expected multipart/form-data body.', 415) }
  }
  return { ok: true }
}

type ReadJsonBodyOptions = {
  allowEmpty?: boolean
  maxBytes?: number
}

type ReadJsonBodyResult<T> =
  | { ok: true; value: T }
  | { ok: false; response: ReturnType<typeof jsonError> }

export async function readJsonBody<T = Record<string, unknown>>(
  request: Request,
  options: ReadJsonBodyOptions = {}
): Promise<ReadJsonBodyResult<T>> {
  const allowEmpty = options.allowEmpty ?? false
  const maxBytes = options.maxBytes ?? defaultMaxJsonBodyBytes

  const length = enforceContentLength(request, maxBytes)
  if (!length.ok) return length

  const contentType = request.headers.get('content-type') ?? ''
  const isJson = isJsonContentType(contentType)

  const raw = await request.text().catch(() => null)
  if (raw == null) {
    return { ok: false, response: jsonError('Invalid JSON body.', 400) }
  }

  if (textEncoder.encode(raw).length > maxBytes) {
    return { ok: false, response: jsonError('Request body too large.', 413) }
  }

  if (!isJson) {
    if (allowEmpty && !raw.trim()) {
      return { ok: true, value: null as T }
    }
    return { ok: false, response: jsonError('Expected application/json body.', 415) }
  }

  if (!raw.trim()) {
    if (allowEmpty) return { ok: true, value: null as T }
    return { ok: false, response: jsonError('Missing body.', 400) }
  }

  try {
    return { ok: true, value: JSON.parse(raw) as T }
  } catch {
    return { ok: false, response: jsonError('Invalid JSON body.', 400) }
  }
}

export async function resolveParams<T>(context: { params: T | Promise<T> }) {
  return Promise.resolve(context.params)
}

type ReadUuidResult =
  | { ok: true; value: string }
  | { ok: false; response: ReturnType<typeof jsonError> }

export function readUuidParam(value: unknown, label: string): ReadUuidResult {
  const parsed = parseUuidParam(value)
  if (parsed.ok) return parsed
  return { ok: false as const, response: jsonError(`Invalid ${label}`, 400) }
}

export async function requireSessionUserOrg() {
  const { getSessionUserOrg } = await import('./org')
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const message = typeof session.error === 'string' ? session.error : 'Not authenticated'
    const status = message === 'Not authenticated' ? 401 : 403
    return { ok: false as const, response: jsonError(message, status) }
  }
  return { ok: true as const, session }
}
