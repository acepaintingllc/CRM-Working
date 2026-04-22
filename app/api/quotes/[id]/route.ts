import {
  jsonError,
  readJsonBody,
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'
import {
  deleteEstimateV2,
  EstimateV2RouteServiceError,
  loadEstimateV2Response,
  saveEstimateV2Inputs,
} from '@/lib/server/estimateV2RouteService'
import { dataResponse, mutationResponse } from '@/lib/server/routeResult'

type EstimateRouteContext = { params: { id: string } | Promise<{ id: string }> }

function toErrorResponse(error: unknown) {
  if (error instanceof EstimateV2RouteServiceError) {
    return jsonError(error.message, error.status)
  }
  const message = error instanceof Error ? error.message : 'Estimate API request failed'
  return jsonError(message, 500)
}

export async function GET(request: Request, context: EstimateRouteContext) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await resolveParams(context)
  const estimateId = readUuidParam(params?.id, 'estimate id')
  if (!estimateId.ok) return estimateId.response

  try {
    const payload = await loadEstimateV2Response({
      requestOrigin: new URL(request.url).origin,
      orgId: auth.session.orgId,
      userId: auth.session.userId,
      estimateId: estimateId.value,
    })
    return dataResponse(payload)
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function PUT(request: Request, context: EstimateRouteContext) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await resolveParams(context)
  const estimateId = readUuidParam(params?.id, 'estimate id')
  if (!estimateId.ok) return estimateId.response

  const body = await readJsonBody(request)
  if (!body.ok) return body.response

  try {
    const payload = await saveEstimateV2Inputs({
      requestOrigin: new URL(request.url).origin,
      orgId: auth.session.orgId,
      userId: auth.session.userId,
      estimateId: estimateId.value,
      body: (body.value ?? {}) as Record<string, unknown>,
      autosaveOnly: (request.headers.get('x-estimate-save-mode')?.toLowerCase() ?? 'manual') === 'auto',
    })
    return mutationResponse(payload)
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function DELETE(_request: Request, context: EstimateRouteContext) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await resolveParams(context)
  const estimateId = readUuidParam(params?.id, 'estimate id')
  if (!estimateId.ok) return estimateId.response

  try {
    const payload = await deleteEstimateV2({
      orgId: auth.session.orgId,
      estimateId: estimateId.value,
    })
    return mutationResponse(payload, 'Quote deleted.')
  } catch (error) {
    return toErrorResponse(error)
  }
}
