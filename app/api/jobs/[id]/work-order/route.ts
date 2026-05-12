import { requireSessionUserOrg } from '@/lib/server/apiRoute'
import { type JobIdRouteContext, readJobIdParam } from '@/lib/server/jobFeedbackRoute'
import { serviceResultDataResponse } from '@/lib/server/routeResult'
import { loadJobWorkOrder } from '@/lib/server/job-operations/workOrders'

type RouteContext = JobIdRouteContext

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobIdParam(context)
  if (!jobId.ok) return jobId.response

  return serviceResultDataResponse(
    await loadJobWorkOrder(session.session.orgId, jobId.value)
  )
}
