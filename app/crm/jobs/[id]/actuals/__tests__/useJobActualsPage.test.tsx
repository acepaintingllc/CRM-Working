import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JobActualsDraftPayload, JobActualsRecord } from '@/types/jobs/feedback'
import type { JobDetail } from '@/types/jobs/api'
import { useJobActualsPage } from '../_hooks/useJobActualsPage'

const mocks = vi.hoisted(() => ({
  loadJobRecord: vi.fn(),
  loadJobActuals: vi.fn(),
  repairAcceptedEstimateSnapshot: vi.fn(),
  saveDraftJobActuals: vi.fn(),
  submitJobActuals: vi.fn(),
  routerPush: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'job-1' }),
  useRouter: () => ({ push: mocks.routerPush }),
}))

vi.mock('@/lib/jobs/client', () => ({
  loadJobRecord: mocks.loadJobRecord,
  loadJobActuals: mocks.loadJobActuals,
  repairAcceptedEstimateSnapshot: mocks.repairAcceptedEstimateSnapshot,
  saveDraftJobActuals: mocks.saveDraftJobActuals,
  submitJobActuals: mocks.submitJobActuals,
}))

const job = {
  id: 'job-1',
  title: 'Interior repaint',
  accepted_estimate: {
    estimate_snapshot_id: 'snapshot-1',
    version_name: 'Accepted option',
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
    actual_labor_hours: 5,
    actual_paint_gallons: 2,
    actual_supplies_cost: 40,
    actual_other_cost: 10,
    notes: 'Initial draft',
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

describe('useJobActualsPage', () => {
  beforeEach(() => {
    mocks.loadJobRecord.mockReset()
    mocks.loadJobActuals.mockReset()
    mocks.repairAcceptedEstimateSnapshot.mockReset()
    mocks.saveDraftJobActuals.mockReset()
    mocks.submitJobActuals.mockReset()
    mocks.loadJobRecord.mockResolvedValue(job)
    mocks.loadJobActuals.mockResolvedValue(actuals())
    mocks.repairAcceptedEstimateSnapshot.mockResolvedValue({
      data: { estimate_snapshot_id: 'snapshot-1' },
      notice: 'Accepted quote snapshot repaired.',
    })
    mocks.routerPush.mockReset()
  })

  it('tracks dirty state against the loaded actuals and clears it after draft save', async () => {
    const savedDraft = actuals({
      actual_labor_hours: 8,
      updated_at: '2026-05-01T10:00:00.000Z',
    })
    mocks.saveDraftJobActuals.mockResolvedValue({
      data: savedDraft,
      notice: 'Draft saved.',
    })

    const { result } = renderHook(() => useJobActualsPage())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.dirty).toBe(false)

    act(() => {
      result.current.setField('actual_labor_hours', '8')
    })

    expect(result.current.dirty).toBe(true)

    await act(async () => {
      await result.current.saveDraft()
    })

    expect(result.current.form.actual_labor_hours).toBe('8')
    expect(result.current.dirty).toBe(false)
  })

  it('guards browser unload and back navigation while actuals are dirty', async () => {
    const { result } = renderHook(() => useJobActualsPage())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setField('notes', 'Changed notes')
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

  it('does not mark locked actuals dirty', async () => {
    mocks.loadJobActuals.mockResolvedValue(actuals({ status: 'locked' }))

    const { result } = renderHook(() => useJobActualsPage())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setField('notes', 'Ignored locked edit')
    })

    expect(result.current.isReadOnly).toBe(true)
    expect(result.current.dirty).toBe(false)
  })

  it('repairs a missing accepted quote snapshot and reloads actuals', async () => {
    const missingSnapshotJob = {
      ...job,
      accepted_estimate: {
        ...job.accepted_estimate!,
        estimate_snapshot_id: null,
      },
    } as JobDetail
    mocks.loadJobRecord
      .mockResolvedValueOnce(missingSnapshotJob)
      .mockResolvedValueOnce(job)

    const { result } = renderHook(() => useJobActualsPage())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.vm).toBeNull()

    await act(async () => {
      await result.current.repairSnapshot()
    })

    expect(mocks.repairAcceptedEstimateSnapshot).toHaveBeenCalledWith('job-1')
    expect(mocks.loadJobRecord).toHaveBeenCalledTimes(2)
    expect(mocks.loadJobActuals).toHaveBeenCalledWith('job-1', 'snapshot-1')
    expect(result.current.vm?.estimateSnapshotId).toBe('snapshot-1')
    expect(result.current.notice).toBe('Accepted quote snapshot repaired.')
  })

  it('does not load actuals from navigation-only quote fallback ids', async () => {
    mocks.loadJobRecord.mockResolvedValue({
      ...job,
      linked_estimate_id: null,
      estimate_navigation_id: 'draft-estimate',
      accepted_estimate: null,
    } as JobDetail)

    const { result } = renderHook(() => useJobActualsPage())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mocks.loadJobActuals).not.toHaveBeenCalled()
    expect(result.current.vm).toBeNull()
    expect(result.current.job?.estimate_navigation_id).toBe('draft-estimate')
  })

  it('surfaces accepted quote snapshot repair failures without reloading actuals', async () => {
    const missingSnapshotJob = {
      ...job,
      accepted_estimate: {
        ...job.accepted_estimate!,
        estimate_snapshot_id: null,
      },
    } as JobDetail
    mocks.loadJobRecord.mockResolvedValue(missingSnapshotJob)
    mocks.repairAcceptedEstimateSnapshot.mockRejectedValue(new Error('Repair failed.'))

    const { result } = renderHook(() => useJobActualsPage())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.vm).toBeNull()

    let repaired = true
    await act(async () => {
      repaired = await result.current.repairSnapshot()
    })

    expect(repaired).toBe(false)
    expect(mocks.repairAcceptedEstimateSnapshot).toHaveBeenCalledWith('job-1')
    expect(mocks.loadJobRecord).toHaveBeenCalledTimes(1)
    expect(mocks.loadJobActuals).not.toHaveBeenCalled()
    expect(result.current.error).toBe('Repair failed.')
    expect(result.current.notice).toBeNull()
    expect(result.current.repairingSnapshot).toBe(false)
  })

  it('keeps the saved draft in actuals and form state when submit fails after saving', async () => {
    const savedDraft = actuals({
      actual_labor_hours: 12,
      actual_paint_gallons: 4,
      actual_supplies_cost: 100,
      actual_other_cost: 20,
      notes: 'Saved by draft call',
      updated_at: '2026-05-01T10:00:00.000Z',
    })
    mocks.saveDraftJobActuals.mockImplementation(
      async (_jobId: string, _payload: JobActualsDraftPayload) => ({
        data: savedDraft,
        notice: 'Draft saved.',
      })
    )
    mocks.submitJobActuals.mockRejectedValue(new Error('Submit failed.'))

    const { result } = renderHook(() => useJobActualsPage())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      result.current.setField('actual_labor_hours', '12')
      result.current.setField('actual_paint_gallons', '4')
      result.current.setField('actual_supplies_cost', '100')
      result.current.setField('actual_other_cost', '20')
      result.current.setField('notes', ' Saved by draft call ')
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(mocks.saveDraftJobActuals).toHaveBeenCalledTimes(1)
    expect(mocks.submitJobActuals).toHaveBeenCalledWith('job-1', 'snapshot-1')
    expect(result.current.actuals).toMatchObject({
      actual_labor_hours: 12,
      notes: 'Saved by draft call',
      status: 'draft',
    })
    expect(result.current.form).toMatchObject({
      actual_labor_hours: '12',
      actual_paint_gallons: '4',
      actual_supplies_cost: '100',
      actual_other_cost: '20',
      notes: 'Saved by draft call',
    })
    expect(result.current.notice).toBe('Draft saved. Actuals were not submitted.')
    expect(result.current.error).toBe('Submit failed.')
  })

  it('does not submit when the draft save fails', async () => {
    mocks.saveDraftJobActuals.mockRejectedValue(new Error('Draft save failed.'))

    const { result } = renderHook(() => useJobActualsPage())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      result.current.setField('actual_labor_hours', '12')
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(mocks.saveDraftJobActuals).toHaveBeenCalledTimes(1)
    expect(mocks.submitJobActuals).not.toHaveBeenCalled()
    expect(result.current.actuals?.actual_labor_hours).toBe(5)
    expect(result.current.form.actual_labor_hours).toBe('12')
    expect(result.current.notice).toBeNull()
    expect(result.current.error).toBe('Draft save failed.')
  })
})
