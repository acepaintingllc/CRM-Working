import {
  readJsonBody,
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'
import { serviceErrorResponse, serviceResultResponse } from '@/lib/server/routeResult'
import {
  listJobPaintLogs,
  normalizeReplaceJobPaintLogsInput,
  replaceJobPaintLogs,
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

  return serviceResultResponse(
    await listJobPaintLogs(session.session.orgId, jobId.value),
    (rows) => ({ data: rows })
  )
}

export async function PUT(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobId(context)
  if (!jobId.ok) return jobId.response

  const parsed = await readJsonBody<Record<string, unknown>>(request, { maxBytes: 128 * 1024 })
  if (!parsed.ok) return parsed.response

  const input = normalizeReplaceJobPaintLogsInput(parsed.value)
  if (!input.ok) return serviceErrorResponse(input)

  return serviceResultResponse(
    await replaceJobPaintLogs(session.session.orgId, jobId.value, input.data),
    (rows) => ({ data: rows, notice: 'Paint log saved.' })
  )
}
