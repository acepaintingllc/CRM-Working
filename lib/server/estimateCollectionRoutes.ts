import {
  jsonError,
  readJsonBody,
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'
import {
  createEstimateCollectionVersion,
  loadEstimateCollectionBootstrapPayload,
  loadEstimateCollectionJobsPayload,
  loadEstimateCollectionJobVersionsPayload,
  loadEstimateCollectionPayload,
  loadEstimateCollectionRecentActivityPayload,
  loadEstimateCollectionSearchPayload,
  loadEstimateCollectionSummaryPayload,
  type EstimateCollectionVersionCopy,
} from '@/lib/server/estimate-collection/service'
import {
  serviceResultDataResponse,
  serviceResultMutationResponse,
} from '@/lib/server/routeResult'

export async function handleEstimateCollectionRouteGet() {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  return serviceResultDataResponse(await loadEstimateCollectionPayload(auth.session.orgId))
}

export async function handleEstimateHomeSummaryRouteGet() {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  return serviceResultDataResponse(await loadEstimateCollectionSummaryPayload(auth.session.orgId))
}

export async function handleEstimateHomeBootstrapRouteGet() {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  return serviceResultDataResponse(await loadEstimateCollectionBootstrapPayload(auth.session.orgId))
}

export async function handleEstimateHomeRecentActivityRouteGet() {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  return serviceResultDataResponse(
    await loadEstimateCollectionRecentActivityPayload(auth.session.orgId)
  )
}

export async function handleEstimateHomeJobCountsRouteGet() {
  return Response.json(
    { error: 'Quote home job-counts has been replaced by the paged jobs read model.' },
    { status: 410 }
  )
}

export async function handleEstimateHomeJobsRouteGet(request: Request) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const query = url.searchParams.get('q') ?? ''
  const cursor = url.searchParams.get('cursor')
  const limitValue = url.searchParams.get('limit')
  const limit = limitValue ? Number(limitValue) : undefined

  return serviceResultDataResponse(
    await loadEstimateCollectionJobsPayload(auth.session.orgId, {
      query,
      cursor,
      limit,
    })
  )
}

export async function handleEstimateHomeSearchRouteGet(request: Request) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const query = new URL(request.url).searchParams.get('q') ?? ''
  return serviceResultDataResponse(
    await loadEstimateCollectionSearchPayload(auth.session.orgId, query)
  )
}

export type EstimateJobVersionsRouteContext = {
  params: { jobId: string } | Promise<{ jobId: string }>
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
  const limitValue = url.searchParams.get('limit')
  const limit = limitValue ? Number(limitValue) : undefined

  return serviceResultDataResponse(
    await loadEstimateCollectionJobVersionsPayload(auth.session.orgId, jobId.value, {
      cursor,
      limit,
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
