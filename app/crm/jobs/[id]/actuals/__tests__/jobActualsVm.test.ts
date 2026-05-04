import { describe, expect, it } from 'vitest'
import { buildJobActualsVm } from '../_lib/jobActualsVm'
import { buildJobActualsFormState } from '@/lib/estimate-feedback/forms'
import type { JobDetail } from '@/types/jobs/api'
import type { JobActualsRecord } from '@/types/jobs/feedback'

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

describe('job actuals VM', () => {
  it('formats immutable snapshot values against the editable actuals form', () => {
    const vm = buildJobActualsVm({
      job,
      form: {
        actual_labor_hours: '22.5',
        actual_paint_gallons: '6',
        actual_supplies_cost: '175',
        actual_other_cost: '10',
        notes: '',
      },
    })

    expect(vm?.estimateSnapshotId).toBe('snapshot-1')
    expect(vm?.hasInvalidActuals).toBe(false)
    expect(vm?.versionName).toBe('Accepted option')
    expect(vm?.finalTotal).toBe('$4,250')
    expect(vm?.rows).toEqual([
      {
        id: 'actual_labor_hours',
        label: 'Labor hours',
        estimate: '20 hr',
        actual: '22.5 hr',
        variance: '+2.5 hr',
        error: null,
      },
      {
        id: 'actual_paint_gallons',
        label: 'Paint gallons',
        estimate: '6.5 gal',
        actual: '6 gal',
        variance: '-0.5 gal',
        error: null,
      },
      {
        id: 'actual_supplies_cost',
        label: 'Supplies cost',
        estimate: '$140',
        actual: '$175',
        variance: '+$35',
        error: null,
      },
      {
        id: 'actual_other_cost',
        label: 'Other cost',
        estimate: '$25',
        actual: '$10',
        variance: '-$15',
        error: null,
      },
    ])
  })

  it('hydrates existing saved actuals into the editable form state', () => {
    expect(buildJobActualsFormState(actuals())).toEqual({
      actual_labor_hours: '18',
      actual_paint_gallons: '5',
      actual_supplies_cost: '120',
      actual_other_cost: '15',
      notes: 'Saved notes',
    })
  })

  it('previews blank actual fields as zero instead of falling back to saved actuals', () => {
    const vm = buildJobActualsVm({
      job,
      form: {
        actual_labor_hours: '',
        actual_paint_gallons: '5',
        actual_supplies_cost: '120',
        actual_other_cost: '15',
        notes: '',
      },
    })

    expect(vm?.hasInvalidActuals).toBe(false)
    expect(vm?.rows.find((row) => row.id === 'actual_labor_hours')).toMatchObject({
      actual: '0 hr',
      variance: '-20 hr',
      error: null,
    })
  })

  it('keeps explicit zero actual fields distinct from saved values', () => {
    const vm = buildJobActualsVm({
      job,
      form: {
        actual_labor_hours: '18',
        actual_paint_gallons: '0',
        actual_supplies_cost: '120',
        actual_other_cost: '15',
        notes: '',
      },
    })

    expect(vm?.rows.find((row) => row.id === 'actual_paint_gallons')).toMatchObject({
      actual: '0 gal',
      variance: '-6.5 gal',
      error: null,
    })
  })

  it('marks invalid actual fields without calculating a misleading variance', () => {
    const vm = buildJobActualsVm({
      job,
      form: {
        actual_labor_hours: '18',
        actual_paint_gallons: 'bad',
        actual_supplies_cost: '120',
        actual_other_cost: '15',
        notes: '',
      },
    })

    expect(vm?.hasInvalidActuals).toBe(true)
    expect(vm?.rows.find((row) => row.id === 'actual_paint_gallons')).toMatchObject({
      actual: 'Invalid input',
      variance: 'Fix input',
      error: 'Paint gallons must be a non-negative number.',
    })
  })

  it('updates comparison rows from edited actual form values', () => {
    const vm = buildJobActualsVm({
      job,
      form: {
        actual_labor_hours: '19',
        actual_paint_gallons: '5.5',
        actual_supplies_cost: '150',
        actual_other_cost: '0',
        notes: '',
      },
    })

    expect(vm?.rows.map((row) => [row.id, row.actual, row.variance])).toEqual([
      ['actual_labor_hours', '19 hr', '-1 hr'],
      ['actual_paint_gallons', '5.5 gal', '-1 gal'],
      ['actual_supplies_cost', '$150', '+$10'],
      ['actual_other_cost', '$0', '-$25'],
    ])
  })

  it('returns no VM when the job does not expose an immutable estimate snapshot', () => {
    expect(
      buildJobActualsVm({
        job: { ...job, accepted_quote: { ...job.accepted_quote!, estimate_snapshot_id: null } },
        form: buildJobActualsFormState(null),
      })
    ).toBeNull()
  })
})
