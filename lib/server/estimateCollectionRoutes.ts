import {
  jsonError,
  readJsonBody,
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'
import {
  normalizeQuoteHomeJobQuery,
  normalizeQuoteHomeSearchQuery,
} from '@/lib/quotes/collectionData'
import {
  createEstimateCollectionVersion,
  loadEstimateCollectionBootstrapPayload,
  loadEstimateCollectionJobsPayload,
  loadEstimateCollectionJobVersionsPayload,
  loadEstimateCollectionPayload,
  loadEstimateCollectionQuoteCreateContextPayload,
  loadEstimateCollectionSearchPayload,
  type EstimateCollectionVersionCopy,
} from '@/lib/server/estimate-collection/service'
import {
  serviceResultDataResponse,
  serviceResultMutationResponse,
} from '@/lib/server/routeResult'

type RouteParamResult<T> =
  | { ok: true; value: T }
  | { ok: false; response: ReturnType<typeof jsonError> }

function readOptionalPositiveIntegerParam(
  params: URLSearchParams,
  name: string
): RouteParamResult<number | undefined> {
  const rawValue = params.get(name)
  if (rawValue == null || rawValue.trim() === '') {
    return { ok: true, value: undefined }
  }

  const normalizedValue = rawValue.trim()
  const value = Number(normalizedValue)
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    String(value) !== normalizedValue
  ) {
    return { ok: false, response: jsonError(`Invalid ${name}.`, 400) }
  }

  return { ok: true, value }
}

export async function handleEstimateCollectionRouteGet() {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  return serviceResultDataResponse(await loadEstimateCollectionPayload(auth.session.orgId))
}

export async function handleEstimateHomeBootstrapRouteGet() {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  return serviceResultDataResponse(await loadEstimateCollectionBootstrapPayload(auth.session.orgId))
}

export async function handleEstimateHomeJobsRouteGet(request: Request) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const query = normalizeQuoteHomeJobQuery(url.searchParams.get('q'))
  const cursor = url.searchParams.get('cursor')
  const limit = readOptionalPositiveIntegerParam(url.searchParams, 'limit')
  if (!limit.ok) return limit.response

  return serviceResultDataResponse(
    await loadEstimateCollectionJobsPayload(auth.session.orgId, {
      query,
      cursor,
      limit: limit.value,
    })
  )
}

export async function handleEstimateHomeSearchRouteGet(request: Request) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const query = normalizeQuoteHomeSearchQuery(new URL(request.url).searchParams.get('q'))
  return serviceResultDataResponse(
    await loadEstimateCollectionSearchPayload(auth.session.orgId, query)
  )
}

export type EstimateJobVersionsRouteContext = {
  params: { jobId: string } | Promise<{ jobId: string }>
}

export type EstimateQuoteCreateContextRouteContext = {
  params: { jobId: string } | Promise<{ jobId: string }>
}

export async function handleEstimateQuoteCreateContextRouteGet(
  request: Request,
  context: EstimateQuoteCreateContextRouteContext
) {
  void request

  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await resolveParams(context)
  const jobId = readUuidParam(params?.jobId, 'job id')
  if (!jobId.ok) return jobId.response

  return serviceResultDataResponse(
    await loadEstimateCollectionQuoteCreateContextPayload(auth.session.orgId, jobId.value)
  )
}

export async function handleEstimateJobVersionsRouteGet(
  request: Request,
  context: EstimateJobVersionsRouteContext
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await resolveParams(context)
  const jobId = readUuidParam(params?.jobId, 'job id')
  if (!jobId.ok) return jobId.response

  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor')
  const limit = readOptionalPositiveIntegerParam(url.searchParams, 'limit')
  if (!limit.ok) return limit.response

  return serviceResultDataResponse(
    await loadEstimateCollectionJobVersionsPayload(auth.session.orgId, jobId.value, {
      cursor,
      limit: limit.value,
    })
  )
}

export async function handleEstimateCollectionRoutePost(
  request: Request,
  copy: EstimateCollectionVersionCopy
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const body = await readJsonBody<Record<string, unknown>>(request)
  if (!body.ok) return body.response

  const result = await createEstimateCollectionVersion({
    orgId: auth.session.orgId,
    userId: auth.session.userId,
    body: body.value ?? {},
    copy,
  })

  if (!result.ok) {
    if (result.kind === 'invalid_input') {
      return jsonError(result.message, 400)
    }
    if (result.kind === 'not_found') {
      return jsonError(result.message, 404)
    }
  }

  return serviceResultMutationResponse(result, copy.createdNotice)
}

export const quoteEstimateCollectionCopy: EstimateCollectionVersionCopy = {
  createdNotice: 'Quote version created.',
  defaultVersionLabel: 'Quote Version',
}

export const estimateCollectionCopy: EstimateCollectionVersionCopy = {
  createdNotice: 'Estimate version created.',
  defaultVersionLabel: 'Estimate Version',
}
