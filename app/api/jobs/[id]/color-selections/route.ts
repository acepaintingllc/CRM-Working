import {
  jsonError,
  readJsonBody,
  requireSessionUserOrg,
} from '@/lib/server/apiRoute'
import { type JobIdRouteContext, readJobIdParam } from '@/lib/server/jobFeedbackRoute'
import { serviceResultMutationResponse, serviceResultDataResponse } from '@/lib/server/routeResult'
import {
  loadJobColorSelections,
  normalizeJobColorSelectionsDraftInput,
  saveJobColorSelections,
} from '@/lib/server/job-operations/colorSelections'

type RouteContext = JobIdRouteContext

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobIdParam(context)
  if (!jobId.ok) return jobId.response

  return serviceResultDataResponse(
    await loadJobColorSelections(session.session.orgId, jobId.value)
  )
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobIdParam(context)
  if (!jobId.ok) return jobId.response

  const body = await readJsonBody(request)
  if (!body.ok) return body.response

  const input = normalizeJobColorSelectionsDraftInput(body.value)
  if (!input.ok) return jsonError(input.message, 400)

  return serviceResultMutationResponse(
    await saveJobColorSelections({
      orgId: session.session.orgId,
      jobId: jobId.value,
      userId: session.session.userId,
      input: input.data,
    }),
    'Color selections saved.'
  )
}
