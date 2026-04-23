import {
  jsonError,
  readJsonBody,
  requireSessionUserOrg,
} from '@/lib/server/apiRoute'
import {
  applyRatesFlagsMutation,
  parseRatesFlagsMutationRequest,
  readRatesFlagsPayload,
} from '@/lib/server/rates-flags'
import { dataResponse, mutationResponse } from '@/lib/server/routeResult'

export async function handleRatesFlagsRouteGet(request: Request) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  try {
    const payload = await readRatesFlagsPayload({
      origin: new URL(request.url).origin,
      orgId: auth.session.orgId,
      userId: auth.session.userId,
    })
    return dataResponse(payload)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load rates and flags.'
    return jsonError(message, 400)
  }
}

export async function handleRatesFlagsRouteMutation(request: Request) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const body = await readJsonBody<unknown>(request)
  if (!body.ok) return body.response

  const parsed = parseRatesFlagsMutationRequest(body.value)
  if (!parsed.ok) return jsonError(parsed.error, 400)

  try {
    const result = await applyRatesFlagsMutation({
      origin: new URL(request.url).origin,
      orgId: auth.session.orgId,
      userId: auth.session.userId,
      request: parsed.value,
    })
    if (!result.ok) return jsonError(result.error, result.status)
    return mutationResponse(true)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save rates and flags.'
    return jsonError(message, 400)
  }
}
