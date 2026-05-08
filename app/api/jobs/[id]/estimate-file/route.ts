import { NextResponse } from 'next/server'
import {
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'
import {
  getLatestJobEstimateFile,
  listMatchingJobEstimateFiles,
} from '@/lib/jobs/estimateFiles'
import { serverLog } from '@/lib/server/log'
import { dataResponse, serviceErrorResponse } from '@/lib/server/routeResult'

export async function GET(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const params = await resolveParams(context)
  const jobId = readUuidParam((params as { id?: string } | null | undefined)?.id, 'job id')
  if (!jobId.ok) return jobId.response

  const origin = new URL(request.url).origin
  const url = new URL(request.url)
  const includeAll = url.searchParams.get('all') === '1'

  if (includeAll) {
    const result = await listMatchingJobEstimateFiles({
      origin,
      orgId: session.session.orgId,
      userId: session.session.userId,
      jobId: jobId.value,
    })
    if (!result.ok) {
      if (result.kind === 'not_found') {
        serverLog.warn('[estimate-file] no-match', { jobId: jobId.value, reason: result.message })
      }
      return serviceErrorResponse(result)
    }
    return dataResponse(result.data)
  }

  const result = await getLatestJobEstimateFile({
    origin,
    orgId: session.session.orgId,
    userId: session.session.userId,
    jobId: jobId.value,
  })

  if (!result.ok) {
    if (result.kind === 'not_found') {
      serverLog.warn('[estimate-file] no-match', { jobId: jobId.value, reason: result.message })
    }
    return serviceErrorResponse(result)
  }

  serverLog.info('[estimate-file] selected', {
    jobId: jobId.value,
    fileId: result.data.id,
    fileName: result.data.name,
    version: result.data.version ?? null,
    matchMode: result.data.matchMode ?? null,
  })

  const shouldRedirect = url.searchParams.get('redirect') === '1'
  // Redirect is the route-only exception for legacy callers that need to open Drive directly.
  if (shouldRedirect && result.data.webViewLink) {
    return NextResponse.redirect(result.data.webViewLink)
  }

  return dataResponse(result.data)
}
