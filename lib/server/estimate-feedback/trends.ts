import { errorResult, okResult, type ServiceResult } from '../serviceResult.ts'
import type {
  EstimateFeedbackTrendMetricSummary,
  EstimateFeedbackTrendOccupancy,
  EstimateFeedbackTrendPattern,
  EstimateFeedbackTrendResolvedFilters,
  EstimateFeedbackTrendSummary,
} from '../../../types/estimate-feedback/trends.ts'
import { applyJobReviewTrendEligibilityFilter } from './reviewRules.ts'

type TrendDbError = { message?: string | null }
type QueryListResponse<T> = { data: T[] | null; error: TrendDbError | null }
type QueryBuilder = {
  select(columns: string): QueryBuilder
  eq(column: string, value: unknown): QueryBuilder
  gte?(column: string, value: unknown): QueryBuilder
  lte?(column: string, value: unknown): QueryBuilder
  in(column: string, values: unknown[]): QueryBuilder
  order?(column: string, options?: { ascending?: boolean }): QueryBuilder
  then<TResult1 = QueryListResponse<unknown>, TResult2 = never>(
    onfulfilled?: ((value: QueryListResponse<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>
}
type DbClient = { from(table: string): QueryBuilder }
type TrendDeps = { db?: DbClient }

type ReviewTrendRow = {
  id: string
  org_id: string
  job_id: string
  estimate_snapshot_id: string
  status: string
  exclude_from_trends: boolean
  data_quality_status: string
  trend_eligible: boolean
  locked_at: string | null
}

type ReviewMetricTrendRow = {
  job_review_id: string
  job_id: string
  metric_key: string
  metric_label: string
  variance_value: number | string | null
  total_impact: number | string | null
}

type EstimateSnapshotTrendRow = {
  id: string
  estimate_version_kind: string | null
  assumptions_json: unknown
  source_payload_json: unknown
}

const metricKeys = ['labor', 'paint', 'supplies'] as const
const defaultFilters: EstimateFeedbackTrendResolvedFilters = {
  from: null,
  to: null,
  jobType: null,
  occupancy: null,
  conditionTags: [],
  maxAbsoluteVariance: null,
  maxAbsoluteTotalImpact: null,
}

async function getDb(deps?: TrendDeps): Promise<DbClient> {
  if (deps?.db) return deps.db
  const { supabaseAdmin } = await import('../org.ts')
  return supabaseAdmin as unknown as DbClient
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown) {
  const next = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(next) ? next : 0
}

function average(values: number[]) {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function isIsoDate(value: string) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed)
}

function isDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function trendDateBoundForQuery(value: string, boundary: 'start' | 'end') {
  if (!isDateOnly(value)) return value
  return boundary === 'start' ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`
}

function normalizeDate(value: unknown, label: string): ServiceResult<string | null> {
  const raw = asString(value)
  if (!raw) return okResult(null)
  if (!isIsoDate(raw)) return errorResult('invalid_input', `${label} must be a valid date.`)
  return okResult(raw)
}

function normalizeToken(value: unknown, label: string): ServiceResult<string | null> {
  const raw = asString(value)
  if (!raw) return okResult(null)
  if (raw.length > 80) return errorResult('invalid_input', `${label} is too long.`)
  return okResult(raw)
}

function normalizeConditionTags(value: unknown): ServiceResult<string[]> {
  const values = Array.isArray(value) ? value : [value]
  const tags = values
    .flatMap((entry) => asString(entry).split(','))
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (tags.some((tag) => tag.length > 80)) {
    return errorResult('invalid_input', 'condition tags must be 80 characters or fewer.')
  }

  return okResult(Array.from(new Set(tags)))
}

function normalizeOptionalPositiveNumber(
  value: unknown,
  label: string
): ServiceResult<number | null> {
  if (value == null || value === '') return okResult(null)
  const raw = typeof value === 'string' ? value.trim() : value
  if (raw === '') return okResult(null)
  const next = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(next) || next <= 0) {
    return errorResult('invalid_input', `${label} must be a positive number.`)
  }
  return okResult(next)
}

export function normalizeTrendFilters(input: {
  from?: unknown
  to?: unknown
  jobType?: unknown
  occupancy?: unknown
  conditionTags?: unknown
  maxAbsoluteVariance?: unknown
  maxAbsoluteTotalImpact?: unknown
}): ServiceResult<EstimateFeedbackTrendResolvedFilters> {
  const from = normalizeDate(input.from, 'from')
  if (!from.ok) return from

  const to = normalizeDate(input.to, 'to')
  if (!to.ok) return to

  if (from.data && to.data && Date.parse(from.data) > Date.parse(to.data)) {
    return errorResult('invalid_input', 'from must be before to.')
  }

  const jobType = normalizeToken(input.jobType, 'job type')
  if (!jobType.ok) return jobType

  const occupancyRaw = asString(input.occupancy).toLowerCase()
  if (occupancyRaw && occupancyRaw !== 'occupied' && occupancyRaw !== 'vacant') {
    return errorResult('invalid_input', 'occupancy must be occupied or vacant.')
  }

  const conditionTags = normalizeConditionTags(input.conditionTags)
  if (!conditionTags.ok) return conditionTags

  const maxAbsoluteVariance = normalizeOptionalPositiveNumber(
    input.maxAbsoluteVariance,
    'maxAbsoluteVariance'
  )
  if (!maxAbsoluteVariance.ok) return maxAbsoluteVariance

  const maxAbsoluteTotalImpact = normalizeOptionalPositiveNumber(
    input.maxAbsoluteTotalImpact,
    'maxAbsoluteTotalImpact'
  )
  if (!maxAbsoluteTotalImpact.ok) return maxAbsoluteTotalImpact

  return okResult({
    from: from.data,
    to: to.data,
    jobType: jobType.data,
    occupancy: (occupancyRaw || null) as EstimateFeedbackTrendOccupancy | null,
    conditionTags: conditionTags.data,
    maxAbsoluteVariance: maxAbsoluteVariance.data,
    maxAbsoluteTotalImpact: maxAbsoluteTotalImpact.data,
  })
}

function objectValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'object' && value !== null) return Object.values(value)
  return []
}

function deepTextValues(value: unknown): string[] {
  if (value == null) return []
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [String(value).toLowerCase()]
  }
  return objectValues(value).flatMap(deepTextValues)
}

function snapshotText(snapshot: EstimateSnapshotTrendRow) {
  return deepTextValues([snapshot.assumptions_json, snapshot.source_payload_json])
}

function matchesOccupancy(snapshot: EstimateSnapshotTrendRow, occupancy: EstimateFeedbackTrendOccupancy | null) {
  if (!occupancy) return true
  const text = snapshotText(snapshot)
  if (occupancy === 'occupied') {
    return text.some((value) => value.includes('occupied') || value.includes('furnished'))
  }
  return text.some((value) => value.includes('vacant') || value.includes('empty'))
}

function matchesConditionTags(snapshot: EstimateSnapshotTrendRow, tags: string[]) {
  if (tags.length === 0) return true
  const text = snapshotText(snapshot)
  return tags.every((tag) =>
    text.some((value) => value.includes(tag.toLowerCase()))
  )
}

function matchesSnapshotFilters(
  snapshot: EstimateSnapshotTrendRow | undefined,
  filters: EstimateFeedbackTrendResolvedFilters
) {
  if (!snapshot) return false
  if (filters.jobType && snapshot.estimate_version_kind !== filters.jobType) return false
  if (!matchesOccupancy(snapshot, filters.occupancy)) return false
  return matchesConditionTags(snapshot, filters.conditionTags)
}

async function loadEligibleReviews(
  db: DbClient,
  orgId: string,
  filters: EstimateFeedbackTrendResolvedFilters
): Promise<ServiceResult<ReviewTrendRow[]>> {
  let query = applyJobReviewTrendEligibilityFilter(
    db
      .from('job_review')
      .select(
        'id, org_id, job_id, estimate_snapshot_id, status, exclude_from_trends, data_quality_status, trend_eligible, locked_at'
      )
      .eq('org_id', orgId)
  )

  if (filters.from) {
    query = query.gte?.('locked_at', trendDateBoundForQuery(filters.from, 'start')) ?? query
  }
  if (filters.to) {
    query = query.lte?.('locked_at', trendDateBoundForQuery(filters.to, 'end')) ?? query
  }
  query = query.order?.('locked_at', { ascending: false }) ?? query

  const result = (await query) as QueryListResponse<ReviewTrendRow>
  if (result.error) {
    return errorResult('server_error', result.error.message ?? 'Unable to load trend reviews.')
  }
  return okResult(result.data ?? [])
}

async function loadReviewMetrics(
  db: DbClient,
  orgId: string,
  reviewIds: string[]
): Promise<ServiceResult<ReviewMetricTrendRow[]>> {
  if (reviewIds.length === 0) return okResult([])

  const result = (await db
    .from('job_review_metric')
    .select('job_review_id, job_id, metric_key, metric_label, variance_value, total_impact')
    .eq('org_id', orgId)
    .in('job_review_id', reviewIds)) as QueryListResponse<ReviewMetricTrendRow>

  if (result.error) {
    return errorResult('server_error', result.error.message ?? 'Unable to load trend metrics.')
  }
  return okResult(result.data ?? [])
}

async function loadSnapshots(
  db: DbClient,
  orgId: string,
  snapshotIds: string[]
): Promise<ServiceResult<EstimateSnapshotTrendRow[]>> {
  if (snapshotIds.length === 0) return okResult([])

  const result = (await db
    .from('estimate_snapshot')
    .select('id, estimate_version_kind, assumptions_json, source_payload_json')
    .eq('org_id', orgId)
    .in('id', snapshotIds)) as QueryListResponse<EstimateSnapshotTrendRow>

  if (result.error) {
    return errorResult('server_error', result.error.message ?? 'Unable to load trend snapshots.')
  }
  return okResult(result.data ?? [])
}

function summarizeMetric(rows: ReviewMetricTrendRow[], key: string): EstimateFeedbackTrendMetricSummary {
  const matching = rows.filter((row) => row.metric_key === key)
  return {
    averageVariance: average(matching.map((row) => asNumber(row.variance_value))),
    averageTotalImpact: average(matching.map((row) => asNumber(row.total_impact))),
    count: matching.length,
  }
}

function withinOutlierGuard(
  row: ReviewMetricTrendRow,
  filters: EstimateFeedbackTrendResolvedFilters
) {
  if (
    filters.maxAbsoluteVariance != null &&
    Math.abs(asNumber(row.variance_value)) > filters.maxAbsoluteVariance
  ) {
    return false
  }
  if (
    filters.maxAbsoluteTotalImpact != null &&
    Math.abs(asNumber(row.total_impact)) > filters.maxAbsoluteTotalImpact
  ) {
    return false
  }
  return true
}

function buildPatterns(rows: ReviewMetricTrendRow[]): EstimateFeedbackTrendPattern[] {
  const grouped = new Map<string, ReviewMetricTrendRow[]>()
  for (const row of rows) {
    if (!row.metric_key) continue
    grouped.set(row.metric_key, [...(grouped.get(row.metric_key) ?? []), row])
  }

  return Array.from(grouped.entries())
    .map(([key, group]) => {
      const impacts = group.map((row) => asNumber(row.total_impact))
      return {
        key,
        label: group[0]?.metric_label || key,
        count: group.length,
        averageVariance: average(group.map((row) => asNumber(row.variance_value))),
        averageTotalImpact: average(impacts),
        totalImpact: impacts.reduce((sum, value) => sum + value, 0),
      }
    })
    .sort((a, b) => Math.abs(b.totalImpact) - Math.abs(a.totalImpact))
}

function emptyTrendSummary(
  filters: EstimateFeedbackTrendResolvedFilters
): EstimateFeedbackTrendSummary {
  const emptyMetric = { averageVariance: null, averageTotalImpact: null, count: 0 }
  return {
    filters,
    averageLaborVariance: null,
    averagePaintVariance: null,
    averageSuppliesVariance: null,
    averageMissPerJob: null,
    portfolioImpact: 0,
    jobsAnalyzed: 0,
    metrics: {
      labor: emptyMetric,
      paint: emptyMetric,
      supplies: emptyMetric,
    },
    patterns: [],
  }
}

export async function loadEstimateFeedbackTrends(
  orgId: string,
  filters: EstimateFeedbackTrendResolvedFilters = defaultFilters,
  deps?: TrendDeps
): Promise<ServiceResult<EstimateFeedbackTrendSummary>> {
  const db = await getDb(deps)
  const reviews = await loadEligibleReviews(db, orgId, filters)
  if (!reviews.ok) return reviews

  const eligibleReviewIds = reviews.data.map((review) => review.id)
  if (eligibleReviewIds.length === 0) {
    return okResult(emptyTrendSummary(filters))
  }

  const eligibleSnapshotIds = Array.from(
    new Set(reviews.data.map((review) => review.estimate_snapshot_id).filter(Boolean))
  )
  const metrics = await loadReviewMetrics(db, orgId, eligibleReviewIds)
  if (!metrics.ok) return metrics
  const snapshots = await loadSnapshots(db, orgId, eligibleSnapshotIds)
  if (!snapshots.ok) return snapshots

  const snapshotsById = new Map(snapshots.data.map((row) => [row.id, row]))
  const filteredReviews = reviews.data.filter((review) =>
    matchesSnapshotFilters(snapshotsById.get(review.estimate_snapshot_id), filters)
  )
  const reviewIds = new Set(filteredReviews.map((review) => review.id))
  const trendMetrics = metrics.data.filter(
    (row) => reviewIds.has(row.job_review_id) && withinOutlierGuard(row, filters)
  )
  const missByJob = new Map<string, number>()
  for (const metric of trendMetrics) {
    missByJob.set(metric.job_id, (missByJob.get(metric.job_id) ?? 0) + asNumber(metric.total_impact))
  }
  const jobMisses = Array.from(missByJob.values())
  const jobIds = new Set(missByJob.keys())
  const portfolioImpact = jobMisses.reduce((sum, value) => sum + value, 0)
  const metricSummaries = Object.fromEntries(
    metricKeys.map((key) => [key, summarizeMetric(trendMetrics, key)])
  ) as EstimateFeedbackTrendSummary['metrics']

  return okResult({
    filters,
    averageLaborVariance: metricSummaries.labor.averageVariance,
    averagePaintVariance: metricSummaries.paint.averageVariance,
    averageSuppliesVariance: metricSummaries.supplies.averageVariance,
    averageMissPerJob: average(jobMisses),
    portfolioImpact,
    jobsAnalyzed: jobIds.size,
    metrics: metricSummaries,
    patterns: buildPatterns(trendMetrics),
  })
}
