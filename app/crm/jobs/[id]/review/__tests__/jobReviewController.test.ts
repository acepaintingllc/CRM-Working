import { describe, expect, it, vi } from 'vitest'
import {
  lockJobReviewFlow,
  saveJobReviewFlow,
} from '../_lib/jobReviewController'
import type { JobReviewReadModel } from '@/types/jobs/feedback'
import { buildJobReviewPayload } from '@/lib/estimate-feedback/forms'

const form = {
  primary_cause_tag: ' scope_missed ',
  review_notes: ' Missed prep ',
  data_quality_status: 'questionable' as const,
  exclude_from_trends: true,
  change_order_present: true,
}

const model: JobReviewReadModel = {
  review: null,
  metrics: [],
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
}

describe('job review controller flows', () => {
  it('builds the API payload without metric calculations', () => {
    expect(buildJobReviewPayload(form, 'snapshot-1', 'reviewed')).toEqual({
      estimate_snapshot_id: 'snapshot-1',
      primary_cause_tag: 'scope_missed',
      review_notes: 'Missed prep',
      status: 'reviewed',
      exclude_from_trends: true,
      data_quality_status: 'questionable',
      change_order_present: true,
    })
  })

  it('saves a reviewed state through the existing review API contract', async () => {
    const saveReview = vi.fn(async () => ({
      data: model,
      notice: 'Job review saved.',
    }))

    const result = await saveJobReviewFlow(
      {
        jobId: 'job-1',
        estimateSnapshotId: 'snapshot-1',
        form,
        saveReview,
      },
      'reviewed'
    )

    expect(saveReview).toHaveBeenCalledWith('job-1', {
      estimate_snapshot_id: 'snapshot-1',
      primary_cause_tag: 'scope_missed',
      review_notes: 'Missed prep',
      status: 'reviewed',
      exclude_from_trends: true,
      data_quality_status: 'questionable',
      change_order_present: true,
    })
    expect(result.model).toBe(model)
    expect(result.notice).toBe('Job review saved.')
  })

  it('locks by saving reviewed metadata before calling the lock endpoint', async () => {
    const saveReview = vi.fn(async () => ({
      data: model,
      notice: 'Job review saved.',
    }))
    const lockedModel: JobReviewReadModel = {
      ...model,
      review: {
        id: 'review-1',
        org_id: 'org-1',
        job_id: 'job-1',
        estimate_snapshot_id: 'snapshot-1',
        job_actuals_id: 'actuals-1',
        primary_cause_tag: 'scope_missed',
        review_notes: 'Missed prep',
        status: 'locked',
        exclude_from_trends: true,
        data_quality_status: 'questionable',
        change_order_present: true,
        trend_eligible: false,
        reviewed_at: '2026-05-01T10:00:00.000Z',
        locked_at: '2026-05-01T11:00:00.000Z',
        created_at: '2026-05-01T09:00:00.000Z',
        updated_at: '2026-05-01T11:00:00.000Z',
        created_by: 'user-1',
        updated_by: 'user-1',
      },
    }
    const lockReview = vi.fn(async () => ({
      data: lockedModel,
      notice: 'Job review locked.',
    }))

    const result = await lockJobReviewFlow({
      jobId: 'job-1',
      estimateSnapshotId: 'snapshot-1',
      form,
      saveReview,
      lockReview,
    })

    expect(saveReview).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ status: 'reviewed' })
    )
    expect(lockReview).toHaveBeenCalledWith('job-1', 'snapshot-1')
    expect(result.model.review?.status).toBe('locked')
    expect(result.notice).toBe('Job review locked.')
  })
})
