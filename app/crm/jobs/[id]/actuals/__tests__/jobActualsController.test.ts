import { describe, expect, it, vi } from 'vitest'
import {
  saveJobActualsDraftFlow,
  submitJobActualsFlow,
} from '../_lib/jobActualsController'
import type { JobActualsRecord } from '@/types/jobs/feedback'
import { buildJobActualsDraftPayload } from '@/lib/estimate-feedback/forms'

function actuals(status: JobActualsRecord['status']): JobActualsRecord {
  return {
    id: `actuals-${status}`,
    org_id: 'org-1',
    job_id: 'job-1',
    estimate_snapshot_id: 'snapshot-1',
    actual_labor_hours: 10,
    actual_paint_gallons: 4,
    actual_supplies_cost: 100,
    actual_other_cost: 20,
    notes: 'Done',
    status,
    submitted_at: status === 'submitted' ? '2026-05-01T10:00:00.000Z' : null,
    locked_at: null,
    created_at: '2026-05-01T09:00:00.000Z',
    updated_at: '2026-05-01T09:00:00.000Z',
    created_by: 'user-1',
    updated_by: 'user-1',
  }
}

const form = {
  actual_labor_hours: '10',
  actual_paint_gallons: '4',
  actual_supplies_cost: '100',
  actual_other_cost: '20',
  notes: ' Done ',
}

describe('job actuals controller flows', () => {
  it('normalizes blank fields to zero in the persisted draft payload', () => {
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

  it('saves a draft through the existing actuals client contract', async () => {
    const saveDraft = vi.fn(async () => ({
      data: actuals('draft'),
      notice: 'Job actuals saved.',
    }))

    const result = await saveJobActualsDraftFlow({
      jobId: 'job-1',
      estimateSnapshotId: 'snapshot-1',
      form,
      saveDraft,
      submit: vi.fn(),
    })

    expect(saveDraft).toHaveBeenCalledWith('job-1', {
      estimate_snapshot_id: 'snapshot-1',
      actual_labor_hours: 10,
      actual_paint_gallons: 4,
      actual_supplies_cost: 100,
      actual_other_cost: 20,
      notes: 'Done',
    })
    expect(result.actuals.status).toBe('draft')
    expect(result.notice).toBe('Job actuals saved.')
  })

  it('submits by saving the current draft first, then calling submit', async () => {
    const saveDraft = vi.fn(async () => ({
      data: actuals('draft'),
      notice: 'Job actuals saved.',
    }))
    const submit = vi.fn(async () => ({
      data: actuals('submitted'),
      notice: 'Job actuals submitted.',
    }))

    const result = await submitJobActualsFlow({
      jobId: 'job-1',
      estimateSnapshotId: 'snapshot-1',
      form,
      saveDraft,
      submit,
    })

    expect(saveDraft).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledWith('job-1', 'snapshot-1')
    expect(result.ok).toBe(true)
    expect(result.savedDraft.actuals.status).toBe('draft')
    expect(result.submitted?.actuals.status).toBe('submitted')
    expect(result.actuals.status).toBe('submitted')
    expect(result.notice).toBe('Job actuals submitted.')
  })

  it('returns the saved draft separately when submit fails after the draft save', async () => {
    const submitError = new Error('Submit endpoint failed.')
    const saveDraft = vi.fn(async () => ({
      data: actuals('draft'),
      notice: 'Draft persisted.',
    }))
    const submit = vi.fn(async () => {
      throw submitError
    })

    const result = await submitJobActualsFlow({
      jobId: 'job-1',
      estimateSnapshotId: 'snapshot-1',
      form,
      saveDraft,
      submit,
    })

    expect(saveDraft).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledWith('job-1', 'snapshot-1')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected submit flow to return a failed result.')
    expect(result.savedDraft.actuals.status).toBe('draft')
    expect(result.submitted).toBeNull()
    expect(result.actuals.status).toBe('draft')
    expect(result.notice).toBe('Draft saved. Actuals were not submitted.')
    expect(result.submitError).toBe(submitError)
  })

  it('does not submit when saving the draft fails', async () => {
    const saveDraft = vi.fn(async () => {
      throw new Error('Draft save failed.')
    })
    const submit = vi.fn()

    await expect(
      submitJobActualsFlow({
        jobId: 'job-1',
        estimateSnapshotId: 'snapshot-1',
        form,
        saveDraft,
        submit,
      })
    ).rejects.toThrow('Draft save failed.')
    expect(submit).not.toHaveBeenCalled()
  })

  it('rejects invalid numeric input before calling the API', async () => {
    const saveDraft = vi.fn()

    await expect(
      saveJobActualsDraftFlow({
        jobId: 'job-1',
        estimateSnapshotId: 'snapshot-1',
        form: { ...form, actual_labor_hours: '-1' },
        saveDraft,
        submit: vi.fn(),
      })
    ).rejects.toThrow('Labor hours must be a non-negative number.')
    expect(saveDraft).not.toHaveBeenCalled()
  })
})
