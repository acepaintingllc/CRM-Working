import {
  buildJobVersionsPageData,
  bytesForLog,
  decorateRowsForReadModel,
  HOME_BOOTSTRAP_JOB_LIMIT,
  HOME_SEARCH_CANDIDATE_LIMIT,
  HOME_SEARCH_LIMIT,
  HOME_VERSIONS_LIMIT,
  loadEligibleJobsPage,
  logQuoteHomeRead,
  parseQuoteHomePageOptions,
} from './serviceHelpers.ts'
import {
  withEstimateCollectionServiceDeps,
  type EstimateCollectionServiceDeps,
} from './serviceDeps.ts'

export async function loadEstimateCollectionBootstrapPayload(
  orgId: string,
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const resolvedDeps = withEstimateCollectionServiceDeps(deps)
  const {
    buildQuoteHomeBootstrapReadModel,
    buildQuoteHomeLatestVersionReadModel,
    buildQuoteHomeJobsPageReadModel,
    buildQuoteHomeSummaryFromRow,
    buildQuoteJobVersionsReadModel,
    loadEstimateCollectionJobVersionsPage,
    loadEstimateCollectionRowsForOrg,
    loadEstimateCollectionSummary,
  } = resolvedDeps

  const startedAt = Date.now()
  const [summaryResult, jobsResult, latestVersionRowsResult] = await Promise.all([
    loadEstimateCollectionSummary(orgId),
    loadEligibleJobsPage(orgId, { limit: HOME_BOOTSTRAP_JOB_LIMIT }, resolvedDeps),
    loadEstimateCollectionRowsForOrg(orgId, { limit: 1 }),
  ])
  if (!summaryResult.ok) return summaryResult
  if (!jobsResult.ok) return jobsResult
  if (!latestVersionRowsResult.ok) return latestVersionRowsResult

  const latestVersionRows = latestVersionRowsResult.data
  const latestVersionDecoratedRowsResult = await decorateRowsForReadModel(
    orgId,
    latestVersionRows,
    true,
    resolvedDeps
  )
  if (!latestVersionDecoratedRowsResult.ok) return latestVersionDecoratedRowsResult
  const latestVersion = buildQuoteHomeLatestVersionReadModel(
    latestVersionDecoratedRowsResult.data
  )

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
    latestVersion,
  })

  logQuoteHomeRead('bootstrap', {
    orgId,
    durationMs: Date.now() - startedAt,
    jobsReturned: payload.jobs.items.length,
    selectedJobId: payload.selected_job_id,
    selectedJobVersions: payload.selected_job_versions?.items.length ?? 0,
    latestVersionId: payload.latest_version?.estimate_id ?? null,
    jobsNextCursor: payload.jobs.next_cursor,
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
  const resolvedDeps = withEstimateCollectionServiceDeps(deps)
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
  const resolvedDeps = withEstimateCollectionServiceDeps(deps)
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
