import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JobReviewReadModel } from '@/types/jobs/feedback'
import type { JobDetail } from '@/types/jobs/api'
import { useJobReviewPage } from '../_hooks/useJobReviewPage'

const mocks = vi.hoisted(() => ({
  loadJobRecord: vi.fn(),
  loadJobReview: vi.fn(),
  repairAcceptedEstimateSnapshot: vi.fn(),
  saveJobReview: vi.fn(),
  lockJobReview: vi.fn(),
  routerPush: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'job-1' }),
  useRouter: () => ({ push: mocks.routerPush }),
}))

vi.mock('@/lib/jobs/client', () => ({
  loadJobRecord: mocks.loadJobRecord,
  loadJobReview: mocks.loadJobReview,
  repairAcceptedEstimateSnapshot: mocks.repairAcceptedEstimateSnapshot,
  saveJobReview: mocks.saveJobReview,
  lockJobReview: mocks.lockJobReview,
}))

const job = {
  id: 'job-1',
  title: 'Interior repaint',
  accepted_quote: {
    estimate_snapshot_id: 'snapshot-1',
    version_name: 'Accepted option',
    estimated_labor_hours: 20,
    estimated_paint_gallons: 6.5,
    estimated_supplies_cost: 140,
    estimated_other_cost: 25,
    final_total: 4250,
  },
} as JobDetail

const review: JobReviewReadModel = {
  review: null,
  trend_eligible: false,
  metrics: [],
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

const reviewedRecord: NonNullable<JobReviewReadModel['review']> = {
  id: 'review-1',
  org_id: 'org-1',
  job_id: 'job-1',
  estimate_snapshot_id: 'snapshot-1',
  job_actuals_id: 'actuals-1',
  primary_cause_tag: null,
  review_notes: null,
  status: 'reviewed',
  exclude_from_trends: false,
  data_quality_status: 'valid',
  change_order_present: false,
  trend_eligible: false,
  reviewed_at: '2026-05-01T10:00:00.000Z',
  locked_at: null,
  created_at: '2026-05-01T09:00:00.000Z',
  updated_at: '2026-05-01T10:00:00.000Z',
  created_by: 'user-1',
  updated_by: 'user-1',
}

describe('useJobReviewPage', () => {
  beforeEach(() => {
    mocks.loadJobRecord.mockReset()
    mocks.loadJobReview.mockReset()
    mocks.repairAcceptedEstimateSnapshot.mockReset()
    mocks.saveJobReview.mockReset()
    mocks.lockJobReview.mockReset()

    mocks.loadJobRecord.mockResolvedValue(job)
    mocks.loadJobReview.mockResolvedValue(review)
    mocks.repairAcceptedEstimateSnapshot.mockResolvedValue({
      data: { estimate_snapshot_id: 'snapshot-1' },
      notice: 'Accepted estimate snapshot repaired.',
    })
    mocks.routerPush.mockReset()
  })

  it('tracks dirty state against the loaded review and clears it after save', async () => {
    const savedModel: JobReviewReadModel = {
      ...review,
      review: {
        ...reviewedRecord,
        primary_cause_tag: 'scope_missed',
        review_notes: 'Saved review notes',
      },
    }
    mocks.saveJobReview.mockResolvedValue({
      data: savedModel,
      notice: 'Review draft saved.',
    })

    const { result } = renderHook(() => useJobReviewPage())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.dirty).toBe(false)

    act(() => {
      result.current.setField('primary_cause_tag', 'scope_missed')
      result.current.setField('review_notes', 'Saved review notes')
    })

    expect(result.current.dirty).toBe(true)

    await act(async () => {
      await result.current.saveDraft()
    })

    expect(result.current.form).toMatchObject({
      primary_cause_tag: 'scope_missed',
      review_notes: 'Saved review notes',
    })
    expect(result.current.dirty).toBe(false)
  })

  it('guards browser unload and back navigation while review classifications are dirty', async () => {
    const { result } = renderHook(() => useJobReviewPage())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setField('data_quality_status', 'questionable')
    })

    expect(result.current.dirty).toBe(true)

    const unloadEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unloadEvent)
    expect(unloadEvent.defaultPrevented).toBe(true)

    act(() => {
      result.current.backToJob()
    })

    expect(mocks.routerPush).not.toHaveBeenCalled()
    expect(result.current.discardVm.isOpen).toBe(true)

    act(() => {
      result.current.confirmBackToJob()
    })

    expect(mocks.routerPush).toHaveBeenCalledWith('/crm/jobs/job-1')
  })

  it('does not mark locked review forms dirty', async () => {
    mocks.loadJobReview.mockResolvedValue({
      ...review,
      review: {
        ...reviewedRecord,
        status: 'locked',
        locked_at: '2026-05-01T11:00:00.000Z',
      },
    })

    const { result } = renderHook(() => useJobReviewPage())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setField('data_quality_status', 'invalid')
    })

    expect(result.current.isReadOnly).toBe(true)
    expect(result.current.dirty).toBe(false)
  })

  it('repairs a missing accepted quote snapshot and reloads review data', async () => {
    const missingSnapshotJob = {
      ...job,
      accepted_quote: {
        ...job.accepted_quote!,
        estimate_snapshot_id: null,
      },
    } as JobDetail
    mocks.loadJobRecord
      .mockResolvedValueOnce(missingSnapshotJob)
      .mockResolvedValueOnce(job)

    const { result } = renderHook(() => useJobReviewPage())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.vm).toBeNull()

    await act(async () => {
      await result.current.repairSnapshot()
    })

    expect(mocks.repairAcceptedEstimateSnapshot).toHaveBeenCalledWith('job-1')
    expect(mocks.loadJobRecord).toHaveBeenCalledTimes(2)
    expect(mocks.loadJobReview).toHaveBeenCalledWith('job-1', 'snapshot-1')
    expect(result.current.vm?.estimateSnapshotId).toBe('snapshot-1')
    expect(result.current.notice).toBe('Accepted estimate snapshot repaired.')
  })

  it('surfaces accepted quote snapshot repair failures without reloading review data', async () => {
    const missingSnapshotJob = {
      ...job,
      accepted_quote: {
        ...job.accepted_quote!,
        estimate_snapshot_id: null,
      },
    } as JobDetail
    mocks.loadJobRecord.mockResolvedValue(missingSnapshotJob)
    mocks.repairAcceptedEstimateSnapshot.mockRejectedValue(new Error('Repair failed.'))

    const { result } = renderHook(() => useJobReviewPage())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.vm).toBeNull()

    let repaired = true
    await act(async () => {
      repaired = await result.current.repairSnapshot()
    })

    expect(repaired).toBe(false)
    expect(mocks.repairAcceptedEstimateSnapshot).toHaveBeenCalledWith('job-1')
    expect(mocks.loadJobRecord).toHaveBeenCalledTimes(1)
    expect(mocks.loadJobReview).not.toHaveBeenCalled()
    expect(result.current.error).toBe('Repair failed.')
    expect(result.current.notice).toBeNull()
    expect(result.current.repairingSnapshot).toBe(false)
  })

  it('updates eligibility preview immediately when form fields change', async () => {
    const reviewedModel: JobReviewReadModel = {
      ...review,
      review: reviewedRecord,
    }
    mocks.loadJobReview.mockResolvedValue(reviewedModel)

    const { result } = renderHook(() => useJobReviewPage())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.vm?.statusLabel).toBe('Reviewed')
    expect(result.current.vm?.trendEligibleLabel).toBe('Eligible when locked')

    act(() => {
      result.current.setField('data_quality_status', 'invalid')
    })

    expect(result.current.vm?.statusLabel).toBe('Reviewed')
    expect(result.current.vm?.trendEligibleLabel).toBe('Not trend eligible')
    expect(result.current.vm?.hasUnsavedTrendEligibilityChanges).toBe(true)

    act(() => {
      result.current.setField('change_order_present', true)
    })

    expect(result.current.vm?.changeOrderLabel).toBe('Change order present')
  })
})
