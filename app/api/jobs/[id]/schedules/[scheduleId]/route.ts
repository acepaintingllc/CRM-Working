import { readUuidParam, requireSessionUserOrg, resolveParams } from '@/lib/server/apiRoute'
import { serviceResultResponse } from '@/lib/server/routeResult'
import { deleteJobSchedule } from '@/lib/server/jobScheduleWorkflow'

type ScheduleParams = { id: string; scheduleId: string }

async function readScheduleParams(context: { params: ScheduleParams | Promise<ScheduleParams> }) {
  const params = await resolveParams(context)
  const jobId = readUuidParam((params as Partial<ScheduleParams> | null | undefined)?.id, 'job id')
  if (!jobId.ok) return jobId

  const scheduleId = readUuidParam(
    (params as Partial<ScheduleParams> | null | undefined)?.scheduleId,
    'schedule id'
  )
  if (!scheduleId.ok) return scheduleId

  return { ok: true as const, jobId: jobId.value, scheduleId: scheduleId.value }
}

export async function DELETE(
  request: Request,
  context: { params: ScheduleParams | Promise<ScheduleParams> }
) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const params = await readScheduleParams(context)
  if (!params.ok) return params.response

  return serviceResultResponse(
    await deleteJobSchedule({
      orgId: session.session.orgId,
      userId: session.session.userId,
      origin: new URL(request.url).origin,
      jobId: params.jobId,
      scheduleId: params.scheduleId,
    }),
    (result) => ({ data: result, notice: 'Schedule deleted.' })
  )
}
