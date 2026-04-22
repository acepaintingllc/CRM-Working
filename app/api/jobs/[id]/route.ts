import {
  readJsonBody,
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'
import { serviceErrorResponse, serviceResultResponse } from '@/lib/server/routeResult'
import {
  deleteJob,
  getJobDetail,
  normalizeUpdateJobInput,
  updateJob,
} from '@/lib/jobs/service'

async function readJobId(context: { params: { id: string } | Promise<{ id: string }> }) {
  const params = await resolveParams(context)
  return readUuidParam((params as { id?: string } | null | undefined)?.id, 'job id')
}

export async function GET(
  _request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobId(context)
  if (!jobId.ok) return jobId.response

  return serviceResultResponse(await getJobDetail(session.session.orgId, jobId.value), (job) => ({
    data: job,
  }))
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobId(context)
  if (!jobId.ok) return jobId.response

  const parsed = await readJsonBody<Record<string, unknown>>(request, { maxBytes: 128 * 1024 })
  if (!parsed.ok) return parsed.response

  const input = normalizeUpdateJobInput(parsed.value)
  if (!input.ok) return serviceErrorResponse(input)

  return serviceResultResponse(
    await updateJob(session.session.orgId, jobId.value, input.data),
    (job) => ({
      data: job,
      notice: 'Job updated.',
    })
  )
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobId(context)
  if (!jobId.ok) return jobId.response

  return serviceResultResponse(await deleteJob(session.session.orgId, jobId.value), (result) => ({
    data: result,
    notice: 'Job deleted.',
  }))
}
