import {
  readJsonBody,
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'
import { serviceErrorResponse, serviceResultResponse } from '@/lib/server/routeResult'
import {
  createJobSchedule,
  listJobSchedules,
  normalizeCreateJobScheduleInput,
} from '@/lib/server/jobScheduleWorkflow'

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

  return serviceResultResponse(
    await listJobSchedules(session.session.orgId, jobId.value),
    (schedules) => ({ data: schedules })
  )
}

export async function POST(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobId(context)
  if (!jobId.ok) return jobId.response

  const parsed = await readJsonBody<Record<string, unknown>>(request, { maxBytes: 64 * 1024 })
  if (!parsed.ok) return parsed.response

  const input = normalizeCreateJobScheduleInput(parsed.value)
  if (!input.ok) return serviceErrorResponse(input)

  return serviceResultResponse(
    await createJobSchedule(session.session.orgId, jobId.value, input.data),
    (schedule) => ({ data: schedule, notice: 'Schedule added.' })
  )
}
