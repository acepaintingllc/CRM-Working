import {
  jsonError,
  readJsonBody,
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'
import { serviceResultMutationResponse } from '@/lib/server/routeResult'
import { updateEstimateTemplate } from '@/lib/server/estimate-templates/service'

const TEMPLATE_BODY_MAX_BYTES = 1024 * 1024

type EstimateTemplateRouteContext = {
  params: { id: string } | Promise<{ id: string }>
}

export async function PATCH(request: Request, context: EstimateTemplateRouteContext) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await resolveParams(context)
  const templateId = readUuidParam(params?.id, 'template id')
  if (!templateId.ok) return templateId.response

  const body = await readJsonBody(request, { maxBytes: TEMPLATE_BODY_MAX_BYTES })
  if (!body.ok) return body.response

  const result = await updateEstimateTemplate(
    auth.session.orgId,
    auth.session.userId,
    templateId.value,
    body.value
  )
  if (!result.ok && result.kind === 'invalid_input') {
    return jsonError(result.message, 400)
  }
  return serviceResultMutationResponse(result, 'Template updated.')
}
