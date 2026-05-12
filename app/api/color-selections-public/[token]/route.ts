import { jsonError, readJsonBody, resolveParams } from '@/lib/server/apiRoute'
import { serviceResultMutationResponse, serviceResultDataResponse } from '@/lib/server/routeResult'
import {
  loadPublicJobColorSelections,
  normalizeJobColorSelectionsDraftInput,
  savePublicJobColorSelections,
} from '@/lib/server/job-operations/colorSelections'

type RouteContext = {
  params: { token?: string } | Promise<{ token?: string }>
}

async function readToken(context: RouteContext) {
  const params = await resolveParams(context)
  const token = typeof params?.token === 'string' ? params.token.trim() : ''
  return token || null
}

export async function GET(_request: Request, context: RouteContext) {
  const token = await readToken(context)
  if (!token) return jsonError('Missing color selection token.', 400)

  return serviceResultDataResponse(await loadPublicJobColorSelections(token))
}

export async function PATCH(request: Request, context: RouteContext) {
  const token = await readToken(context)
  if (!token) return jsonError('Missing color selection token.', 400)

  const body = await readJsonBody(request)
  if (!body.ok) return body.response

  const input = normalizeJobColorSelectionsDraftInput(body.value)
  if (!input.ok) return jsonError(input.message, 400)

  return serviceResultMutationResponse(
    await savePublicJobColorSelections(token, input.data),
    'Color selections saved.'
  )
}
