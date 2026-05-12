import {
  jsonError,
  readJsonBody,
  requireSessionUserOrg,
} from '@/lib/server/apiRoute'
import { type JobIdRouteContext, readJobIdParam } from '@/lib/server/jobFeedbackRoute'
import { serviceResultDataResponse, serviceResultMutationResponse } from '@/lib/server/routeResult'
import {
  loadJobInvoice,
  normalizeInvoicePatchInput,
  patchJobInvoice,
} from '@/lib/server/job-operations/invoices'

type RouteContext = JobIdRouteContext

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobIdParam(context)
  if (!jobId.ok) return jobId.response

  return serviceResultDataResponse(
    await loadJobInvoice(session.session.orgId, jobId.value)
  )
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobIdParam(context)
  if (!jobId.ok) return jobId.response

  const body = await readJsonBody(request)
  if (!body.ok) return body.response

  const input = normalizeInvoicePatchInput(body.value)
  if (!input.ok) return jsonError(input.message, 400)

  return serviceResultMutationResponse(
    await patchJobInvoice({
      orgId: session.session.orgId,
      jobId: jobId.value,
      userId: session.session.userId,
      input: input.data,
    }),
    'Invoice updated.'
  )
}
