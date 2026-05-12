import { jsonError, readJsonBody, requireSessionUserOrg } from '@/lib/server/apiRoute'
import { serviceResultDataResponse, serviceResultMutationResponse } from '@/lib/server/routeResult'
import {
  createEstimateTemplate,
  listEstimateTemplates,
} from '@/lib/server/estimate-templates/service'

const TEMPLATE_BODY_MAX_BYTES = 1024 * 1024

export async function GET(request: Request) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const result = await listEstimateTemplates(
    auth.session.orgId,
    new URL(request.url).searchParams
  )
  return serviceResultDataResponse(result)
}

export async function POST(request: Request) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const body = await readJsonBody(request, { maxBytes: TEMPLATE_BODY_MAX_BYTES })
  if (!body.ok) return body.response

  const result = await createEstimateTemplate(auth.session.orgId, auth.session.userId, body.value)
  if (!result.ok && result.kind === 'invalid_input') {
    return jsonError(result.message, 400)
  }
  return serviceResultMutationResponse(result, 'Template saved.')
}
