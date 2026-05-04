import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  JOB_REVIEW_METRIC_TOLERANCE_PERCENT,
  buildJobReviewTrendEligibilityPreview,
  computeJobReviewMetrics,
  isJobReviewTrendEligible,
  loadJobReview,
  lockJobReview,
  normalizeJobReviewInput,
  normalizeReviewSnapshotId,
  saveJobReview,
  type EstimateSnapshotReviewRow,
  type JobActualsReviewRow,
  type JobReviewMetricRow,
  type JobReviewRow,
} from '../estimate-feedback/reviews.ts'

const orgId = '11111111-1111-4111-8111-111111111111'
const jobId = '33333333-3333-4333-8333-333333333333'
const snapshotId = '55555555-5555-4555-8555-555555555555'
const actualsId = '77777777-7777-4777-8777-777777777777'
const userId = '66666666-6666-4666-8666-666666666666'

type DbError = { code?: string | null; message?: string | null }
type TableName = 'estimate_snapshot' | 'job_actuals' | 'job_review' | 'job_review_metric'

function createReviewDb(options: {
  snapshots?: EstimateSnapshotReviewRow[]
  actuals?: JobActualsReviewRow[]
  reviews?: JobReviewRow[]
  metrics?: JobReviewMetricRow[]
  updateError?: DbError | null
} = {}) {
  const snapshots =
    options.snapshots ??
    [
      {
        id: snapshotId,
        org_id: orgId,
        job_id: jobId,
        estimated_labor_hours: 10,
        estimated_paint_gallons: 5,
        estimated_paint_material_cost: 200,
        estimated_supplies_cost: 100,
        estimated_other_cost: 50,
        estimated_access_cost: 150,
        estimated_total: 1_000,
      },
    ]
  const actuals =
    options.actuals ??
    [
      {
        id: actualsId,
        org_id: orgId,
        job_id: jobId,
        estimate_snapshot_id: snapshotId,
        actual_labor_hours: 11,
        actual_paint_gallons: 6,
        actual_supplies_cost: 109,
        actual_other_cost: 75,
        status: 'submitted' as const,
      },
    ]
  const reviews = options.reviews ?? []
  const metrics = options.metrics ?? []
  const operations = {
    metricDeletes: 0,
    metricInserts: 0,
  }

  class Builder {
    private filters: Array<[string, unknown]> = []
    private insertPayload: Record<string, unknown> | Array<Record<string, unknown>> | null = null
    private updatePayload: Record<string, unknown> | null = null
    private deleting = false
    private table: TableName

    constructor(table: TableName) {
      this.table = table
    }

    select() {
      return this
    }

    eq(column: string, value: unknown) {
      this.filters.push([column, value])
      return this
    }

    order() {
      return this
    }

    insert(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
      if (this.table === 'job_review_metric') operations.metricInserts += 1
      this.insertPayload = payload
      return this
    }

    update(payload: Record<string, unknown>) {
      this.updatePayload = payload
      return this
    }

    delete() {
      if (this.table === 'job_review_metric') operations.metricDeletes += 1
      this.deleting = true
      return this
    }

    async maybeSingle<T = unknown>() {
      return { data: (this.rows()[0] ?? null) as T | null, error: null }
    }

    async single<T = unknown>() {
      if (this.insertPayload) return this.performInsert<T>()
      if (this.updatePayload) return this.performUpdate<T>()
      return { data: (this.rows()[0] ?? null) as T | null, error: null }
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: { data: unknown[] | null; error: DbError | null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      const run = async () => {
        if (this.deleting) return this.performDelete()
        if (this.insertPayload) return this.performInsertList()
        return { data: this.rows(), error: null }
      }
      return run().then(onfulfilled, onrejected)
    }

    private source(): Array<Record<string, unknown>> {
      if (this.table === 'estimate_snapshot') return snapshots as unknown as Array<Record<string, unknown>>
      if (this.table === 'job_actuals') return actuals as unknown as Array<Record<string, unknown>>
      if (this.table === 'job_review') return reviews as unknown as Array<Record<string, unknown>>
      return metrics as unknown as Array<Record<string, unknown>>
    }

    private rows() {
      return this.source().filter((row) =>
        this.filters.every(([column, value]) => row[column] === value)
      )
    }

    private withReviewGenerated(row: Record<string, unknown>) {
      return {
        ...row,
        trend_eligible: isJobReviewTrendEligible(row as JobReviewRow),
      }
    }

    private async performInsert<T>() {
      const inserted = this.performInsertRows()
      return { data: inserted[0] as T, error: null }
    }

    private async performInsertList() {
      return { data: this.performInsertRows(), error: null }
    }

    private performInsertRows() {
      const payloads = Array.isArray(this.insertPayload) ? this.insertPayload : [this.insertPayload]
      const inserted = payloads.filter(Boolean).map((payload, index) => {
        const now = '2026-05-03T12:00:00.000Z'
        const row = {
          id: `${this.table}-${this.source().length + index + 1}`,
          created_at: now,
          updated_at: now,
          created_by: null,
          updated_by: null,
          ...(payload as Record<string, unknown>),
        }
        const finalRow = this.table === 'job_review' ? this.withReviewGenerated(row) : row
        this.source().push(finalRow)
        return finalRow
      })
      return inserted
    }

    private async performUpdate<T>() {
      if (options.updateError) return { data: null as T | null, error: options.updateError }
      const row = this.rows()[0]
      if (!row) return { data: null as T | null, error: { message: 'No rows updated' } }
      if (this.table === 'job_review' && row.status === 'locked') {
        return { data: null as T | null, error: { message: 'locked job review is immutable' } }
      }
      Object.assign(row, this.updatePayload, { updated_at: '2026-05-03T12:01:00.000Z' })
      const finalRow = this.table === 'job_review' ? this.withReviewGenerated(row) : row
      Object.assign(row, finalRow)
      return { data: finalRow as T, error: null }
    }

    private async performDelete() {
      const source = this.source()
      const before = source.length
      for (let index = source.length - 1; index >= 0; index -= 1) {
        const row = source[index]
        if (this.filters.every(([column, value]) => row[column] === value)) {
          source.splice(index, 1)
        }
      }
      return { data: [], error: before >= source.length ? null : { message: 'Delete failed' } }
    }
  }

  return {
    db: {
      from(table: TableName) {
        return new Builder(table)
      },
    },
    reviews,
    metrics,
    operations,
  }
}

function createReview(overrides: Partial<JobReviewRow> = {}): JobReviewRow {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    org_id: orgId,
    job_id: jobId,
    estimate_snapshot_id: snapshotId,
    job_actuals_id: actualsId,
    primary_cause_tag: null,
    review_notes: null,
    status: 'draft',
    exclude_from_trends: false,
    data_quality_status: 'valid',
    change_order_present: false,
    trend_eligible: false,
    reviewed_at: null,
    locked_at: null,
    created_at: '2026-05-03T12:00:00.000Z',
    updated_at: '2026-05-03T12:00:00.000Z',
    created_by: userId,
    updated_by: userId,
    ...overrides,
  }
}

describe('job review service', () => {
  it('rejects invalid UUID input before persistence', () => {
    assert.deepEqual(normalizeReviewSnapshotId('not-a-uuid'), {
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid estimate snapshot id.',
    })
    assert.deepEqual(
      normalizeJobReviewInput({
        estimate_snapshot_id: 'not-a-uuid',
        primary_cause_tag: null,
        status: 'draft',
      }),
      {
        ok: false,
        kind: 'invalid_input',
        message: 'Invalid estimate snapshot id.',
      }
    )
  })

  it('normalizes valid review classification cause tags', () => {
    assert.deepEqual(
      normalizeJobReviewInput({
        estimate_snapshot_id: snapshotId,
        primary_cause_tag: ' scope_missed ',
        review_notes: ' Missed prep ',
        status: 'reviewed',
        exclude_from_trends: true,
        data_quality_status: 'questionable',
        change_order_present: true,
      }),
      {
        ok: true,
        data: {
          estimate_snapshot_id: snapshotId,
          primary_cause_tag: 'scope_missed',
          review_notes: 'Missed prep',
          status: 'reviewed',
          exclude_from_trends: true,
          data_quality_status: 'questionable',
          change_order_present: true,
        },
      }
    )
  })

  it('normalizes blank review classification cause tags to null', () => {
    const result = normalizeJobReviewInput({
      estimate_snapshot_id: snapshotId,
      primary_cause_tag: ' ',
      status: 'draft',
    })

    assert.equal(result.ok, true)
    assert.equal(result.ok && result.data.primary_cause_tag, null)
  })

  it('rejects review classification cause tags outside the canonical taxonomy', () => {
    assert.deepEqual(
      normalizeJobReviewInput({
        estimate_snapshot_id: snapshotId,
        primary_cause_tag: 'scope_miss',
        status: 'draft',
      }),
      {
        ok: false,
        kind: 'invalid_input',
        message: 'primary_cause_tag is not allowed.',
      }
    )
  })

  it('computes variance math, percent, and tolerance per metric', () => {
    const metrics = computeJobReviewMetrics({
      orgId,
      jobId,
      estimateSnapshotId: snapshotId,
      jobReviewId: 'review-1',
      snapshot: {
        id: snapshotId,
        org_id: orgId,
        job_id: jobId,
        estimated_labor_hours: 10,
        estimated_paint_gallons: 0,
        estimated_paint_material_cost: 120,
        estimated_supplies_cost: 100,
        estimated_other_cost: 50,
        estimated_access_cost: 150,
        estimated_total: 1_000,
      },
      actuals: {
        id: actualsId,
        org_id: orgId,
        job_id: jobId,
        estimate_snapshot_id: snapshotId,
        actual_labor_hours: 11,
        actual_paint_gallons: 2,
        actual_supplies_cost: 109,
        actual_other_cost: 65,
        status: 'submitted',
      },
    })

    const labor = metrics.find((row) => row.metric_key === 'labor')
    const paint = metrics.find((row) => row.metric_key === 'paint')
    const supplies = metrics.find((row) => row.metric_key === 'supplies')
    const other = metrics.find((row) => row.metric_key === 'other')

    assert.equal(labor?.variance_value, 1)
    assert.equal(labor?.total_impact, 58)
    assert.equal(labor?.variance_percent, 10)
    assert.equal(labor?.within_tolerance, true)
    assert.equal(labor?.tolerance_percent, JOB_REVIEW_METRIC_TOLERANCE_PERCENT)
    assert.equal(paint?.variance_value, 2)
    assert.equal(paint?.total_impact, 0)
    assert.equal(paint?.variance_percent, null)
    assert.equal(paint?.within_tolerance, false)
    assert.equal(supplies?.variance_value, 9)
    assert.equal(supplies?.total_impact, 9)
    assert.equal(supplies?.within_tolerance, true)
    assert.equal(other?.variance_percent, 30)
    assert.equal(other?.total_impact, 15)
    assert.equal(other?.within_tolerance, false)
  })

  it('treats the metric tolerance boundary as inclusive and rejects values beyond it', () => {
    const exactBoundary = computeJobReviewMetrics({
      orgId,
      jobId,
      estimateSnapshotId: snapshotId,
      jobReviewId: 'review-1',
      snapshot: {
        id: snapshotId,
        org_id: orgId,
        job_id: jobId,
        estimated_labor_hours: 10,
        estimated_paint_gallons: 1,
        estimated_paint_material_cost: 100,
        estimated_supplies_cost: 100,
        estimated_other_cost: 100,
        estimated_access_cost: 100,
        estimated_total: 1_000,
      },
      actuals: {
        id: actualsId,
        org_id: orgId,
        job_id: jobId,
        estimate_snapshot_id: snapshotId,
        actual_labor_hours: 11,
        actual_paint_gallons: 1,
        actual_supplies_cost: 100,
        actual_other_cost: 100,
        status: 'submitted',
      },
    }).find((row) => row.metric_key === 'labor')
    const overBoundary = computeJobReviewMetrics({
      orgId,
      jobId,
      estimateSnapshotId: snapshotId,
      jobReviewId: 'review-1',
      snapshot: {
        id: snapshotId,
        org_id: orgId,
        job_id: jobId,
        estimated_labor_hours: 10,
        estimated_paint_gallons: 1,
        estimated_paint_material_cost: 100,
        estimated_supplies_cost: 100,
        estimated_other_cost: 100,
        estimated_access_cost: 100,
        estimated_total: 1_000,
      },
      actuals: {
        id: actualsId,
        org_id: orgId,
        job_id: jobId,
        estimate_snapshot_id: snapshotId,
        actual_labor_hours: 11.01,
        actual_paint_gallons: 1,
        actual_supplies_cost: 100,
        actual_other_cost: 100,
        status: 'submitted',
      },
    }).find((row) => row.metric_key === 'labor')

    assert.equal(exactBoundary?.variance_percent, JOB_REVIEW_METRIC_TOLERANCE_PERCENT)
    assert.equal(exactBoundary?.within_tolerance, true)
    assert((overBoundary?.variance_percent ?? 0) > JOB_REVIEW_METRIC_TOLERANCE_PERCENT)
    assert.equal(overBoundary?.within_tolerance, false)
  })

  it('loads preview metrics without persisting rows when no review exists', async () => {
    const { db, metrics, operations } = createReviewDb()

    const result = await loadJobReview(orgId, jobId, snapshotId, { db: db as never })

    assert.equal(result.ok, true)
    assert.equal(result.ok && result.data.review, null)
    assert.equal(result.ok && result.data.metrics.length, 4)
    assert.deepEqual(
      result.ok && result.data.trend_eligibility_preview,
      buildJobReviewTrendEligibilityPreview()
    )
    assert.equal(metrics.length, 0)
    assert.equal(operations.metricDeletes, 0)
    assert.equal(operations.metricInserts, 0)
  })

  it('loads unlocked review preview metrics without deleting or inserting persisted rows', async () => {
    const review = createReview({ status: 'reviewed' })
    const staleMetric: JobReviewMetricRow = {
      id: '88888888-8888-4888-8888-888888888888',
      org_id: orgId,
      job_id: jobId,
      estimate_snapshot_id: snapshotId,
      job_review_id: review.id,
      metric_key: 'labor',
      metric_label: 'Stale labor',
      unit: 'hours',
      estimated_value: 1,
      actual_value: 1,
      variance_value: 0,
      total_impact: 0,
      variance_percent: 0,
      tolerance_percent: 10,
      within_tolerance: true,
    }
    const { db, metrics, operations } = createReviewDb({
      reviews: [review],
      metrics: [staleMetric],
    })

    const result = await loadJobReview(orgId, jobId, snapshotId, { db: db as never })

    assert.equal(result.ok, true)
    assert.equal(result.ok && result.data.review?.status, 'reviewed')
    assert.equal(result.ok && result.data.metrics.length, 4)
    assert.equal(result.ok && result.data.trend_eligible, false)
    assert.equal(result.ok && result.data.metrics[0].metric_label, 'Labor variance')
    assert.deepEqual(metrics, [staleMetric])
    assert.equal(operations.metricDeletes, 0)
    assert.equal(operations.metricInserts, 0)
  })

  it('loads locked reviews from persisted frozen metrics without refreshing them', async () => {
    const review = createReview({
      status: 'locked',
      trend_eligible: true,
      reviewed_at: '2026-05-03T13:00:00.000Z',
      locked_at: '2026-05-03T14:00:00.000Z',
    })
    const frozenMetric: JobReviewMetricRow = {
      id: '88888888-8888-4888-8888-888888888888',
      org_id: orgId,
      job_id: jobId,
      estimate_snapshot_id: snapshotId,
      job_review_id: review.id,
      metric_key: 'labor',
      metric_label: 'Frozen labor variance',
      unit: 'hours',
      estimated_value: 10,
      actual_value: 99,
      variance_value: 89,
      total_impact: 5_162,
      variance_percent: 890,
      tolerance_percent: 10,
      within_tolerance: false,
    }
    const { db, operations } = createReviewDb({
      reviews: [review],
      metrics: [frozenMetric],
    })

    const result = await loadJobReview(orgId, jobId, snapshotId, { db: db as never })

    assert.equal(result.ok, true)
    assert.deepEqual(result.ok && result.data.metrics, [frozenMetric])
    assert.equal(result.ok && result.data.trend_eligible, true)
    assert.equal(operations.metricDeletes, 0)
    assert.equal(operations.metricInserts, 0)
  })

  it('saves a reviewed review and persists recomputed metrics', async () => {
    const { db, reviews, metrics } = createReviewDb()

    const result = await saveJobReview(
      {
        orgId,
        jobId,
        userId,
        input: {
          estimate_snapshot_id: snapshotId,
          primary_cause_tag: 'scope_missed',
          review_notes: 'Extra prep work.',
          status: 'reviewed',
          exclude_from_trends: false,
          data_quality_status: 'valid',
          change_order_present: false,
        },
      },
      { db: db as never, now: () => new Date('2026-05-03T13:00:00.000Z') }
    )

    assert.equal(result.ok, true)
    assert.equal(reviews.length, 1)
    assert.equal(reviews[0].status, 'reviewed')
    assert.equal(reviews[0].reviewed_at, '2026-05-03T13:00:00.000Z')
    assert.equal(metrics.length, 4)
    assert.equal(result.ok && result.data.metrics.length, 4)
    assert.deepEqual(
      result.ok && result.data.trend_eligibility_preview,
      buildJobReviewTrendEligibilityPreview()
    )
  })

  it('requires submitted or locked actuals before saving or locking reviews', async () => {
    const { db } = createReviewDb({
      actuals: [
        {
          id: actualsId,
          org_id: orgId,
          job_id: jobId,
          estimate_snapshot_id: snapshotId,
          actual_labor_hours: 10,
          actual_paint_gallons: 5,
          actual_supplies_cost: 100,
          actual_other_cost: 50,
          status: 'draft',
        },
      ],
    })

    const saved = await saveJobReview(
      {
        orgId,
        jobId,
        userId,
        input: {
          estimate_snapshot_id: snapshotId,
          primary_cause_tag: null,
          review_notes: null,
          status: 'draft',
          exclude_from_trends: false,
          data_quality_status: 'valid',
          change_order_present: false,
        },
      },
      { db: db as never }
    )
    assert.deepEqual(saved, {
      ok: false,
      kind: 'conflict',
      message: 'Job review requires submitted or locked job actuals.',
    })
  })

  it('locks reviews, persists the final metric snapshot, and marks eligible reviews', async () => {
    const { db, reviews, metrics, operations } = createReviewDb()
    const saved = await saveJobReview(
      {
        orgId,
        jobId,
        userId,
        input: {
          estimate_snapshot_id: snapshotId,
          primary_cause_tag: null,
          review_notes: null,
          status: 'reviewed',
          exclude_from_trends: false,
          data_quality_status: 'valid',
          change_order_present: false,
        },
      },
      { db: db as never, now: () => new Date('2026-05-03T13:00:00.000Z') }
    )
    assert.equal(saved.ok, true)
    assert.equal(metrics.length, 4)
    const staleMetricCount = metrics.length
    metrics[0].actual_value = 999

    const locked = await lockJobReview(
      { orgId, jobId, userId, estimateSnapshotId: snapshotId },
      { db: db as never, now: () => new Date('2026-05-03T14:00:00.000Z') }
    )
    assert.equal(locked.ok, true)
    assert.equal(reviews[0].status, 'locked')
    assert.equal(locked.ok && locked.data.trend_eligible, true)
    assert.equal(metrics.length, staleMetricCount)
    assert.equal(operations.metricDeletes, 2)
    assert.equal(operations.metricInserts, 2)
    assert.equal(locked.ok && locked.data.metrics.length, 4)
    assert.equal(locked.ok && locked.data.metrics[0].actual_value, 11)

    assert.equal(
      isJobReviewTrendEligible({
        status: 'locked',
        data_quality_status: 'valid',
        exclude_from_trends: false,
      }),
      true
    )
    assert.equal(
      isJobReviewTrendEligible({
        status: 'locked',
        data_quality_status: 'questionable',
        exclude_from_trends: false,
      }),
      false
    )
    assert.equal(
      isJobReviewTrendEligible({
        status: 'locked',
        data_quality_status: 'invalid',
        exclude_from_trends: false,
      }),
      false
    )
    assert.equal(
      isJobReviewTrendEligible({
        status: 'locked',
        data_quality_status: 'valid',
        exclude_from_trends: true,
      }),
      false
    )
    assert.equal(
      isJobReviewTrendEligible({
        status: 'reviewed',
        data_quality_status: 'valid',
        exclude_from_trends: false,
      }),
      false
    )
  })

  it('builds trend preview options for saved and draft classification states', () => {
    assert.deepEqual(buildJobReviewTrendEligibilityPreview(), {
      included: {
        valid: true,
        questionable: false,
        invalid: false,
      },
      excluded: {
        valid: false,
        questionable: false,
        invalid: false,
      },
    })
  })
})
