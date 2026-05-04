import { describe, expect, it } from 'vitest'
import {
  buildJobActualsDraftPayload,
  buildJobActualsFormState,
  buildJobReviewFormState,
  buildJobReviewPayload,
  validateJobActualsForm,
} from '../forms'
import type {
  JobActualsRecord,
  JobReviewReadModel,
} from '@/types/jobs/feedback'

function actuals(overrides: Partial<JobActualsRecord> = {}): JobActualsRecord {
  return {
    id: 'actuals-1',
    org_id: 'org-1',
    job_id: 'job-1',
    estimate_snapshot_id: 'snapshot-1',
    actual_labor_hours: 18,
    actual_paint_gallons: 5,
    actual_supplies_cost: 120,
    actual_other_cost: 15,
    notes: 'Saved notes',
    status: 'draft',
    submitted_at: null,
    locked_at: null,
    created_at: '2026-05-01T09:00:00.000Z',
    updated_at: '2026-05-01T09:00:00.000Z',
    created_by: 'user-1',
    updated_by: 'user-1',
    ...overrides,
  }
}

describe('estimate feedback forms', () => {
  it('hydrates actuals records into editable form state', () => {
    expect(buildJobActualsFormState(actuals())).toEqual({
      actual_labor_hours: '18',
      actual_paint_gallons: '5',
      actual_supplies_cost: '120',
      actual_other_cost: '15',
      notes: 'Saved notes',
    })
  })

  it('validates non-negative actuals drafts and defaults blanks to zero in payloads', () => {
    expect(
      validateJobActualsForm({
        actual_labor_hours: '4',
        actual_paint_gallons: '-1',
        actual_supplies_cost: 'bad',
        actual_other_cost: '',
        notes: '',
      })
    ).toEqual({
      actual_paint_gallons: 'Paint gallons must be a non-negative number.',
      actual_supplies_cost: 'Supplies cost must be a non-negative number.',
    })

    expect(
      buildJobActualsDraftPayload(
        {
          actual_labor_hours: '',
          actual_paint_gallons: '0',
          actual_supplies_cost: '',
          actual_other_cost: '20',
          notes: '  ',
        },
        'snapshot-1'
      )
    ).toEqual({
      estimate_snapshot_id: 'snapshot-1',
      actual_labor_hours: 0,
      actual_paint_gallons: 0,
      actual_supplies_cost: 0,
      actual_other_cost: 20,
      notes: null,
    })
  })

  it('hydrates and normalizes review form payloads without re-encoding metrics', () => {
    const model: JobReviewReadModel = {
      review: {
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
      },
      metrics: [],
      trend_eligible: false,
      trend_eligibility_preview: {
        included: { valid: true, questionable: false, invalid: false },
        excluded: { valid: false, questionable: false, invalid: false },
      },
    }

    expect(buildJobReviewFormState(model)).toEqual({
      primary_cause_tag: 'scope_missed',
      review_notes: 'Missed trim prep.',
      data_quality_status: 'valid',
      exclude_from_trends: false,
      change_order_present: false,
    })

    expect(
      buildJobReviewPayload(
        {
          primary_cause_tag: ' scope_missed ',
          review_notes: ' Missed prep ',
          data_quality_status: 'questionable',
          exclude_from_trends: true,
          change_order_present: true,
        },
        'snapshot-1',
        'reviewed'
      )
    ).toEqual({
      estimate_snapshot_id: 'snapshot-1',
      primary_cause_tag: 'scope_missed',
      review_notes: 'Missed prep',
      status: 'reviewed',
      exclude_from_trends: true,
      data_quality_status: 'questionable',
      change_order_present: true,
    })
  })
})
