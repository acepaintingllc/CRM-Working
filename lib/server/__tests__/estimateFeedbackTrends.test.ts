import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  loadEstimateFeedbackTrends,
  normalizeTrendFilters,
} from '../estimate-feedback/trends.ts'
import { isJobReviewTrendEligible } from '../estimate-feedback/reviewRules.ts'
import type { EstimateFeedbackTrendResolvedFilters } from '../../../types/estimate-feedback/trends.ts'

type TableName = 'job_review' | 'job_review_metric' | 'estimate_snapshot'

function createTrendDb() {
  const filters: Array<{ table: TableName; op: string; column: string; value: unknown }> = []
  const reviews = [
    {
      id: 'review-1',
      org_id: 'org-1',
      job_id: 'job-1',
      estimate_snapshot_id: 'snapshot-1',
      status: 'locked',
      exclude_from_trends: false,
      data_quality_status: 'valid',
      locked_at: '2026-04-10T12:00:00.000Z',
    },
    {
      id: 'review-reviewed',
      org_id: 'org-1',
      job_id: 'job-reviewed',
      estimate_snapshot_id: 'snapshot-reviewed',
      status: 'reviewed',
      exclude_from_trends: false,
      data_quality_status: 'valid',
      locked_at: null,
    },
    {
      id: 'review-invalid',
      org_id: 'org-1',
      job_id: 'job-invalid',
      estimate_snapshot_id: 'snapshot-invalid',
      status: 'locked',
      exclude_from_trends: false,
      data_quality_status: 'invalid',
      locked_at: '2026-04-12T12:00:00.000Z',
    },
    {
      id: 'review-questionable',
      org_id: 'org-1',
      job_id: 'job-questionable',
      estimate_snapshot_id: 'snapshot-questionable',
      status: 'locked',
      exclude_from_trends: false,
      data_quality_status: 'questionable',
      locked_at: '2026-04-12T12:00:00.000Z',
    },
    {
      id: 'review-excluded',
      org_id: 'org-1',
      job_id: 'job-excluded',
      estimate_snapshot_id: 'snapshot-excluded',
      status: 'locked',
      exclude_from_trends: true,
      data_quality_status: 'valid',
      locked_at: '2026-04-13T12:00:00.000Z',
    },
    {
      id: 'review-old',
      org_id: 'org-1',
      job_id: 'job-old',
      estimate_snapshot_id: 'snapshot-old',
      status: 'locked',
      exclude_from_trends: false,
      data_quality_status: 'valid',
      locked_at: '2026-03-01T12:00:00.000Z',
    },
    {
      id: 'review-2',
      org_id: 'org-1',
      job_id: 'job-2',
      estimate_snapshot_id: 'snapshot-2',
      status: 'locked',
      exclude_from_trends: false,
      data_quality_status: 'valid',
      locked_at: '2026-04-14T12:00:00.000Z',
    },
  ].map((review) => ({
    ...review,
    trend_eligible: isJobReviewTrendEligible(review),
  }))
  const metrics = [
    metric('review-1', 'job-1', 'labor', 'Labor variance', 2, 200),
    metric('review-1', 'job-1', 'paint', 'Paint variance', 1, 80),
    metric('review-1', 'job-1', 'supplies', 'Supplies variance', 10, 10),
    metric('review-reviewed', 'job-reviewed', 'labor', 'Labor variance', 99, 99),
    metric('review-invalid', 'job-invalid', 'labor', 'Labor variance', 99, 99),
    metric('review-questionable', 'job-questionable', 'labor', 'Labor variance', 999, 999),
    metric('review-excluded', 'job-excluded', 'labor', 'Labor variance', 99, 99),
    metric('review-old', 'job-old', 'labor', 'Labor variance', 99, 99),
    metric('review-2', 'job-2', 'labor', 'Labor variance', 6, 600),
    metric('review-2', 'job-2', 'paint', 'Paint variance', 3, 150),
    metric('review-2', 'job-2', 'supplies', 'Supplies variance', 20, 20),
  ]
  const snapshots = [
    snapshot('snapshot-1', 'interior', 'occupied room with WALL_TEXTURE condition'),
    snapshot('snapshot-reviewed', 'interior', 'occupied room with WALL_TEXTURE condition'),
    snapshot('snapshot-invalid', 'interior', 'occupied room with WALL_TEXTURE condition'),
    snapshot('snapshot-questionable', 'interior', 'occupied room with WALL_TEXTURE condition'),
    snapshot('snapshot-excluded', 'interior', 'occupied room with WALL_TEXTURE condition'),
    snapshot('snapshot-old', 'interior', 'occupied room with WALL_TEXTURE condition'),
    snapshot('snapshot-2', 'exterior', 'vacant exterior with TRIM_PREP condition'),
  ]

  class Builder {
    private table: TableName
    private predicates: Array<(row: Record<string, unknown>) => boolean> = []

    constructor(table: TableName) {
      this.table = table
    }

    select() {
      return this
    }

    eq(column: string, value: unknown) {
      filters.push({ table: this.table, op: 'eq', column, value })
      this.predicates.push((row) => row[column] === value)
      return this
    }

    gte(column: string, value: unknown) {
      filters.push({ table: this.table, op: 'gte', column, value })
      this.predicates.push((row) => String(row[column] ?? '') >= String(value))
      return this
    }

    lte(column: string, value: unknown) {
      filters.push({ table: this.table, op: 'lte', column, value })
      this.predicates.push((row) => String(row[column] ?? '') <= String(value))
      return this
    }

    in(column: string, value: unknown[]) {
      filters.push({ table: this.table, op: 'in', column, value })
      const accepted = new Set(value)
      this.predicates.push((row) => accepted.has(row[column]))
      return this
    }

    order() {
      return this
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      const run = async () => ({
        data: this.rows().filter((row) => this.predicates.every((predicate) => predicate(row))),
        error: null,
      })
      return run().then(onfulfilled, onrejected)
    }

    private rows(): Array<Record<string, unknown>> {
      if (this.table === 'job_review') return reviews
      if (this.table === 'job_review_metric') return metrics
      return snapshots
    }
  }

  return {
    filters,
    db: {
      from(table: TableName) {
        return new Builder(table)
      },
    },
  }
}

function metric(
  job_review_id: string,
  job_id: string,
  metric_key: string,
  metric_label: string,
  variance_value: number,
  total_impact: number
) {
  return {
    org_id: 'org-1',
    job_review_id,
    job_id,
    metric_key,
    metric_label,
    variance_value,
    total_impact,
  }
}

function snapshot(id: string, estimate_version_kind: string, text: string) {
  return {
    id,
    org_id: 'org-1',
    estimate_version_kind,
    assumptions_json: { jobsettings: { condition_selections: [text] } },
    source_payload_json: { inputs: { notes: text } },
  }
}

async function trends(filters: EstimateFeedbackTrendResolvedFilters) {
  const { db, filters: appliedFilters } = createTrendDb()
  const result = await loadEstimateFeedbackTrends('org-1', filters, { db: db as never })
  assert.equal(result.ok, true)
  return { data: result.data, appliedFilters }
}

describe('estimate feedback trends', () => {
  it('normalizes supported trend filters from route-style input', () => {
    const result = normalizeTrendFilters({
      from: '2026-04-01',
      to: '2026-04-30',
      jobType: 'interior',
      occupancy: 'occupied',
      conditionTags: ['WALL_TEXTURE, TRIM_PREP'],
      maxAbsoluteVariance: '12.5',
      maxAbsoluteTotalImpact: '100',
    })

    assert.equal(result.ok, true)
    assert.deepEqual(result.ok && result.data, {
      from: '2026-04-01',
      to: '2026-04-30',
      jobType: 'interior',
      occupancy: 'occupied',
      conditionTags: ['WALL_TEXTURE', 'TRIM_PREP'],
      maxAbsoluteVariance: 12.5,
      maxAbsoluteTotalImpact: 100,
    })
    assert.deepEqual(normalizeTrendFilters({ maxAbsoluteVariance: '-1' }), {
      ok: false,
      kind: 'invalid_input',
      message: 'maxAbsoluteVariance must be a positive number.',
    })
  })

  it('queries the canonical trend eligibility column before aggregating metrics', async () => {
    const { data, appliedFilters } = await trends({
      from: null,
      to: null,
      jobType: null,
      occupancy: null,
      conditionTags: [],
      maxAbsoluteVariance: null,
      maxAbsoluteTotalImpact: null,
    })

    assert.equal(data.jobsAnalyzed, 3)
    assert.equal(data.averageLaborVariance, (2 + 99 + 6) / 3)
    assert.equal(data.averagePaintVariance, 2)
    assert.equal(data.averageSuppliesVariance, 15)
    assert.equal(data.portfolioImpact, 1_159)
    assert.equal(data.averageMissPerJob, 1_159 / 3)
    assert(appliedFilters.some((filter) => filter.table === 'job_review' && filter.column === 'trend_eligible' && filter.value === true))
    assert.equal(appliedFilters.some((filter) => filter.table === 'job_review' && filter.column === 'status'), false)
    assert.equal(appliedFilters.some((filter) => filter.table === 'job_review' && filter.column === 'data_quality_status'), false)
    assert.equal(appliedFilters.some((filter) => filter.table === 'job_review' && filter.column === 'exclude_from_trends'), false)
    assert.deepEqual(
      appliedFilters.find((filter) => filter.table === 'job_review_metric' && filter.op === 'in' && filter.column === 'job_review_id')?.value,
      ['review-1', 'review-old', 'review-2']
    )
    assert.deepEqual(
      appliedFilters.find((filter) => filter.table === 'estimate_snapshot' && filter.op === 'in' && filter.column === 'id')?.value,
      ['snapshot-1', 'snapshot-old', 'snapshot-2']
    )
  })

  it('optionally trims metric outliers without changing explicit review eligibility rules', async () => {
    const { data } = await trends({
      from: null,
      to: null,
      jobType: null,
      occupancy: null,
      conditionTags: [],
      maxAbsoluteVariance: 50,
      maxAbsoluteTotalImpact: null,
    })

    assert.equal(data.jobsAnalyzed, 2)
    assert.equal(data.averageLaborVariance, 4)
    assert.equal(data.averagePaintVariance, 2)
    assert.equal(data.averageSuppliesVariance, 15)
    assert.equal(data.portfolioImpact, 1_060)
    assert.equal(data.averageMissPerJob, 1_060 / 2)
  })

  it('applies time range, job type, occupancy, and condition filters in the service layer', async () => {
    const { data, appliedFilters } = await trends({
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-30T23:59:59.999Z',
      jobType: 'interior',
      occupancy: 'occupied',
      conditionTags: ['WALL_TEXTURE'],
      maxAbsoluteVariance: null,
      maxAbsoluteTotalImpact: null,
    })

    assert.equal(data.jobsAnalyzed, 1)
    assert.equal(data.averageLaborVariance, 2)
    assert.equal(data.averagePaintVariance, 1)
    assert.equal(data.averageSuppliesVariance, 10)
    assert.equal(data.portfolioImpact, 290)
    assert.equal(data.averageMissPerJob, 290)
    assert(appliedFilters.some((filter) => filter.table === 'job_review' && filter.op === 'gte' && filter.column === 'locked_at'))
    assert(appliedFilters.some((filter) => filter.table === 'job_review' && filter.op === 'lte' && filter.column === 'locked_at'))
    assert.deepEqual(
      appliedFilters.find((filter) => filter.table === 'job_review_metric' && filter.op === 'in' && filter.column === 'job_review_id')?.value,
      ['review-1', 'review-2']
    )
    assert.deepEqual(
      appliedFilters.find((filter) => filter.table === 'estimate_snapshot' && filter.op === 'in' && filter.column === 'id')?.value,
      ['snapshot-1', 'snapshot-2']
    )
  })

  it('treats date-only trend bounds as whole locked-review days', async () => {
    const { data, appliedFilters } = await trends({
      from: '2026-04-10',
      to: '2026-04-10',
      jobType: null,
      occupancy: null,
      conditionTags: [],
      maxAbsoluteVariance: null,
      maxAbsoluteTotalImpact: null,
    })

    assert.equal(data.jobsAnalyzed, 1)
    assert.equal(data.averageLaborVariance, 2)
    assert.deepEqual(
      appliedFilters.find((filter) => filter.table === 'job_review' && filter.op === 'gte' && filter.column === 'locked_at')?.value,
      '2026-04-10T00:00:00.000Z'
    )
    assert.deepEqual(
      appliedFilters.find((filter) => filter.table === 'job_review' && filter.op === 'lte' && filter.column === 'locked_at')?.value,
      '2026-04-10T23:59:59.999Z'
    )
  })

  it('returns an empty summary without loading metrics or snapshots when no reviews are eligible', async () => {
    const { data, appliedFilters } = await trends({
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-31T23:59:59.999Z',
      jobType: null,
      occupancy: null,
      conditionTags: [],
      maxAbsoluteVariance: null,
      maxAbsoluteTotalImpact: null,
    })

    assert.equal(data.jobsAnalyzed, 0)
    assert.equal(data.averageLaborVariance, null)
    assert.equal(data.averagePaintVariance, null)
    assert.equal(data.averageSuppliesVariance, null)
    assert.equal(data.averageMissPerJob, null)
    assert.equal(data.portfolioImpact, 0)
    assert.deepEqual(data.patterns, [])
    assert.equal(appliedFilters.some((filter) => filter.table === 'job_review_metric'), false)
    assert.equal(appliedFilters.some((filter) => filter.table === 'estimate_snapshot'), false)
  })
})
