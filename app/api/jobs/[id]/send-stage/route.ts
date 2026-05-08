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

export async function POST(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobId(context)
  if (!jobId.ok) return jobId.response

  const parsedBody = await readJsonBody<Record<string, unknown>>(request, { maxBytes: 96 * 1024 })
  if (!parsedBody.ok) return parsedBody.response

  const input = normalizeSendJobStageEmailInput(parsedBody.value)
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
