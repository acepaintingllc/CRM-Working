import {
  buildQuoteHomeBootstrapReadModel,
  buildQuoteHomeJobsPageReadModel,
  buildQuoteHomeRecentActivityReadModel,
  buildQuoteHomeSummaryFromRow,
  buildQuoteCreateJobContextReadModel,
  buildQuoteHomeSearchReadModel,
  buildQuoteJobVersionsReadModel,
  buildQuoteListPayload,
  decorateEstimateCollectionRows,
  decodeQuoteHomeCursor,
  encodeQuoteHomeCursor,
  normalizeQuoteHomePageLimit,
  normalizeQuoteHomeSearchQuery,
  selectQuoteHomeSearchRows,
  toQuoteHomeEligibleJobReadModel,
} from '../../quotes/collectionData.ts'
import {
  createEstimateCollectionVersionRecord,
  loadEstimateCollectionJobContext,
  loadEstimateCollectionJobVersionsPage,
  loadEstimateCollectionJobsPage,
  loadEstimateCollectionRelatedRows,
  loadEstimateCollectionRowsForOrg,
  loadEstimateCollectionSummary,
  searchEstimateCollectionRows,
} from './repository.ts'
import { serverLog } from '@/lib/server/log'
import { errorResult, okResult, type ServiceResult } from '../serviceResult'
import type {
  EstimateCollectionJobVersionsDbPage,
  EstimateCollectionVersionCopy,
  EstimateCollectionVersionRow,
} from './types'
import type {
  QuoteHomeCursorKey,
  QuoteHomeJobListItemReadModel,
} from '../../quotes/collectionData.ts'

type EstimateCollectionServiceDeps = {
  buildQuoteHomeBootstrapReadModel: typeof buildQuoteHomeBootstrapReadModel
  buildQuoteHomeJobsPageReadModel: typeof buildQuoteHomeJobsPageReadModel
  buildQuoteHomeRecentActivityReadModel: typeof buildQuoteHomeRecentActivityReadModel
  buildQuoteHomeSummaryFromRow: typeof buildQuoteHomeSummaryFromRow
  buildQuoteCreateJobContextReadModel: typeof buildQuoteCreateJobContextReadModel
  buildQuoteHomeSearchReadModel: typeof buildQuoteHomeSearchReadModel
  buildQuoteJobVersionsReadModel: typeof buildQuoteJobVersionsReadModel
  buildQuoteListPayload: typeof buildQuoteListPayload
  createEstimateCollectionVersionRecord: typeof createEstimateCollectionVersionRecord
  decodeQuoteHomeCursor: typeof decodeQuoteHomeCursor
  decorateEstimateCollectionRows: typeof decorateEstimateCollectionRows
  encodeQuoteHomeCursor: typeof encodeQuoteHomeCursor
  loadEstimateCollectionJobContext: typeof loadEstimateCollectionJobContext
  loadEstimateCollectionJobVersionsPage: typeof loadEstimateCollectionJobVersionsPage
  loadEstimateCollectionJobsPage: typeof loadEstimateCollectionJobsPage
  loadEstimateCollectionRelatedRows: typeof loadEstimateCollectionRelatedRows
  loadEstimateCollectionRowsForOrg: typeof loadEstimateCollectionRowsForOrg
  loadEstimateCollectionSummary: typeof loadEstimateCollectionSummary
  normalizeQuoteHomePageLimit: typeof normalizeQuoteHomePageLimit
  normalizeQuoteHomeSearchQuery: typeof normalizeQuoteHomeSearchQuery
  selectQuoteHomeSearchRows: typeof selectQuoteHomeSearchRows
  searchEstimateCollectionRows: typeof searchEstimateCollectionRows
  toQuoteHomeEligibleJobReadModel: typeof toQuoteHomeEligibleJobReadModel
}

const defaultDeps: EstimateCollectionServiceDeps = {
  buildQuoteHomeBootstrapReadModel,
  buildQuoteHomeJobsPageReadModel,
  buildQuoteHomeRecentActivityReadModel,
  buildQuoteHomeSummaryFromRow,
  buildQuoteCreateJobContextReadModel,
  buildQuoteHomeSearchReadModel,
  buildQuoteJobVersionsReadModel,
  buildQuoteListPayload,
  createEstimateCollectionVersionRecord,
  decodeQuoteHomeCursor,
  decorateEstimateCollectionRows,
  encodeQuoteHomeCursor,
  loadEstimateCollectionJobContext,
  loadEstimateCollectionJobVersionsPage,
  loadEstimateCollectionJobsPage,
  loadEstimateCollectionRelatedRows,
  loadEstimateCollectionRowsForOrg,
  loadEstimateCollectionSummary,
  normalizeQuoteHomePageLimit,
  normalizeQuoteHomeSearchQuery,
  selectQuoteHomeSearchRows,
  searchEstimateCollectionRows,
  toQuoteHomeEligibleJobReadModel,
}

const HOME_BOOTSTRAP_JOB_LIMIT = 25
const HOME_VERSIONS_LIMIT = 25
const HOME_SEARCH_LIMIT = 8
const HOME_SEARCH_CANDIDATE_LIMIT = HOME_SEARCH_LIMIT * 4

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
  const pageOptions = parseQuoteHomePageOptions(options, false, deps)
  if (!pageOptions.ok) return pageOptions

  const firstPageResult = await deps.loadEstimateCollectionJobsPage(orgId, pageOptions.data)
  if (!firstPageResult.ok) return firstPageResult

  const limit = firstPageResult.data.limit
  const query = firstPageResult.data.query
  const eligibleItems: QuoteHomeJobListItemReadModel[] = []
  let scannedRows = firstPageResult.data.rows
  let lastRawRow = scannedRows[scannedRows.length - 1] ?? null
  let hasMoreRawRows = scannedRows.length > limit

  while (true) {
    for (const row of scannedRows) {
      const item = deps.toQuoteHomeEligibleJobReadModel(row)
      if (item) {
        eligibleItems.push(item)
      }
      if (eligibleItems.length > limit) break
    }

    if (eligibleItems.length > limit || !hasMoreRawRows || !lastRawRow?.created_at) break

    const nextPageResult = await deps.loadEstimateCollectionJobsPage(orgId, {
      query,
      limit,
      cursor: {
        timestamp: lastRawRow.created_at,
        id: lastRawRow.id,
      },
    })
    if (!nextPageResult.ok) return nextPageResult

    scannedRows = nextPageResult.data.rows
    lastRawRow = scannedRows[scannedRows.length - 1] ?? null
    hasMoreRawRows = scannedRows.length > limit
  }

  const pageItems = eligibleItems.slice(0, limit)
  const lastReturnedItem = pageItems[pageItems.length - 1] ?? null
  return {
    ok: true as const,
    data: {
      query,
      limit,
      nextCursor:
        eligibleItems.length > limit && lastReturnedItem?.created_at
          ? deps.encodeQuoteHomeCursor({
              timestamp: lastReturnedItem.created_at,
              id: lastReturnedItem.id,
            })
          : null,
      items: pageItems,
    },
  }
}

function parseQuoteHomePageOptions(
  options: { query?: string; limit?: number; cursor?: string | null },
  allowNullTimestampCursor: boolean,
  deps: EstimateCollectionServiceDeps
): ServiceResult<{
  query: string
  limit: number
  cursor: QuoteHomeCursorKey | null
}> {
  const cursorResult = deps.decodeQuoteHomeCursor(options.cursor)
  if (!cursorResult.ok) {
    return errorResult('invalid_input', cursorResult.message)
  }
  if (!allowNullTimestampCursor && cursorResult.value?.timestamp === null) {
    return errorResult('invalid_input', 'Invalid cursor.')
  }

  return okResult({
    query: deps.normalizeQuoteHomeSearchQuery(options.query),
    limit: deps.normalizeQuoteHomePageLimit(options.limit),
    cursor: cursorResult.value,
  })
}

function buildJobVersionsPageData(
  page: EstimateCollectionJobVersionsDbPage,
  deps: EstimateCollectionServiceDeps
) {
  const items = page.rows.slice(0, page.limit)
  const lastReturnedRow = items[items.length - 1] ?? null

  return {
    jobId: page.jobId,
    totalVersions: page.totalVersions,
    limit: page.limit,
    nextCursor:
      page.rows.length > page.limit && lastReturnedRow
        ? deps.encodeQuoteHomeCursor({
            timestamp: lastReturnedRow.updated_at,
            id: lastReturnedRow.id,
          })
        : null,
    items,
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
    const versionPageOptions = parseQuoteHomePageOptions(
      { limit: HOME_VERSIONS_LIMIT },
      true,
      resolvedDeps
    )
    if (!versionPageOptions.ok) return versionPageOptions

    const versionsResult = await loadEstimateCollectionJobVersionsPage(orgId, selectedJobId, {
      limit: versionPageOptions.data.limit,
      cursor: versionPageOptions.data.cursor,
    })
    if (!versionsResult.ok) return versionsResult

    const versionsPage = buildJobVersionsPageData(versionsResult.data, resolvedDeps)
    const decoratedRowsResult = await decorateRowsForReadModel(
      orgId,
      versionsPage.items,
      true,
      resolvedDeps
    )
    if (!decoratedRowsResult.ok) return decoratedRowsResult

    selectedJobVersions = buildQuoteJobVersionsReadModel(decoratedRowsResult.data, {
      jobId: versionsPage.jobId,
      totalVersions: versionsPage.totalVersions,
      limit: versionsPage.limit,
      nextCursor: versionsPage.nextCursor,
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
  const normalizedQuery = resolvedDeps.normalizeQuoteHomeSearchQuery(query)
  if (!normalizedQuery) {
    const payload = buildQuoteHomeSearchReadModel([], normalizedQuery)
    logQuoteHomeRead('search', {
      orgId,
      durationMs: Date.now() - startedAt,
      query: normalizedQuery,
      items: payload.items.length,
      payloadBytes: bytesForLog(payload),
    })

    return {
      ok: true as const,
      data: payload,
    }
  }

  const rowsResult = await searchEstimateCollectionRows(
    orgId,
    normalizedQuery,
    HOME_SEARCH_CANDIDATE_LIMIT
  )
  if (!rowsResult.ok) return rowsResult

  const selectedRows = selectQuoteHomeSearchRows({
    ...rowsResult.data,
    limit: HOME_SEARCH_LIMIT,
  })
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

export async function loadEstimateCollectionQuoteCreateContextPayload(
  orgId: string,
  jobId: string,
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const resolvedDeps = withDeps(deps)
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
  const resolvedDeps = withDeps(deps)
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
  const { createEstimateCollectionVersionRecord } = withDeps(deps)
  return createEstimateCollectionVersionRecord(params)
}

export async function loadEstimateCollectionEligibleJobs(
  orgId: string,
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const resolvedDeps = withDeps(deps)
  const jobsResult = await loadEligibleJobsPage(orgId, { limit: 100 }, resolvedDeps)
  if (!jobsResult.ok) return jobsResult
  return okResult(jobsResult.data.items)
}

export type { EstimateCollectionVersionCopy } from './types'
