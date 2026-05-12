import {
  jsonError,
  readJsonBody,
  requireSessionUserOrg,
} from '@/lib/server/apiRoute'
import { type JobIdRouteContext, readJobIdParam } from '@/lib/server/jobFeedbackRoute'
import { serviceResultMutationResponse } from '@/lib/server/routeResult'
import {
  confirmJobColorSelections,
  normalizeColorSelectionConfirmInput,
} from '@/lib/server/job-operations/colorSelections'

type RouteContext = JobIdRouteContext

export async function POST(request: Request, context: RouteContext) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobIdParam(context)
  if (!jobId.ok) return jobId.response

  const body = await readJsonBody(request)
  if (!body.ok) return body.response

  const input = normalizeColorSelectionConfirmInput(body.value)
  if (!input.ok) return jsonError(input.message, 400)

  return serviceResultMutationResponse(
    await confirmJobColorSelections({
      orgId: session.session.orgId,
      jobId: jobId.value,
      userId: session.session.userId,
      status: input.data.status,
    }),
    input.data.status === 'confirmed'
      ? 'Color selections confirmed.'
      : 'Color selections marked for revision.'
  )
}
