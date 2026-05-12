import {
  jsonError,
  readJsonBody,
  requireSessionUserOrg,
} from '@/lib/server/apiRoute'
import { type JobIdRouteContext, readJobIdParam } from '@/lib/server/jobFeedbackRoute'
import { serviceResultMutationResponse } from '@/lib/server/routeResult'
import {
  generateJobWorkOrder,
  normalizeWorkOrderGenerateInput,
} from '@/lib/server/job-operations/workOrders'

type RouteContext = JobIdRouteContext

export async function POST(request: Request, context: RouteContext) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobIdParam(context)
  if (!jobId.ok) return jobId.response

  const body = await readJsonBody(request, { allowEmpty: true })
  if (!body.ok) return body.response

  const input = normalizeWorkOrderGenerateInput(body.value)
  if (!input.ok) return jsonError(input.message, 400)

  return serviceResultMutationResponse(
    await generateJobWorkOrder({
      orgId: session.session.orgId,
      jobId: jobId.value,
      userId: session.session.userId,
      input: input.data,
    }),
    input.data.force_with_warnings
      ? 'Work order generated with warnings.'
      : 'Work order generated.'
  )
}
