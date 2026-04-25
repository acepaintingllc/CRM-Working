import {
  readJsonBody,
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from './apiRoute.ts'
import {
  createEstimateProduct,
  deleteEstimateProduct,
  isEstimateProductValidationFailure,
  listEstimateProducts,
  updateEstimateProduct,
} from './estimate-products/service.ts'
import {
  serviceResultDataResponse,
  serviceResultMutationResponse,
} from './routeResult.ts'

type EstimateProductRouteContext = {
  params: { id: string } | Promise<{ id: string }>
}

function validationErrorResponse(validation: { summary?: string | null }) {
  return Response.json(
    { error: validation.summary ?? 'Invalid product payload.' },
    { status: 400 }
  )
}

export async function handleEstimateProductsRouteGet(request?: Request) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  return serviceResultDataResponse(
    await listEstimateProducts(auth.session.orgId, request ? new URL(request.url).searchParams : null)
  )
}

export async function handleEstimateProductsRoutePost(request: Request) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const body = await readJsonBody<Record<string, unknown>>(request)
  if (!body.ok) return body.response

  const result = await createEstimateProduct(auth.session.orgId, body.value)
  if (isEstimateProductValidationFailure(result)) {
    return validationErrorResponse({
      summary: result.message,
    })
  }

  return serviceResultMutationResponse(result, 'Product created.', { status: 201 })
}

export async function handleEstimateProductRoutePatch(
  request: Request,
  context: EstimateProductRouteContext
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await resolveParams(context)
  const idResult = readUuidParam(params?.id, 'product id')
  if (!idResult.ok) return idResult.response

  const bodyResult = await readJsonBody<Record<string, unknown>>(request)
  if (!bodyResult.ok) return bodyResult.response

  const result = await updateEstimateProduct(auth.session.orgId, idResult.value, bodyResult.value)
  if (isEstimateProductValidationFailure(result)) {
    return validationErrorResponse({
      summary: result.message,
    })
  }

  return serviceResultMutationResponse(result, 'Product updated.')
}

export async function handleEstimateProductRouteDelete(
  _request: Request,
  context: EstimateProductRouteContext
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await resolveParams(context)
  const idResult = readUuidParam(params?.id, 'product id')
  if (!idResult.ok) return idResult.response

  return serviceResultMutationResponse(
    await deleteEstimateProduct(auth.session.orgId, idResult.value),
    'Product permanently deleted.'
  )
}
