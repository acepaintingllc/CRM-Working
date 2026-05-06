import { requireSessionUserOrg } from '@/lib/server/apiRoute'
import { serviceResultResponse } from '@/lib/server/routeResult'
import { repairAcceptedEstimateSnapshotForJob } from '@/lib/server/accepted-estimates/service'
import { readJobIdParam, type JobIdRouteContext } from '@/lib/server/jobFeedbackRoute'

type RouteContext = JobIdRouteContext

export async function POST(request: Request, context: RouteContext) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobIdParam(context)
  if (!jobId.ok) return jobId.response

  const origin = new URL(request.url).origin
  return serviceResultResponse(
    await repairAcceptedEstimateSnapshotForJob({
      requestOrigin: origin,
      orgId: session.session.orgId,
      userId: session.session.userId,
      jobId: jobId.value,
    }),
    (data) => ({ data, notice: 'Accepted quote snapshot repaired.' })
  )
}
