import { readUuidParam, requireSessionUserOrg, resolveParams } from '@/lib/server/apiRoute'
import { serviceResultResponse } from '@/lib/server/routeResult'
import { addJobSchedulesToCalendar } from '@/lib/server/jobScheduleWorkflow'

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

  return serviceResultResponse(
    await addJobSchedulesToCalendar({
      orgId: session.session.orgId,
      userId: session.session.userId,
      origin: new URL(request.url).origin,
      jobId: jobId.value,
    }),
    (results) => ({ data: results, notice: 'Added schedules to calendar.' })
  )
}
