import {
  jsonError,
  readJsonBody,
  requireSessionUserOrg,
} from '@/lib/server/apiRoute'
import {
  activateRatesFlagsDraft,
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

export async function handleRatesFlagsRouteActivate(request: Request) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const body = await readJsonBody<unknown>(request)
  if (!body.ok) return body.response
  const raw = body.value && typeof body.value === 'object'
    ? (body.value as Record<string, unknown>)
    : {}
  const settingSetId =
    typeof raw.setting_set_id === 'string' && raw.setting_set_id.trim()
      ? raw.setting_set_id.trim()
      : null
  const reason =
    typeof raw.reason === 'string' && raw.reason.trim() ? raw.reason.trim() : undefined

  try {
    const result = await activateRatesFlagsDraft({
      origin: new URL(request.url).origin,
      orgId: auth.session.orgId,
      userId: auth.session.userId,
      settingSetId,
      reason,
    })
    if (!result.ok) return jsonError(result.error, result.status)
    return mutationResponse(true, 'Rates and flags draft activated.')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to activate rates and flags.'
    return jsonError(message, 400)
  }
}
