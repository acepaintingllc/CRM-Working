import { supabaseAdmin } from '../org.ts'
import { isUuid } from '../routeUtils.ts'
import { errorResult, okResult, type ServiceResult } from '../serviceResult.ts'
import type {
  JobActualsStatus,
  JobReviewMetricKey,
  JobReviewMetricRecord,
  JobReviewMetricUnit,
  JobReviewPayload,
  JobReviewReadModel,
  JobReviewRecord,
} from '../../../types/jobs/feedback.ts'
import {
  isJobReviewDataQualityStatus,
  isJobReviewPrimaryCauseTag,
} from '../../../types/jobs/feedback.ts'
import {
  JOB_REVIEW_METRIC_TOLERANCE_PERCENT,
  buildJobReviewTrendEligibilityPreview,
  isJobReviewTrendEligible,
} from './reviewRules.ts'

export {
  JOB_REVIEW_METRIC_TOLERANCE_PERCENT,
  buildJobReviewTrendEligibilityPreview,
  isJobReviewTrendEligible,
} from './reviewRules.ts'

export type EstimateSnapshotReviewRow = {
  id: string
  org_id: string
  job_id: string
  estimated_labor_hours: number
  estimated_paint_gallons: number
  estimated_paint_material_cost: number
  estimated_supplies_cost: number
  estimated_other_cost: number
  estimated_access_cost: number
  estimated_total: number
}

export type JobActualsReviewRow = {
  id: string
  org_id: string
  job_id: string
  estimate_snapshot_id: string
  actual_labor_hours: number
  actual_paint_gallons: number
  actual_supplies_cost: number
  actual_other_cost: number
  status: JobActualsStatus
}

export type JobReviewRow = JobReviewRecord

export type JobReviewMetricRow = JobReviewMetricRecord

export type JobReviewInput = JobReviewPayload

type ReviewDbError = { code?: string | null; message?: string | null }
type QueryResponse<T> = { data: T | null; error: ReviewDbError | null }
type QueryListResponse<T> = { data: T[] | null; error: ReviewDbError | null }
type QueryBuilder = {
  select(columns: string): QueryBuilder
  eq(column: string, value: unknown): QueryBuilder
  order(column: string, options?: { ascending?: boolean }): QueryBuilder
  insert(payload: Record<string, unknown> | Array<Record<string, unknown>>): QueryBuilder
  update(payload: Record<string, unknown>): QueryBuilder
  delete(): QueryBuilder
  maybeSingle<T = unknown>(): Promise<QueryResponse<T>>
  single<T = unknown>(): Promise<QueryResponse<T>>
  then<TResult1 = QueryListResponse<unknown>, TResult2 = never>(
    onfulfilled?: ((value: QueryListResponse<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>
}
type DbClient = { from(table: string): QueryBuilder }
type ReviewDeps = { db?: DbClient; now?: () => Date }

const maxCauseTagLength = 100
const maxNotesLength = 4_000

const reviewSelect = [
  'id',
  'org_id',
  'job_id',
  'estimate_snapshot_id',
  'job_actuals_id',
  'primary_cause_tag',
  'review_notes',
  'status',
  'exclude_from_trends',
  'data_quality_status',
  'change_order_present',
  'trend_eligible',
  'reviewed_at',
  'locked_at',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
].join(', ')

const metricSelect = [
  'id',
  'org_id',
  'job_id',
  'estimate_snapshot_id',
  'job_review_id',
  'metric_key',
  'metric_label',
  'unit',
  'estimated_value',
  'actual_value',
  'variance_value',
  'total_impact',
  'variance_percent',
  'tolerance_percent',
  'within_tolerance',
  'created_at',
  'updated_at',
].join(', ')

function getDb(deps?: ReviewDeps): DbClient {
  return deps?.db ?? (supabaseAdmin as unknown as DbClient)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asUuid(value: unknown, label: string): ServiceResult<string> {
  if (!isUuid(value)) {
    return errorResult('invalid_input', `Invalid ${label}.`)
  }
  return okResult(value)
}

function normalizeOptionalText(
  value: unknown,
  label: string,
  maxLength: number
): ServiceResult<string | null> {
  if (value == null) return okResult(null)
  if (typeof value !== 'string') return errorResult('invalid_input', `${label} must be text.`)
  const trimmed = value.trim()
  if (!trimmed) return okResult(null)
  if (trimmed.length > maxLength) {
    return errorResult('invalid_input', `${label} must be ${maxLength} characters or fewer.`)
  }
  return okResult(trimmed)
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function readBodyField(body: Record<string, unknown>, snakeKey: string, camelKey: string) {
  return body[snakeKey] ?? body[camelKey]
}

export function normalizeReviewSnapshotId(value: unknown): ServiceResult<string> {
  return asUuid(value, 'estimate snapshot id')
}

export function normalizeJobReviewInput(body: unknown): ServiceResult<JobReviewInput> {
  if (!isRecord(body)) return errorResult('invalid_input', 'Review payload must be an object.')

  const snapshotId = asUuid(
    readBodyField(body, 'estimate_snapshot_id', 'estimateSnapshotId'),
    'estimate snapshot id'
  )
  if (!snapshotId.ok) return snapshotId

  const causeTag = normalizeOptionalText(
    readBodyField(body, 'primary_cause_tag', 'primaryCauseTag'),
    'primary_cause_tag',
    maxCauseTagLength
  )
  if (!causeTag.ok) return causeTag
  if (causeTag.data !== null && !isJobReviewPrimaryCauseTag(causeTag.data)) {
    return errorResult('invalid_input', 'primary_cause_tag is not allowed.')
  }

  const notes = normalizeOptionalText(
    readBodyField(body, 'review_notes', 'reviewNotes'),
    'review_notes',
    maxNotesLength
  )
  if (!notes.ok) return notes

  const rawStatus = readBodyField(body, 'status', 'status') ?? 'draft'
  if (rawStatus !== 'draft' && rawStatus !== 'reviewed') {
    return errorResult('invalid_input', 'status must be draft or reviewed.')
  }

  const rawQuality =
    readBodyField(body, 'data_quality_status', 'dataQualityStatus') ?? 'valid'
  if (typeof rawQuality !== 'string' || !isJobReviewDataQualityStatus(rawQuality)) {
    return errorResult('invalid_input', 'data_quality_status must be valid, questionable, or invalid.')
  }

  return okResult({
    estimate_snapshot_id: snapshotId.data,
    primary_cause_tag: causeTag.data,
    review_notes: notes.data,
    status: rawStatus,
    exclude_from_trends: normalizeBoolean(
      readBodyField(body, 'exclude_from_trends', 'excludeFromTrends'),
      false
    ),
    data_quality_status: rawQuality,
    change_order_present: normalizeBoolean(
      readBodyField(body, 'change_order_present', 'changeOrderPresent'),
      false
    ),
  })
}

function numeric(value: unknown) {
  const next = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(next) ? next : 0
}

function unitRate(total: number, units: number) {
  return units > 0 ? total / units : 0
}

function laborDollarBasis(snapshot: EstimateSnapshotReviewRow) {
  return Math.max(
    0,
    numeric(snapshot.estimated_total) -
      numeric(snapshot.estimated_paint_material_cost) -
      numeric(snapshot.estimated_supplies_cost) -
      numeric(snapshot.estimated_other_cost) -
      numeric(snapshot.estimated_access_cost)
  )
}

function metric(params: {
  key: JobReviewMetricKey
  label: string
  unit: JobReviewMetricUnit
  estimated: number
  actual: number
  impactRate?: number
  orgId: string
  jobId: string
  snapshotId: string
  reviewId: string
}): JobReviewMetricRow {
  const estimated = numeric(params.estimated)
  const actual = numeric(params.actual)
  const variance = actual - estimated
  const impactRate = params.impactRate ?? 1
  const variancePercent =
    estimated === 0 ? (actual === 0 ? 0 : null) : (variance / estimated) * 100
  const withinTolerance =
    variancePercent === null
      ? false
      : Math.abs(variancePercent) <= JOB_REVIEW_METRIC_TOLERANCE_PERCENT

  return {
    org_id: params.orgId,
    job_id: params.jobId,
    estimate_snapshot_id: params.snapshotId,
    job_review_id: params.reviewId,
    metric_key: params.key,
    metric_label: params.label,
    unit: params.unit,
    estimated_value: estimated,
    actual_value: actual,
    variance_value: variance,
    total_impact: variance * impactRate,
    variance_percent: variancePercent,
    tolerance_percent: JOB_REVIEW_METRIC_TOLERANCE_PERCENT,
    within_tolerance: withinTolerance,
  }
}

export function computeJobReviewMetrics(params: {
  orgId: string
  jobId: string
  estimateSnapshotId: string
  jobReviewId: string
  snapshot: EstimateSnapshotReviewRow
  actuals: JobActualsReviewRow
}) {
  const laborImpactRate = unitRate(
    laborDollarBasis(params.snapshot),
    numeric(params.snapshot.estimated_labor_hours)
  )
  const paintImpactRate = unitRate(
    numeric(params.snapshot.estimated_paint_material_cost),
    numeric(params.snapshot.estimated_paint_gallons)
  )

  return [
    metric({
      key: 'labor',
      label: 'Labor variance',
      unit: 'hours',
      estimated: params.snapshot.estimated_labor_hours,
      actual: params.actuals.actual_labor_hours,
      impactRate: laborImpactRate,
      orgId: params.orgId,
      jobId: params.jobId,
      snapshotId: params.estimateSnapshotId,
      reviewId: params.jobReviewId,
    }),
    metric({
      key: 'paint',
      label: 'Paint variance',
      unit: 'gallons',
      estimated: params.snapshot.estimated_paint_gallons,
      actual: params.actuals.actual_paint_gallons,
      impactRate: paintImpactRate,
      orgId: params.orgId,
      jobId: params.jobId,
      snapshotId: params.estimateSnapshotId,
      reviewId: params.jobReviewId,
    }),
    metric({
      key: 'supplies',
      label: 'Supplies variance',
      unit: 'currency',
      estimated: params.snapshot.estimated_supplies_cost,
      actual: params.actuals.actual_supplies_cost,
      orgId: params.orgId,
      jobId: params.jobId,
      snapshotId: params.estimateSnapshotId,
      reviewId: params.jobReviewId,
    }),
    metric({
      key: 'other',
      label: 'Other variance',
      unit: 'currency',
      estimated: params.snapshot.estimated_other_cost,
      actual: params.actuals.actual_other_cost,
      orgId: params.orgId,
      jobId: params.jobId,
      snapshotId: params.estimateSnapshotId,
      reviewId: params.jobReviewId,
    }),
  ]
}

async function loadSnapshot(
  db: DbClient,
  orgId: string,
  jobId: string,
  estimateSnapshotId: string
): Promise<ServiceResult<EstimateSnapshotReviewRow>> {
  const { data, error } = await db
    .from('estimate_snapshot')
    .select(
      [
        'id',
        'org_id',
        'job_id',
        'estimated_labor_hours',
        'estimated_paint_gallons',
        'estimated_paint_material_cost',
        'estimated_supplies_cost',
        'estimated_other_cost',
        'estimated_access_cost',
        'estimated_total',
      ].join(', ')
    )
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .eq('id', estimateSnapshotId)
    .maybeSingle<EstimateSnapshotReviewRow>()

  if (error) return errorResult('server_error', error.message ?? 'Unable to load estimate snapshot.')
  if (!data) return errorResult('not_found', 'Estimate snapshot not found for this job.')
  return okResult(data)
}

async function loadSubmittedActuals(
  db: DbClient,
  orgId: string,
  jobId: string,
  estimateSnapshotId: string
): Promise<ServiceResult<JobActualsReviewRow>> {
  const { data, error } = await db
    .from('job_actuals')
    .select(
      [
        'id',
        'org_id',
        'job_id',
        'estimate_snapshot_id',
        'actual_labor_hours',
        'actual_paint_gallons',
        'actual_supplies_cost',
        'actual_other_cost',
        'status',
      ].join(', ')
    )
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .eq('estimate_snapshot_id', estimateSnapshotId)
    .maybeSingle<JobActualsReviewRow>()

  if (error) return errorResult('server_error', error.message ?? 'Unable to load job actuals.')
  if (!data) return errorResult('not_found', 'Submitted or locked job actuals not found.')
  if (data.status !== 'submitted' && data.status !== 'locked') {
    return errorResult('conflict', 'Job review requires submitted or locked job actuals.')
  }
  return okResult(data)
}

async function loadReviewRow(
  db: DbClient,
  orgId: string,
  jobId: string,
  estimateSnapshotId: string
) {
  return db
    .from('job_review')
    .select(reviewSelect)
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .eq('estimate_snapshot_id', estimateSnapshotId)
    .maybeSingle<JobReviewRow>()
}

async function loadReviewMetrics(db: DbClient, reviewId: string) {
  return db
    .from('job_review_metric')
    .select(metricSelect)
    .eq('job_review_id', reviewId)
    .order('metric_key', { ascending: true }) as unknown as Promise<QueryListResponse<JobReviewMetricRow>>
}

function withComputedTrendEligibility<T extends JobReviewRow>(review: T): T {
  return { ...review, trend_eligible: isJobReviewTrendEligible(review) }
}

function previewReviewMetrics(params: {
  review: Pick<JobReviewRow, 'id' | 'org_id' | 'job_id' | 'estimate_snapshot_id'>
  snapshot: EstimateSnapshotReviewRow
  actuals: JobActualsReviewRow
}) {
  return computeJobReviewMetrics({
    orgId: params.review.org_id,
    jobId: params.review.job_id,
    estimateSnapshotId: params.review.estimate_snapshot_id,
    jobReviewId: params.review.id,
    snapshot: params.snapshot,
    actuals: params.actuals,
  })
}

async function readReviewMetrics(
  db: DbClient,
  review: JobReviewRow,
  snapshot: EstimateSnapshotReviewRow,
  actuals: JobActualsReviewRow
): Promise<ServiceResult<JobReviewMetricRow[]>> {
  if (review.status === 'locked') {
    const existing = await loadReviewMetrics(db, review.id)
    if (existing.error) {
      return errorResult('server_error', existing.error.message ?? 'Unable to load review metrics.')
    }
    return okResult(existing.data ?? [])
  }

  return okResult(previewReviewMetrics({ review, snapshot, actuals }))
}

async function persistReviewMetrics(
  db: DbClient,
  review: JobReviewRow,
  snapshot: EstimateSnapshotReviewRow,
  actuals: JobActualsReviewRow
): Promise<ServiceResult<JobReviewMetricRow[]>> {
  const deleted = (await db
    .from('job_review_metric')
    .delete()
    .eq('job_review_id', review.id)) as QueryListResponse<unknown>
  if (deleted.error) {
    return errorResult('server_error', deleted.error.message ?? 'Unable to refresh review metrics.')
  }

  const metrics = previewReviewMetrics({ review, snapshot, actuals })
  const inserted = await db
    .from('job_review_metric')
    .insert(metrics as unknown as Array<Record<string, unknown>>)
    .select(metricSelect)
    .order('metric_key', { ascending: true }) as unknown as QueryListResponse<JobReviewMetricRow>

  if (inserted.error) {
    return errorResult('server_error', inserted.error.message ?? 'Unable to save review metrics.')
  }
  return okResult(inserted.data ?? metrics)
}

async function loadReviewReadModel(params: {
  db: DbClient
  orgId: string
  jobId: string
  estimateSnapshotId: string
  review: JobReviewRow | null
  snapshot: EstimateSnapshotReviewRow
  actuals: JobActualsReviewRow
}): Promise<ServiceResult<JobReviewReadModel>> {
  const trendEligibilityPreview = buildJobReviewTrendEligibilityPreview()
  if (!params.review) {
    return okResult({
      review: null,
      metrics: computeJobReviewMetrics({
        orgId: params.orgId,
        jobId: params.jobId,
        estimateSnapshotId: params.estimateSnapshotId,
        jobReviewId: '00000000-0000-4000-8000-000000000000',
        snapshot: params.snapshot,
        actuals: params.actuals,
      }),
      trend_eligible: false,
      trend_eligibility_preview: trendEligibilityPreview,
    })
  }

  const metrics = await readReviewMetrics(
    params.db,
    params.review,
    params.snapshot,
    params.actuals
  )
  if (!metrics.ok) return metrics
  const review = withComputedTrendEligibility(params.review)
  return okResult({
    review,
    metrics: metrics.data,
    trend_eligible: review.trend_eligible,
    trend_eligibility_preview: trendEligibilityPreview,
  })
}

export async function loadJobReview(
  orgId: string,
  jobId: string,
  estimateSnapshotId: string,
  deps?: ReviewDeps
): Promise<ServiceResult<JobReviewReadModel>> {
  const db = getDb(deps)
  const snapshot = await loadSnapshot(db, orgId, jobId, estimateSnapshotId)
  if (!snapshot.ok) return snapshot

  const actuals = await loadSubmittedActuals(db, orgId, jobId, estimateSnapshotId)
  if (!actuals.ok) return actuals

  const existing = await loadReviewRow(db, orgId, jobId, estimateSnapshotId)
  if (existing.error) {
    return errorResult('server_error', existing.error.message ?? 'Unable to load job review.')
  }

  return loadReviewReadModel({
    db,
    orgId,
    jobId,
    estimateSnapshotId,
    review: existing.data ? withComputedTrendEligibility(existing.data) : null,
    snapshot: snapshot.data,
    actuals: actuals.data,
  })
}

function isUniqueConflict(error: ReviewDbError | null) {
  const message = (error?.message ?? '').toLowerCase()
  return error?.code === '23505' || message.includes('duplicate') || message.includes('unique')
}

export async function saveJobReview(
  params: {
    orgId: string
    jobId: string
    userId: string
    input: JobReviewInput
  },
  deps?: ReviewDeps
): Promise<ServiceResult<JobReviewReadModel>> {
  const db = getDb(deps)
  const snapshot = await loadSnapshot(db, params.orgId, params.jobId, params.input.estimate_snapshot_id)
  if (!snapshot.ok) return snapshot

  const actuals = await loadSubmittedActuals(
    db,
    params.orgId,
    params.jobId,
    params.input.estimate_snapshot_id
  )
  if (!actuals.ok) return actuals

  const existing = await loadReviewRow(
    db,
    params.orgId,
    params.jobId,
    params.input.estimate_snapshot_id
  )
  if (existing.error) {
    return errorResult('server_error', existing.error.message ?? 'Unable to inspect job review.')
  }
  if (existing.data?.status === 'locked') {
    return errorResult('conflict', 'Locked job reviews cannot be changed.')
  }

  const now = (deps?.now?.() ?? new Date()).toISOString()
  const payload = {
    job_actuals_id: actuals.data.id,
    primary_cause_tag: params.input.primary_cause_tag,
    review_notes: params.input.review_notes,
    status: params.input.status,
    exclude_from_trends: params.input.exclude_from_trends,
    data_quality_status: params.input.data_quality_status,
    change_order_present: params.input.change_order_present,
    reviewed_at: params.input.status === 'reviewed' ? existing.data?.reviewed_at ?? now : null,
    updated_by: params.userId,
  }

  let reviewResult: QueryResponse<JobReviewRow>
  if (existing.data) {
    reviewResult = await db
      .from('job_review')
      .update(payload)
      .eq('org_id', params.orgId)
      .eq('job_id', params.jobId)
      .eq('estimate_snapshot_id', params.input.estimate_snapshot_id)
      .select(reviewSelect)
      .single<JobReviewRow>()
  } else {
    reviewResult = await db
      .from('job_review')
      .insert({
        org_id: params.orgId,
        job_id: params.jobId,
        estimate_snapshot_id: params.input.estimate_snapshot_id,
        created_by: params.userId,
        ...payload,
      })
      .select(reviewSelect)
      .single<JobReviewRow>()
  }

  if (reviewResult.error || !reviewResult.data) {
    if (isUniqueConflict(reviewResult.error)) {
      return errorResult('conflict', 'Job review already exists for this estimate snapshot.')
    }
    return errorResult('server_error', reviewResult.error?.message ?? 'Unable to save job review.')
  }

  const review = withComputedTrendEligibility(reviewResult.data)
  const metrics = await persistReviewMetrics(db, review, snapshot.data, actuals.data)
  if (!metrics.ok) return metrics

  return okResult({
    review,
    metrics: metrics.data,
    trend_eligible: review.trend_eligible,
    trend_eligibility_preview: buildJobReviewTrendEligibilityPreview(),
  })
}

export async function lockJobReview(
  params: { orgId: string; jobId: string; userId: string; estimateSnapshotId: string },
  deps?: ReviewDeps
): Promise<ServiceResult<JobReviewReadModel>> {
  const db = getDb(deps)
  const snapshot = await loadSnapshot(db, params.orgId, params.jobId, params.estimateSnapshotId)
  if (!snapshot.ok) return snapshot

  const actuals = await loadSubmittedActuals(db, params.orgId, params.jobId, params.estimateSnapshotId)
  if (!actuals.ok) return actuals

  const existing = await loadReviewRow(db, params.orgId, params.jobId, params.estimateSnapshotId)
  if (existing.error) {
    return errorResult('server_error', existing.error.message ?? 'Unable to inspect job review.')
  }
  if (!existing.data) return errorResult('not_found', 'Job review not found.')
  if (existing.data.status === 'locked') {
    return errorResult('conflict', 'Job review is already locked.')
  }

  const refreshed = await persistReviewMetrics(db, existing.data, snapshot.data, actuals.data)
  if (!refreshed.ok) return refreshed

  const now = (deps?.now?.() ?? new Date()).toISOString()
  const { data, error } = await db
    .from('job_review')
    .update({
      job_actuals_id: actuals.data.id,
      status: 'locked',
      reviewed_at: existing.data.reviewed_at ?? now,
      locked_at: now,
      updated_by: params.userId,
    })
    .eq('org_id', params.orgId)
    .eq('job_id', params.jobId)
    .eq('estimate_snapshot_id', params.estimateSnapshotId)
    .select(reviewSelect)
    .single<JobReviewRow>()

  if (error || !data) {
    return errorResult('server_error', error?.message ?? 'Unable to lock job review.')
  }

  return okResult({
    review: withComputedTrendEligibility(data),
    metrics: refreshed.data,
    trend_eligible: isJobReviewTrendEligible(data),
    trend_eligibility_preview: buildJobReviewTrendEligibilityPreview(),
  })
}
