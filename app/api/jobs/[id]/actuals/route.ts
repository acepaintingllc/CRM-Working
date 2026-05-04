import {
  jsonError,
  readJsonBody,
  requireSessionUserOrg,
} from '@/lib/server/apiRoute'
import {
  type JobIdRouteContext,
  readEstimateSnapshotIdFromUrl,
  readJobIdParam,
} from '@/lib/server/jobFeedbackRoute'
import { serviceResultResponse } from '@/lib/server/routeResult'
import {
  loadJobActuals,
  normalizeActualsSnapshotId,
  normalizeJobActualsDraftInput,
  saveDraftJobActuals,
} from '@/lib/server/estimate-feedback/actuals'

type RouteContext = JobIdRouteContext

export async function GET(request: Request, context: RouteContext) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobIdParam(context)
  if (!jobId.ok) return jobId.response

  const estimateSnapshotId = readEstimateSnapshotIdFromUrl(request, normalizeActualsSnapshotId)
  if (!estimateSnapshotId.ok) return jsonError(estimateSnapshotId.message, 400)

  return serviceResultResponse(
    await loadJobActuals(session.session.orgId, jobId.value, estimateSnapshotId.data),
    (data) => ({ data })
  )
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobIdParam(context)
  if (!jobId.ok) return jobId.response

  const body = await readJsonBody(request)
  if (!body.ok) return body.response

  const input = normalizeJobActualsDraftInput(body.value)
  if (!input.ok) return jsonError(input.message, 400)

  return serviceResultResponse(
    await saveDraftJobActuals({
      orgId: session.session.orgId,
      jobId: jobId.value,
      userId: session.session.userId,
      input: input.data,
    }),
    (data) => ({ data, notice: 'Job actuals saved.' })
  )
}
