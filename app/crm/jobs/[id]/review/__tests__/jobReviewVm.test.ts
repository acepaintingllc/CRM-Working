import { describe, expect, it } from 'vitest'
import { buildJobReviewVm } from '../_lib/jobReviewVm'
import { buildJobReviewFormState } from '@/lib/estimate-feedback/forms'
import type { JobReviewReadModel, JobReviewRecord } from '@/types/jobs/feedback'
import type { JobDetail } from '@/types/jobs/api'

const job = {
  id: 'job-1',
  title: 'Interior repaint',
  accepted_quote: {
    estimate_id: 'estimate-1',
    accepted_public_version_id: 'public-version-1',
    public_version_number: 2,
    public_token: 'public-token-1',
    accepted_at: '2026-04-29T10:00:00.000Z',
    accepted_by_legal_name: 'Jordan Customer',
    signature_type: 'typed',
    user_agent: null,
    ip: null,
    version_name: 'Accepted option',
    estimate_snapshot_id: 'snapshot-1',
    estimated_labor_hours: 20,
    estimated_paint_gallons: 6.5,
    estimated_supplies_cost: 140,
    estimated_other_cost: 25,
    final_total: 4250,
  },
} as JobDetail

const baseModel: JobReviewReadModel = {
  review: null,
  trend_eligible: false,
  trend_eligibility_preview: {
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
  },
  metrics: [
    {
      job_review_id: 'review-1',
      org_id: 'org-1',
      job_id: 'job-1',
      estimate_snapshot_id: 'snapshot-1',
      metric_key: 'labor',
      metric_label: 'Labor variance',
      unit: 'hours',
      estimated_value: 20,
      actual_value: 24,
      variance_value: 4,
      total_impact: 240,
      variance_percent: 20,
      tolerance_percent: 10,
      within_tolerance: false,
    },
    {
      job_review_id: 'review-1',
      org_id: 'org-1',
      job_id: 'job-1',
      estimate_snapshot_id: 'snapshot-1',
      metric_key: 'supplies',
      metric_label: 'Supplies variance',
      unit: 'currency',
      estimated_value: 140,
      actual_value: 145,
      variance_value: 5,
      total_impact: 5,
      variance_percent: 3.57,
      tolerance_percent: 10,
      within_tolerance: true,
    },
  ],
}

function reviewRecord(overrides: Partial<JobReviewRecord> = {}): JobReviewRecord {
  return {
    id: 'review-1',
    org_id: 'org-1',
    job_id: 'job-1',
    estimate_snapshot_id: 'snapshot-1',
    job_actuals_id: 'actuals-1',
    primary_cause_tag: 'scope_missed',
    review_notes: 'Missed trim prep.',
    status: 'draft',
    exclude_from_trends: false,
    data_quality_status: 'valid',
    change_order_present: false,
    trend_eligible: false,
    reviewed_at: null,
    locked_at: null,
    created_at: '2026-05-01T09:00:00.000Z',
    updated_at: '2026-05-01T11:00:00.000Z',
    created_by: 'user-1',
    updated_by: 'user-1',
    ...overrides,
  }
}

describe('job review VM', () => {
  it('renders API-computed metrics without requiring a persisted review row', () => {
    const vm = buildJobReviewVm({ job, model: baseModel })

    expect(vm?.estimateSnapshotId).toBe('snapshot-1')
    expect(vm?.statusLabel).toBe('Draft')
    expect(vm?.isLocked).toBe(false)
    expect(vm?.trendEligibleLabel).toBe('Eligible when locked')
    expect(vm?.hasUnsavedTrendEligibilityChanges).toBe(false)
    expect(vm?.kpis).toContainEqual({
      id: 'largest-variance',
      label: 'Largest variance',
      value: '+$240',
      detail: 'Labor variance',
    })
    expect(vm?.metrics[0]).toMatchObject({
      key: 'labor',
      estimate: '20 hr',
      actual: '24 hr',
      variance: '+4 hr',
      variancePercent: '+20%',
      totalImpact: '+$240',
      tone: 'warning',
    })
  })

  it('marks locked reviews read-only and trend eligible from the API read model', () => {
    const model: JobReviewReadModel = {
      ...baseModel,
      trend_eligible: true,
      review: reviewRecord({
        status: 'locked',
        exclude_from_trends: false,
        data_quality_status: 'valid',
        change_order_present: false,
        trend_eligible: true,
        reviewed_at: '2026-05-01T10:00:00.000Z',
        locked_at: '2026-05-01T11:00:00.000Z',
      }),
    }

    expect(buildJobReviewFormState(model)).toEqual({
      primary_cause_tag: 'scope_missed',
      review_notes: 'Missed trim prep.',
      data_quality_status: 'valid',
      exclude_from_trends: false,
      change_order_present: false,
    })

    const vm = buildJobReviewVm({ job, model })
    expect(vm?.statusLabel).toBe('Locked')
    expect(vm?.isLocked).toBe(true)
    expect(vm?.trendEligibleLabel).toBe('Trend eligible')
    expect(vm?.trendEligibleTone).toBe('success')
    expect(vm?.dataQualityLabel).toBe('Quality: Valid')
    expect(vm?.exclusionLabel).toBe('Included if locked')
    expect(vm?.changeOrderLabel).toBe('No change order')
  })

  it('makes questionable and excluded review state visible in the VM', () => {
    const model: JobReviewReadModel = {
      ...baseModel,
      trend_eligible: false,
      review: reviewRecord({
        primary_cause_tag: 'change_order',
        review_notes: null,
        status: 'locked',
        exclude_from_trends: true,
        data_quality_status: 'questionable',
        change_order_present: true,
        trend_eligible: false,
        reviewed_at: '2026-05-01T10:00:00.000Z',
        locked_at: '2026-05-01T11:00:00.000Z',
      }),
    }

    const vm = buildJobReviewVm({ job, model })

    expect(vm?.trendEligibleLabel).toBe('Not trend eligible')
    expect(vm?.trendEligibleTone).toBe('warning')
    expect(vm?.dataQualityLabel).toBe('Quality: Questionable')
    expect(vm?.exclusionLabel).toBe('Excluded from trends')
    expect(vm?.changeOrderLabel).toBe('Change order present')
  })

  it('previews questionable and invalid draft quality as not trend eligible', () => {
    const model: JobReviewReadModel = {
      ...baseModel,
      review: reviewRecord({ data_quality_status: 'valid' }),
    }

    const questionableVm = buildJobReviewVm({
      job,
      model,
      form: {
        ...buildJobReviewFormState(model),
        data_quality_status: 'questionable',
      },
    })
    expect(questionableVm?.statusLabel).toBe('Draft')
    expect(questionableVm?.trendEligibleLabel).toBe('Not trend eligible')
    expect(questionableVm?.dataQualityLabel).toBe('Quality: Questionable')
    expect(questionableVm?.hasUnsavedTrendEligibilityChanges).toBe(true)

    const invalidVm = buildJobReviewVm({
      job,
      model,
      form: {
        ...buildJobReviewFormState(model),
        data_quality_status: 'invalid',
      },
    })
    expect(invalidVm?.trendEligibleLabel).toBe('Not trend eligible')
    expect(invalidVm?.dataQualityLabel).toBe('Quality: Invalid')
  })

  it('relies on the server preview field for draft eligibility instead of local rule encoding', () => {
    const vm = buildJobReviewVm({
      job,
      model: {
        ...baseModel,
        trend_eligibility_preview: {
          included: {
            valid: false,
            questionable: false,
            invalid: false,
          },
          excluded: {
            valid: false,
            questionable: false,
            invalid: false,
          },
        },
      },
    })

    expect(vm?.trendEligibleLabel).toBe('Not trend eligible')
    expect(vm?.trendEligibilityDetail).toBe('Current form is excluded from trends.')
  })

  it('previews exclude-from-trends and change-order changes from the current form', () => {
    const model: JobReviewReadModel = {
      ...baseModel,
      review: reviewRecord(),
    }

    const vm = buildJobReviewVm({
      job,
      model,
      form: {
        ...buildJobReviewFormState(model),
        exclude_from_trends: true,
        change_order_present: true,
      },
    })

    expect(vm?.trendEligibleLabel).toBe('Not trend eligible')
    expect(vm?.exclusionLabel).toBe('Excluded from trends')
    expect(vm?.changeOrderLabel).toBe('Change order present')
    expect(vm?.hasUnsavedChanges).toBe(true)
    expect(vm?.hasUnsavedTrendEligibilityChanges).toBe(true)
  })

  it('keeps reviewed saved status separate from an unsaved eligibility preview', () => {
    const model: JobReviewReadModel = {
      ...baseModel,
      review: reviewRecord({
        status: 'reviewed',
        reviewed_at: '2026-05-01T10:00:00.000Z',
      }),
    }

    const vm = buildJobReviewVm({
      job,
      model,
      form: {
        ...buildJobReviewFormState(model),
        data_quality_status: 'invalid',
      },
    })

    expect(vm?.statusLabel).toBe('Reviewed')
    expect(vm?.isReviewed).toBe(true)
    expect(vm?.trendEligibleLabel).toBe('Not trend eligible')
    expect(vm?.trendEligibilityDetail).toBe('Unsaved form changes affect trend eligibility.')
  })

  it('returns no VM until an accepted estimate snapshot is available', () => {
    const vm = buildJobReviewVm({
      job: { ...job, accepted_quote: { ...job.accepted_quote!, estimate_snapshot_id: null } },
      model: baseModel,
    })

    expect(vm).toBeNull()
  })
})
