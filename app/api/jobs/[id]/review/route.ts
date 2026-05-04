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
  loadJobReview,
  normalizeJobReviewInput,
  normalizeReviewSnapshotId,
  saveJobReview,
} from '@/lib/server/estimate-feedback/reviews'

type RouteContext = JobIdRouteContext

export async function GET(request: Request, context: RouteContext) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobIdParam(context)
  if (!jobId.ok) return jobId.response

  const estimateSnapshotId = readEstimateSnapshotIdFromUrl(request, normalizeReviewSnapshotId)
  if (!estimateSnapshotId.ok) return jsonError(estimateSnapshotId.message, 400)

  return serviceResultResponse(
    await loadJobReview(session.session.orgId, jobId.value, estimateSnapshotId.data),
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

  const input = normalizeJobReviewInput(body.value)
  if (!input.ok) return jsonError(input.message, 400)

  return serviceResultResponse(
    await saveJobReview({
      orgId: session.session.orgId,
      jobId: jobId.value,
      userId: session.session.userId,
      input: input.data,
    }),
    (data) => ({ data, notice: 'Job review saved.' })
  )
}
