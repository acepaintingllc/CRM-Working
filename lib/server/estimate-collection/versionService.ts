import { errorResult } from '../serviceResult'
import type { EstimateCollectionVersionCopy } from './types'
import {
  buildJobVersionsPageData,
  bytesForLog,
  decorateRowsForReadModel,
  logQuoteHomeRead,
  parseQuoteHomePageOptions,
} from './serviceHelpers.ts'
import {
  withEstimateCollectionServiceDeps,
  type EstimateCollectionServiceDeps,
} from './serviceDeps.ts'

export async function loadEstimateCollectionQuoteCreateContextPayload(
  orgId: string,
  jobId: string,
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const resolvedDeps = withEstimateCollectionServiceDeps(deps)
  const { buildQuoteCreateJobContextReadModel, loadEstimateCollectionJobContext } = resolvedDeps

  const startedAt = Date.now()
  const jobResult = await loadEstimateCollectionJobContext(orgId, jobId)
  if (!jobResult.ok) return jobResult
  if (!jobResult.data) {
    return errorResult('not_found', 'Job not found.')
  }

  const payload = buildQuoteCreateJobContextReadModel(jobResult.data)
  logQuoteHomeRead('quote-create-context', {
    orgId,
    jobId,
    durationMs: Date.now() - startedAt,
    eligible: payload.job.eligibility.eligible,
    payloadBytes: bytesForLog(payload),
  })

  return {
    ok: true as const,
    data: payload,
  }
}

export async function loadEstimateCollectionJobVersionsPayload(
  orgId: string,
  jobId: string,
  options: { limit?: number; cursor?: string | null } = {},
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const resolvedDeps = withEstimateCollectionServiceDeps(deps)
  const { buildQuoteJobVersionsReadModel, loadEstimateCollectionJobVersionsPage } = resolvedDeps

  const startedAt = Date.now()
  const pageOptions = parseQuoteHomePageOptions(options, true, resolvedDeps)
  if (!pageOptions.ok) return pageOptions

  const rowsResult = await loadEstimateCollectionJobVersionsPage(orgId, jobId, {
    limit: pageOptions.data.limit,
    cursor: pageOptions.data.cursor,
  })
  if (!rowsResult.ok) return rowsResult

  const versionsPage = buildJobVersionsPageData(rowsResult.data, resolvedDeps)
  const decoratedRowsResult = await decorateRowsForReadModel(
    orgId,
    versionsPage.items,
    true,
    resolvedDeps
  )
  if (!decoratedRowsResult.ok) return decoratedRowsResult

  const payload = buildQuoteJobVersionsReadModel(decoratedRowsResult.data, {
    jobId: versionsPage.jobId,
    totalVersions: versionsPage.totalVersions,
    limit: versionsPage.limit,
    nextCursor: versionsPage.nextCursor,
  })

  logQuoteHomeRead('job-versions', {
    orgId,
    jobId,
    durationMs: Date.now() - startedAt,
    items: payload.items.length,
    totalVersions: payload.total_versions,
    nextCursor: payload.next_cursor,
    payloadBytes: bytesForLog(payload),
  })

  return {
    ok: true as const,
    data: payload,
  }
}

export async function createEstimateCollectionVersion(
  params: {
    orgId: string
    userId: string
    body: Record<string, unknown>
    copy: EstimateCollectionVersionCopy
  },
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const { createEstimateCollectionVersionRecord } = withEstimateCollectionServiceDeps(deps)
  return createEstimateCollectionVersionRecord(params)
}
