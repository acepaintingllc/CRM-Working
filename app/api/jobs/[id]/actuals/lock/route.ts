import {
  jsonError,
  readJsonBody,
  requireSessionUserOrg,
} from '@/lib/server/apiRoute'
import {
  type JobIdRouteContext,
  readEstimateSnapshotIdFromBody,
  readJobIdParam,
} from '@/lib/server/jobFeedbackRoute'
import { serviceResultResponse } from '@/lib/server/routeResult'
import {
  lockJobActuals,
  normalizeActualsSnapshotId,
} from '@/lib/server/estimate-feedback/actuals'

type RouteContext = JobIdRouteContext

export async function POST(request: Request, context: RouteContext) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobIdParam(context)
  if (!jobId.ok) return jobId.response

  const body = await readJsonBody(request)
  if (!body.ok) return body.response

  const estimateSnapshotId = readEstimateSnapshotIdFromBody(body.value, normalizeActualsSnapshotId)
  if (!estimateSnapshotId.ok) return jsonError(estimateSnapshotId.message, 400)

  return serviceResultResponse(
    await lockJobActuals({
      orgId: session.session.orgId,
      jobId: jobId.value,
      userId: session.session.userId,
      estimateSnapshotId: estimateSnapshotId.data,
    }),
    (data) => ({ data, notice: 'Job actuals locked.' })
  )
}
