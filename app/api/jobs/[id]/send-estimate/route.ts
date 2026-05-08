import {
  readJsonBody,
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'
import { mutationResponse, serviceErrorResponse } from '@/lib/server/routeResult'
import {
  normalizeSendJobStageEmailInput,
  sendJobStageEmail,
} from '@/lib/server/jobStageEmailWorkflow'

async function readJobId(context: { params: { id: string } | Promise<{ id: string }> }) {
  const params = await resolveParams(context)
  return readUuidParam((params as { id?: string } | null | undefined)?.id, 'job id')
}

function makeLegacyIdempotencyKey(jobId: string) {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `legacy-send-estimate:job:${jobId}:${suffix}`
}

function mapLegacySendEstimateBody(body: Record<string, unknown> | null, jobId: string) {
  return {
    stage: 'estimate_sent',
    subject: typeof body?.subject === 'string' ? body.subject : undefined,
    body: typeof body?.body === 'string' ? body.body : undefined,
    estimate_file_ids: Array.isArray(body?.estimate_file_ids)
      ? body.estimate_file_ids
      : typeof body?.estimate_file_id === 'string'
      ? [body.estimate_file_id]
      : [],
    idempotency_key:
      typeof body?.idempotency_key === 'string'
        ? body.idempotency_key
        : typeof body?.idempotencyKey === 'string'
        ? body.idempotencyKey
        : makeLegacyIdempotencyKey(jobId),
  }
}

export async function POST(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobId(context)
  if (!jobId.ok) return jobId.response

  const parsedBody = await readJsonBody<Record<string, unknown> | null>(request, {
    allowEmpty: true,
    maxBytes: 96 * 1024,
  })
  if (!parsedBody.ok) return parsedBody.response

  const input = normalizeSendJobStageEmailInput(
    mapLegacySendEstimateBody(parsedBody.value, jobId.value)
  )
  if (!input.ok) return serviceErrorResponse(input)

  const result = await sendJobStageEmail({
    orgId: session.session.orgId,
    userId: session.session.userId,
    origin: new URL(request.url).origin,
    jobId: jobId.value,
    input: input.data,
  })

  if (!result.ok) return serviceErrorResponse(result, { status: result.status })

  const { notice, ...data } = result.data
  return mutationResponse(data, notice, { status: result.status ?? 200 })
}
