import { readJsonBody, requireSessionUserOrg } from '@/lib/server/apiRoute'
import { serviceErrorResponse, serviceResultResponse } from '@/lib/server/routeResult'
import {
  createJob,
  listJobs,
  normalizeCreateJobInput,
} from '@/lib/jobs/service'

export async function GET() {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  return serviceResultResponse(await listJobs(session.session.orgId), (jobs) => ({
    data: jobs,
  }))
}

export async function POST(request: Request) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const parsed = await readJsonBody<Record<string, unknown>>(request, { maxBytes: 128 * 1024 })
  if (!parsed.ok) return parsed.response

  const input = normalizeCreateJobInput(parsed.value)
  if (!input.ok) return serviceErrorResponse(input)

  return serviceResultResponse(await createJob(session.session.orgId, input.data), (job) => ({
    data: job,
    notice: 'Job created.',
  }))
}
