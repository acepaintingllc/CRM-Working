import {
  buildQuoteHomeBootstrapReadModel,
  buildQuoteHomeJobsPageReadModel,
  buildQuoteHomeRecentActivityReadModel,
  buildQuoteHomeSummaryFromRow,
  buildQuoteHomeSearchReadModel,
  buildQuoteJobVersionsReadModel,
  buildQuoteListPayload,
  decorateEstimateCollectionRows,
  selectQuoteHomeSearchRows,
  toQuoteHomeEligibleJobReadModel,
} from '../../quotes/collectionData.ts'
import {
  createEstimateCollectionVersionRecord,
  encodeQuoteHomeCursor,
  loadEstimateCollectionJobVersionsPage,
  loadEstimateCollectionJobsPage,
  loadEstimateCollectionRelatedRows,
  loadEstimateCollectionRowsForOrg,
  loadEstimateCollectionSummary,
  searchEstimateCollectionRows,
} from './repository.ts'
import { serverLog } from '@/lib/server/log'
import type { EstimateCollectionVersionCopy, EstimateCollectionVersionRow, QuoteHomeJobsPageRow } from './types'

type EstimateCollectionServiceDeps = {
  buildQuoteHomeBootstrapReadModel: typeof buildQuoteHomeBootstrapReadModel
  buildQuoteHomeJobsPageReadModel: typeof buildQuoteHomeJobsPageReadModel
  buildQuoteHomeRecentActivityReadModel: typeof buildQuoteHomeRecentActivityReadModel
  buildQuoteHomeSummaryFromRow: typeof buildQuoteHomeSummaryFromRow
  buildQuoteHomeSearchReadModel: typeof buildQuoteHomeSearchReadModel
  buildQuoteJobVersionsReadModel: typeof buildQuoteJobVersionsReadModel
  buildQuoteListPayload: typeof buildQuoteListPayload
  createEstimateCollectionVersionRecord: typeof createEstimateCollectionVersionRecord
  decorateEstimateCollectionRows: typeof decorateEstimateCollectionRows
  encodeQuoteHomeCursor: typeof encodeQuoteHomeCursor
  loadEstimateCollectionJobVersionsPage: typeof loadEstimateCollectionJobVersionsPage
  loadEstimateCollectionJobsPage: typeof loadEstimateCollectionJobsPage
  loadEstimateCollectionRelatedRows: typeof loadEstimateCollectionRelatedRows
  loadEstimateCollectionRowsForOrg: typeof loadEstimateCollectionRowsForOrg
  loadEstimateCollectionSummary: typeof loadEstimateCollectionSummary
  selectQuoteHomeSearchRows: typeof selectQuoteHomeSearchRows
  searchEstimateCollectionRows: typeof searchEstimateCollectionRows
  toQuoteHomeEligibleJobReadModel: typeof toQuoteHomeEligibleJobReadModel
}

const defaultDeps: EstimateCollectionServiceDeps = {
  buildQuoteHomeBootstrapReadModel,
  buildQuoteHomeJobsPageReadModel,
  buildQuoteHomeRecentActivityReadModel,
  buildQuoteHomeSummaryFromRow,
  buildQuoteHomeSearchReadModel,
  buildQuoteJobVersionsReadModel,
  buildQuoteListPayload,
  createEstimateCollectionVersionRecord,
  decorateEstimateCollectionRows,
  encodeQuoteHomeCursor,
  loadEstimateCollectionJobVersionsPage,
  loadEstimateCollectionJobsPage,
  loadEstimateCollectionRelatedRows,
  loadEstimateCollectionRowsForOrg,
  loadEstimateCollectionSummary,
  selectQuoteHomeSearchRows,
  searchEstimateCollectionRows,
  toQuoteHomeEligibleJobReadModel,
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

async function decorateRowsForReadModel(
  orgId: string,
  rows: EstimateCollectionVersionRow[],
  includeRollups: boolean,
  deps: EstimateCollectionServiceDeps
) {
  const relationsResult = await deps.loadEstimateCollectionRelatedRows(orgId, rows, {
    includeRollups,
  })
  if (!relationsResult.ok) return relationsResult

  return {
    ok: true as const,
    data: deps.decorateEstimateCollectionRows(rows, relationsResult.data),
  }
}

async function loadEligibleJobsPage(
  orgId: string,
  options: { query?: string; limit?: number; cursor?: string | null },
  deps: EstimateCollectionServiceDeps
) {
  const firstPageResult = await deps.loadEstimateCollectionJobsPage(orgId, options)
  if (!firstPageResult.ok) return firstPageResult

  const limit = firstPageResult.data.limit
  const query = firstPageResult.data.query
  const eligible: QuoteHomeJobsPageRow[] = []
  let scannedRows = firstPageResult.data.rows
  let lastRawRow = scannedRows[scannedRows.length - 1] ?? null
  let hasMoreRawRows = scannedRows.length > limit

  while (true) {
    for (const row of scannedRows) {
      if (deps.toQuoteHomeEligibleJobReadModel(row)) {
        eligible.push(row)
      }
      if (eligible.length > limit) break
    }

    if (eligible.length > limit || !hasMoreRawRows || !lastRawRow?.created_at) break

    const nextScanCursor = deps.encodeQuoteHomeCursor({
      timestamp: lastRawRow.created_at,
      id: lastRawRow.id,
    })
    if (!nextScanCursor) break

    const nextPageResult = await deps.loadEstimateCollectionJobsPage(orgId, {
      query,
      limit,
      cursor: nextScanCursor,
    })
    if (!nextPageResult.ok) return nextPageResult

    scannedRows = nextPageResult.data.rows
    lastRawRow = scannedRows[scannedRows.length - 1] ?? null
    hasMoreRawRows = scannedRows.length > limit
  }

  const pageRows = eligible.slice(0, limit)
  const lastReturnedRow = pageRows[pageRows.length - 1] ?? null
  return {
    ok: true as const,
    data: {
      query,
      limit,
      nextCursor:
        eligible.length > limit && lastReturnedRow?.created_at
          ? deps.encodeQuoteHomeCursor({
              timestamp: lastReturnedRow.created_at,
              id: lastReturnedRow.id,
            })
          : null,
      items: pageRows
        .map((row) => deps.toQuoteHomeEligibleJobReadModel(row))
        .filter((row) => row !== null),
    },
  }
}

export async function loadEstimateCollectionPayload(
  orgId: string,
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const resolvedDeps = withDeps(deps)
  const { loadEstimateCollectionRowsForOrg, buildQuoteListPayload } = resolvedDeps

  const rowsResult = await loadEstimateCollectionRowsForOrg(orgId)
  if (!rowsResult.ok) return rowsResult

  const decoratedRowsResult = await decorateRowsForReadModel(orgId, rowsResult.data, false, resolvedDeps)
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
  const { buildQuoteHomeSummaryFromRow, loadEstimateCollectionSummary } = withDeps(deps)

  const startedAt = Date.now()
  const summaryResult = await loadEstimateCollectionSummary(orgId)
  if (!summaryResult.ok) return summaryResult
  const payload = buildQuoteHomeSummaryFromRow(summaryResult.data)

  logQuoteHomeRead('summary', {
    orgId,
    durationMs: Date.now() - startedAt,
    totalVersions: payload.total_versions,
    pipelineTotal: payload.pipeline_total,
    payloadBytes: bytesForLog(payload),
  })

  return { ok: true as const, data: payload }
}

export async function loadEstimateCollectionBootstrapPayload(
  orgId: string,
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const resolvedDeps = withDeps(deps)
  const {
    buildQuoteHomeBootstrapReadModel,
    buildQuoteHomeJobsPageReadModel,
    buildQuoteHomeSummaryFromRow,
    buildQuoteJobVersionsReadModel,
    loadEstimateCollectionJobVersionsPage,
    loadEstimateCollectionSummary,
  } = resolvedDeps

  const startedAt = Date.now()
  const [summaryResult, jobsResult] = await Promise.all([
    loadEstimateCollectionSummary(orgId),
    loadEligibleJobsPage(orgId, { limit: HOME_BOOTSTRAP_JOB_LIMIT }, resolvedDeps),
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

    const decoratedRowsResult = await decorateRowsForReadModel(
      orgId,
      versionsResult.data.items,
      true,
      resolvedDeps
    )
    if (!decoratedRowsResult.ok) return decoratedRowsResult

    selectedJobVersions = buildQuoteJobVersionsReadModel(decoratedRowsResult.data, {
      jobId: versionsResult.data.jobId,
      totalVersions: versionsResult.data.totalVersions,
      limit: versionsResult.data.limit,
      nextCursor: versionsResult.data.nextCursor,
    })
  }

  const payload = buildQuoteHomeBootstrapReadModel({
    summary: buildQuoteHomeSummaryFromRow(summaryResult.data),
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
  const resolvedDeps = withDeps(deps)
  const { loadEstimateCollectionRowsForOrg, buildQuoteHomeRecentActivityReadModel } = resolvedDeps

  const startedAt = Date.now()
  const rowsResult = await loadEstimateCollectionRowsForOrg(orgId, { limit: 12 })
  if (!rowsResult.ok) return rowsResult

  const decoratedRowsResult = await decorateRowsForReadModel(orgId, rowsResult.data, true, resolvedDeps)
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
  const resolvedDeps = withDeps(deps)
  const {
    buildQuoteHomeSearchReadModel,
    searchEstimateCollectionRows,
    selectQuoteHomeSearchRows,
  } = resolvedDeps

  const startedAt = Date.now()
  const rowsResult = await searchEstimateCollectionRows(orgId, query, HOME_SEARCH_LIMIT)
  if (!rowsResult.ok) return rowsResult

  const selectedRows = selectQuoteHomeSearchRows(rowsResult.data)
  const decoratedRowsResult = await decorateRowsForReadModel(orgId, selectedRows, true, resolvedDeps)
  if (!decoratedRowsResult.ok) return decoratedRowsResult

  const payload = buildQuoteHomeSearchReadModel(decoratedRowsResult.data, rowsResult.data.query)
  logQuoteHomeRead('search', {
    orgId,
    durationMs: Date.now() - startedAt,
    query: rowsResult.data.query,
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
  const resolvedDeps = withDeps(deps)
  const { buildQuoteHomeJobsPageReadModel } = resolvedDeps

  const startedAt = Date.now()
  const jobsResult = await loadEligibleJobsPage(orgId, options, resolvedDeps)
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
  const resolvedDeps = withDeps(deps)
  const { buildQuoteJobVersionsReadModel, loadEstimateCollectionJobVersionsPage } = resolvedDeps

  const startedAt = Date.now()
  const rowsResult = await loadEstimateCollectionJobVersionsPage(orgId, jobId, options)
  if (!rowsResult.ok) return rowsResult

  const decoratedRowsResult = await decorateRowsForReadModel(
    orgId,
    rowsResult.data.items,
    true,
    resolvedDeps
  )
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
