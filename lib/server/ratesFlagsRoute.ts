import {
  jsonError,
  readJsonBody,
  requireSessionUserOrg,
} from '@/lib/server/apiRoute'
import {
  parseRatesFlagsBatchPublishRequest,
  publishRatesFlagsBatch,
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

export async function handleRatesFlagsRouteBatchPublish(request: Request) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const body = await readJsonBody<unknown>(request)
  if (!body.ok) return body.response

  const parsed = parseRatesFlagsBatchPublishRequest(body.value)
  if (!parsed.ok) return jsonError(parsed.error, 400)

  try {
    const result = await publishRatesFlagsBatch({
      origin: new URL(request.url).origin,
      orgId: auth.session.orgId,
      userId: auth.session.userId,
      mutations: parsed.value.mutations,
      reason: parsed.value.reason,
    })
    if (!result.ok) return jsonError(result.error, result.status)
    return mutationResponse(result.data.payload, 'Rates and flags published.')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to publish rates and flags.'
    return jsonError(message, 400)
  }
}
