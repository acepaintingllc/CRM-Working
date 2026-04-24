import {
  buildQuoteHomeBootstrapReadModel,
  buildQuoteHomeJobsPageReadModel,
  buildQuoteHomeRecentActivityReadModel,
  buildQuoteHomeSearchReadModel,
  buildQuoteJobVersionsReadModel,
  buildQuoteListPayload,
} from '../../quotes/collectionData.ts'
import {
  createEstimateCollectionVersionRecord,
  decorateEstimateCollectionRows,
  loadEstimateCollectionJobVersionsPage,
  loadEstimateCollectionJobsPage,
  loadEstimateCollectionRowsForOrg,
  loadEstimateCollectionSummary,
  searchEstimateCollectionRows,
} from './repository.ts'
import { serverLog } from '@/lib/server/log'
import type { EstimateCollectionVersionCopy } from './types'

type EstimateCollectionServiceDeps = {
  buildQuoteHomeBootstrapReadModel: typeof buildQuoteHomeBootstrapReadModel
  buildQuoteHomeJobsPageReadModel: typeof buildQuoteHomeJobsPageReadModel
  buildQuoteHomeRecentActivityReadModel: typeof buildQuoteHomeRecentActivityReadModel
  buildQuoteHomeSearchReadModel: typeof buildQuoteHomeSearchReadModel
  buildQuoteJobVersionsReadModel: typeof buildQuoteJobVersionsReadModel
  buildQuoteListPayload: typeof buildQuoteListPayload
  createEstimateCollectionVersionRecord: typeof createEstimateCollectionVersionRecord
  decorateEstimateCollectionRows: typeof decorateEstimateCollectionRows
  loadEstimateCollectionJobVersionsPage: typeof loadEstimateCollectionJobVersionsPage
  loadEstimateCollectionJobsPage: typeof loadEstimateCollectionJobsPage
  loadEstimateCollectionRowsForOrg: typeof loadEstimateCollectionRowsForOrg
  loadEstimateCollectionSummary: typeof loadEstimateCollectionSummary
  searchEstimateCollectionRows: typeof searchEstimateCollectionRows
}

const defaultDeps: EstimateCollectionServiceDeps = {
  buildQuoteHomeBootstrapReadModel,
  buildQuoteHomeJobsPageReadModel,
  buildQuoteHomeRecentActivityReadModel,
  buildQuoteHomeSearchReadModel,
  buildQuoteJobVersionsReadModel,
  buildQuoteListPayload,
  createEstimateCollectionVersionRecord,
  decorateEstimateCollectionRows,
  loadEstimateCollectionJobVersionsPage,
  loadEstimateCollectionJobsPage,
  loadEstimateCollectionRowsForOrg,
  loadEstimateCollectionSummary,
  searchEstimateCollectionRows,
}

const HOME_BOOTSTRAP_JOB_LIMIT = 25
const HOME_VERSIONS_LIMIT = 25
const HOME_SEARCH_LIMIT = 8

function withDeps(overrides?: Partial<EstimateCollectionServiceDeps>): EstimateCollectionServiceDeps {
  return {
    ...defaultDeps,
    ...overrides,
  }
}

function bytesForLog(value: unknown) {
  try {
    return JSON.stringify(value).length
  } catch {
    return -1
  }
}

function logQuoteHomeRead(event: string, meta: Record<string, unknown>) {
  serverLog.info('[quote-home]', event, meta)
}

export async function loadEstimateCollectionPayload(
  orgId: string,
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const { loadEstimateCollectionRowsForOrg, decorateEstimateCollectionRows, buildQuoteListPayload } =
    withDeps(deps)

  const rowsResult = await loadEstimateCollectionRowsForOrg(orgId)
  if (!rowsResult.ok) return rowsResult

  const decoratedRowsResult = await decorateEstimateCollectionRows(orgId, rowsResult.data, {
    includeRollups: false,
  })
  if (!decoratedRowsResult.ok) return decoratedRowsResult

  return {
    ok: true as const,
    data: buildQuoteListPayload(decoratedRowsResult.data),
  }
}

export async function loadEstimateCollectionSummaryPayload(
  orgId: string,
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const { loadEstimateCollectionSummary } = withDeps(deps)

  const startedAt = Date.now()
  const summaryResult = await loadEstimateCollectionSummary(orgId)
  if (!summaryResult.ok) return summaryResult

  logQuoteHomeRead('summary', {
    orgId,
    durationMs: Date.now() - startedAt,
    totalVersions: summaryResult.data.total_versions,
    pipelineTotal: summaryResult.data.pipeline_total,
    payloadBytes: bytesForLog(summaryResult.data),
  })

  return summaryResult
}

export async function loadEstimateCollectionBootstrapPayload(
  orgId: string,
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const {
    buildQuoteHomeBootstrapReadModel,
    buildQuoteHomeJobsPageReadModel,
    buildQuoteJobVersionsReadModel,
    decorateEstimateCollectionRows,
    loadEstimateCollectionJobVersionsPage,
    loadEstimateCollectionJobsPage,
    loadEstimateCollectionSummary,
  } = withDeps(deps)

  const startedAt = Date.now()
  const [summaryResult, jobsResult] = await Promise.all([
    loadEstimateCollectionSummary(orgId),
    loadEstimateCollectionJobsPage(orgId, { limit: HOME_BOOTSTRAP_JOB_LIMIT }),
  ])
  if (!summaryResult.ok) return summaryResult
  if (!jobsResult.ok) return jobsResult

  const selectedJobId = jobsResult.data.items[0]?.id ?? null
  let selectedJobVersions = null

  if (selectedJobId) {
    const versionsResult = await loadEstimateCollectionJobVersionsPage(orgId, selectedJobId, {
      limit: HOME_VERSIONS_LIMIT,
    })
    if (!versionsResult.ok) return versionsResult

    const decoratedRowsResult = await decorateEstimateCollectionRows(orgId, versionsResult.data.items, {
      includeRollups: true,
    })
    if (!decoratedRowsResult.ok) return decoratedRowsResult

    selectedJobVersions = buildQuoteJobVersionsReadModel(decoratedRowsResult.data, {
      jobId: versionsResult.data.jobId,
      totalVersions: versionsResult.data.totalVersions,
      limit: versionsResult.data.limit,
      nextCursor: versionsResult.data.nextCursor,
    })
  }

  const payload = buildQuoteHomeBootstrapReadModel({
    summary: summaryResult.data,
    jobs: buildQuoteHomeJobsPageReadModel({
      query: jobsResult.data.query,
      limit: jobsResult.data.limit,
      nextCursor: jobsResult.data.nextCursor,
      items: jobsResult.data.items,
    }),
    selectedJobVersions,
  })

  logQuoteHomeRead('bootstrap', {
    orgId,
    durationMs: Date.now() - startedAt,
    jobsReturned: payload.jobs.items.length,
    selectedJobId: payload.selected_job_id,
    selectedJobVersions: payload.selected_job_versions?.items.length ?? 0,
    jobsNextCursor: payload.jobs.next_cursor,
    payloadBytes: bytesForLog(payload),
  })

  return {
    ok: true as const,
    data: payload,
  }
}

export async function loadEstimateCollectionRecentActivityPayload(
  orgId: string,
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const { loadEstimateCollectionRowsForOrg, decorateEstimateCollectionRows, buildQuoteHomeRecentActivityReadModel } =
    withDeps(deps)

  const startedAt = Date.now()
  const rowsResult = await loadEstimateCollectionRowsForOrg(orgId, { limit: 12 })
  if (!rowsResult.ok) return rowsResult

  const decoratedRowsResult = await decorateEstimateCollectionRows(orgId, rowsResult.data, {
    includeRollups: true,
  })
  if (!decoratedRowsResult.ok) return decoratedRowsResult

  const payload = buildQuoteHomeRecentActivityReadModel(decoratedRowsResult.data)
  logQuoteHomeRead('recent-activity', {
    orgId,
    durationMs: Date.now() - startedAt,
    items: payload.items.length,
    payloadBytes: bytesForLog(payload),
  })

  return {
    ok: true as const,
    data: payload,
  }
}

export async function loadEstimateCollectionSearchPayload(
  orgId: string,
  query: string,
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const { searchEstimateCollectionRows, decorateEstimateCollectionRows, buildQuoteHomeSearchReadModel } =
    withDeps(deps)

  const startedAt = Date.now()
  const rowsResult = await searchEstimateCollectionRows(orgId, query, HOME_SEARCH_LIMIT)
  if (!rowsResult.ok) return rowsResult

  const decoratedRowsResult = await decorateEstimateCollectionRows(orgId, rowsResult.data, {
    includeRollups: true,
  })
  if (!decoratedRowsResult.ok) return decoratedRowsResult

  const payload = buildQuoteHomeSearchReadModel(decoratedRowsResult.data, query)
  logQuoteHomeRead('search', {
    orgId,
    durationMs: Date.now() - startedAt,
    query: query.trim(),
    items: payload.items.length,
    payloadBytes: bytesForLog(payload),
  })

  return {
    ok: true as const,
    data: payload,
  }
}

export async function loadEstimateCollectionJobsPayload(
  orgId: string,
  options: { query?: string; limit?: number; cursor?: string | null },
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const { buildQuoteHomeJobsPageReadModel, loadEstimateCollectionJobsPage } = withDeps(deps)

  const startedAt = Date.now()
  const jobsResult = await loadEstimateCollectionJobsPage(orgId, options)
  if (!jobsResult.ok) return jobsResult

  const payload = buildQuoteHomeJobsPageReadModel({
    query: jobsResult.data.query,
    limit: jobsResult.data.limit,
    nextCursor: jobsResult.data.nextCursor,
    items: jobsResult.data.items,
  })

  logQuoteHomeRead('jobs', {
    orgId,
    durationMs: Date.now() - startedAt,
    query: payload.query,
    items: payload.items.length,
    nextCursor: payload.next_cursor,
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
  const { buildQuoteJobVersionsReadModel, decorateEstimateCollectionRows, loadEstimateCollectionJobVersionsPage } =
    withDeps(deps)

  const startedAt = Date.now()
  const rowsResult = await loadEstimateCollectionJobVersionsPage(orgId, jobId, options)
  if (!rowsResult.ok) return rowsResult

  const decoratedRowsResult = await decorateEstimateCollectionRows(orgId, rowsResult.data.items, {
    includeRollups: true,
  })
  if (!decoratedRowsResult.ok) return decoratedRowsResult

  const payload = buildQuoteJobVersionsReadModel(decoratedRowsResult.data, {
    jobId: rowsResult.data.jobId,
    totalVersions: rowsResult.data.totalVersions,
    limit: rowsResult.data.limit,
    nextCursor: rowsResult.data.nextCursor,
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
  const { createEstimateCollectionVersionRecord } = withDeps(deps)
  return createEstimateCollectionVersionRecord(params)
}

export type { EstimateCollectionVersionCopy } from './types'
