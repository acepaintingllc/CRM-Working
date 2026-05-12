import { requireSessionUserOrg } from '@/lib/server/apiRoute'
import { type JobIdRouteContext, readJobIdParam } from '@/lib/server/jobFeedbackRoute'
import { serviceResultMutationResponse } from '@/lib/server/routeResult'
import { lockJobWorkOrder } from '@/lib/server/job-operations/workOrders'

type RouteContext = JobIdRouteContext

export async function POST(_request: Request, context: RouteContext) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobIdParam(context)
  if (!jobId.ok) return jobId.response

  return serviceResultMutationResponse(
    await lockJobWorkOrder({
      orgId: session.session.orgId,
      jobId: jobId.value,
      userId: session.session.userId,
    }),
    'Work order locked.'
  )
}
