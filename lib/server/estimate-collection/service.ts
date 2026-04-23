import {
  buildQuoteHomeBootstrapReadModel,
  buildQuoteHomeJobVersionCountsReadModel,
  buildQuoteHomeRecentActivityReadModel,
  buildQuoteHomeSearchReadModel,
  buildQuoteHomeSummaryReadModel,
  buildQuoteJobVersionsReadModel,
  buildQuoteListPayload,
} from '../../quotes/collectionData.ts'
import {
  createEstimateCollectionVersionRecord,
  decorateEstimateCollectionRows,
  isSentEstimateCollectionJob,
  loadEstimateCollectionEligibleJobs,
  loadEstimateCollectionRollupSummary,
  loadEstimateCollectionRowsForOrg,
  normalizeEstimateCollectionVersionState,
  searchEstimateCollectionRows,
} from './repository.ts'
import type { EstimateCollectionVersionCopy } from './types'

type EstimateCollectionServiceDeps = {
  buildQuoteHomeBootstrapReadModel: typeof buildQuoteHomeBootstrapReadModel
  buildQuoteHomeJobVersionCountsReadModel: typeof buildQuoteHomeJobVersionCountsReadModel
  buildQuoteHomeRecentActivityReadModel: typeof buildQuoteHomeRecentActivityReadModel
  buildQuoteHomeSearchReadModel: typeof buildQuoteHomeSearchReadModel
  buildQuoteHomeSummaryReadModel: typeof buildQuoteHomeSummaryReadModel
  buildQuoteJobVersionsReadModel: typeof buildQuoteJobVersionsReadModel
  buildQuoteListPayload: typeof buildQuoteListPayload
  createEstimateCollectionVersionRecord: typeof createEstimateCollectionVersionRecord
  decorateEstimateCollectionRows: typeof decorateEstimateCollectionRows
  isSentEstimateCollectionJob: typeof isSentEstimateCollectionJob
  loadEstimateCollectionEligibleJobs: typeof loadEstimateCollectionEligibleJobs
  loadEstimateCollectionRollupSummary: typeof loadEstimateCollectionRollupSummary
  loadEstimateCollectionRowsForOrg: typeof loadEstimateCollectionRowsForOrg
  normalizeEstimateCollectionVersionState: typeof normalizeEstimateCollectionVersionState
  searchEstimateCollectionRows: typeof searchEstimateCollectionRows
}

const defaultDeps: EstimateCollectionServiceDeps = {
  buildQuoteHomeBootstrapReadModel,
  buildQuoteHomeJobVersionCountsReadModel,
  buildQuoteHomeRecentActivityReadModel,
  buildQuoteHomeSearchReadModel,
  buildQuoteHomeSummaryReadModel,
  buildQuoteJobVersionsReadModel,
  buildQuoteListPayload,
  createEstimateCollectionVersionRecord,
  decorateEstimateCollectionRows,
  isSentEstimateCollectionJob,
  loadEstimateCollectionEligibleJobs,
  loadEstimateCollectionRollupSummary,
  loadEstimateCollectionRowsForOrg,
  normalizeEstimateCollectionVersionState,
  searchEstimateCollectionRows,
}

function withDeps(overrides?: Partial<EstimateCollectionServiceDeps>): EstimateCollectionServiceDeps {
  return {
    ...defaultDeps,
    ...overrides,
  }
}

export async function loadEstimateCollectionPayload(
  orgId: string,
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const {
    loadEstimateCollectionRowsForOrg,
    decorateEstimateCollectionRows,
    buildQuoteListPayload,
  } = withDeps(deps)

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
  const {
    loadEstimateCollectionRowsForOrg,
    loadEstimateCollectionRollupSummary,
    buildQuoteHomeSummaryReadModel,
    normalizeEstimateCollectionVersionState,
    isSentEstimateCollectionJob,
  } = withDeps(deps)

  const estimateRowsResult = await loadEstimateCollectionRowsForOrg(orgId)
  if (!estimateRowsResult.ok) return estimateRowsResult

  const summaryResult = await loadEstimateCollectionRollupSummary({
    orgId,
    estimateRows: estimateRowsResult.data,
  })
  if (!summaryResult.ok) return summaryResult

  return {
    ok: true as const,
    data: buildQuoteHomeSummaryReadModel(
      estimateRowsResult.data.map((row) => ({
        version_state: normalizeEstimateCollectionVersionState(row.version_state),
        final_total: summaryResult.data.totalsByEstimateId.get(row.id) ?? null,
        is_sent_estimate: isSentEstimateCollectionJob(summaryResult.data.jobsById.get(row.job_id)),
      }))
    ),
  }
}

export async function loadEstimateCollectionBootstrapPayload(
  orgId: string,
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const {
    loadEstimateCollectionRowsForOrg,
    loadEstimateCollectionEligibleJobs,
    decorateEstimateCollectionRows,
    buildQuoteHomeBootstrapReadModel,
  } = withDeps(deps)

  const [rowsResult, jobsResult] = await Promise.all([
    loadEstimateCollectionRowsForOrg(orgId),
    loadEstimateCollectionEligibleJobs(orgId),
  ])
  if (!rowsResult.ok) return rowsResult
  if (!jobsResult.ok) return jobsResult

  const decoratedRowsResult = await decorateEstimateCollectionRows(orgId, rowsResult.data, {
    includeRollups: true,
  })
  if (!decoratedRowsResult.ok) return decoratedRowsResult

  return {
    ok: true as const,
    data: buildQuoteHomeBootstrapReadModel(decoratedRowsResult.data, jobsResult.data),
  }
}

export async function loadEstimateCollectionRecentActivityPayload(
  orgId: string,
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const {
    loadEstimateCollectionRowsForOrg,
    decorateEstimateCollectionRows,
    buildQuoteHomeRecentActivityReadModel,
  } = withDeps(deps)

  const rowsResult = await loadEstimateCollectionRowsForOrg(orgId, { limit: 12 })
  if (!rowsResult.ok) return rowsResult

  const decoratedRowsResult = await decorateEstimateCollectionRows(orgId, rowsResult.data, {
    includeRollups: true,
  })
  if (!decoratedRowsResult.ok) return decoratedRowsResult

  return {
    ok: true as const,
    data: buildQuoteHomeRecentActivityReadModel(decoratedRowsResult.data),
  }
}

export async function loadEstimateCollectionSearchPayload(
  orgId: string,
  query: string,
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const {
    searchEstimateCollectionRows,
    decorateEstimateCollectionRows,
    buildQuoteHomeSearchReadModel,
  } = withDeps(deps)

  const rowsResult = await searchEstimateCollectionRows(orgId, query, 8)
  if (!rowsResult.ok) return rowsResult

  const decoratedRowsResult = await decorateEstimateCollectionRows(orgId, rowsResult.data, {
    includeRollups: true,
  })
  if (!decoratedRowsResult.ok) return decoratedRowsResult

  return {
    ok: true as const,
    data: buildQuoteHomeSearchReadModel(decoratedRowsResult.data, query),
  }
}

export async function loadEstimateCollectionJobCountsPayload(
  orgId: string,
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const { loadEstimateCollectionRowsForOrg, buildQuoteHomeJobVersionCountsReadModel } = withDeps(deps)
  const rowsResult = await loadEstimateCollectionRowsForOrg(orgId)
  if (!rowsResult.ok) return rowsResult

  return {
    ok: true as const,
    data: buildQuoteHomeJobVersionCountsReadModel(rowsResult.data),
  }
}

export async function loadEstimateCollectionJobVersionsPayload(
  orgId: string,
  jobId: string,
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const { loadEstimateCollectionRowsForOrg, decorateEstimateCollectionRows, buildQuoteJobVersionsReadModel } =
    withDeps(deps)

  const rowsResult = await loadEstimateCollectionRowsForOrg(orgId, { jobId })
  if (!rowsResult.ok) return rowsResult

  const decoratedRowsResult = await decorateEstimateCollectionRows(orgId, rowsResult.data, {
    includeRollups: true,
  })
  if (!decoratedRowsResult.ok) return decoratedRowsResult

  return {
    ok: true as const,
    data: buildQuoteJobVersionsReadModel(decoratedRowsResult.data, jobId),
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
