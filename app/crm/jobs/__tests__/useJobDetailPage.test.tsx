import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSWRWrapper } from '@/app/crm/__tests__/swrTestUtils'
import { useJobDetailPage } from '../_hooks/useJobDetailPage'

const mocks = vi.hoisted(() => ({
  deleteJob: vi.fn(),
  getJobPhotosFolderUrl: vi.fn(),
  invalidateSwrKey: vi.fn<(key: string) => Promise<unknown>>(),
  listJobSitePhotos: vi.fn(),
  listPaintLogs: vi.fn(),
  loadJobEstimateFile: vi.fn(),
  loadJobRecord: vi.fn(),
  patchJobDateFields: vi.fn(),
  patchJobStatus: vi.fn(),
  replace: vi.fn(),
  writeText: vi.fn(),
}))

vi.mock('@/lib/jobs/client', () => ({
  deleteJob: mocks.deleteJob,
  getJobPhotosFolderUrl: mocks.getJobPhotosFolderUrl,
  listJobSitePhotos: mocks.listJobSitePhotos,
  listPaintLogs: mocks.listPaintLogs,
  loadJobEstimateFile: mocks.loadJobEstimateFile,
  loadJobRecord: mocks.loadJobRecord,
  patchJobDateFields: mocks.patchJobDateFields,
  patchJobStatus: mocks.patchJobStatus,
}))

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: vi.fn(),
}))

vi.mock('@/app/crm/_hooks/swrCache', () => ({
  invalidateSwrKey: (key: string) => mocks.invalidateSwrKey(key),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'job-1' }),
  useRouter: () => ({ replace: mocks.replace, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}))

const jobDetail = {
  id: 'job-1',
  customer_id: 'customer-1',
  customer_name: 'Taylor Jones',
  customer_address: '123 Main St, Newburgh, IN 47630',
  customer_email: 'taylor@example.com',
  customer_phone: '812-555-0100',
  title: 'Exterior repaint',
  description: 'Front and back porch',
  status: 'estimate_scheduled',
  estimate_date: '2026-04-23T13:00:00.000Z',
  estimate_sent_at: null,
  scheduled_date: null,
  scheduled_end_date: null,
  completed_at: null,
}

function resetClientMocks() {
  mocks.loadJobRecord.mockResolvedValue(jobDetail)
  mocks.loadJobEstimateFile.mockResolvedValue({
    estimateFile: null,
    estimateFileError: 'No matching estimate in Drive folder',
  })
  mocks.listPaintLogs.mockResolvedValue([])
  mocks.listJobSitePhotos.mockResolvedValue({ data: [] })
  mocks.getJobPhotosFolderUrl.mockReturnValue(null)
  mocks.patchJobDateFields.mockResolvedValue({})
  mocks.patchJobStatus.mockResolvedValue({})
  mocks.deleteJob.mockResolvedValue({ data: { ok: true } })
  mocks.invalidateSwrKey.mockResolvedValue(undefined)
}

describe('useJobDetailPage', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    resetClientMocks()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: mocks.writeText,
      },
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('loads the primary job detail through loadJobRecord', async () => {
    const { result } = renderHook(() => useJobDetailPage(), {
      wrapper: createSWRWrapper(),
    })

    await waitFor(() => expect(result.current.job?.id).toBe('job-1'))

    expect(mocks.loadJobRecord).toHaveBeenCalledTimes(1)
    expect(mocks.loadJobRecord).toHaveBeenCalledWith('job-1')
  })

  it('refresh reloads the primary job plus secondary support data', async () => {
    mocks.loadJobRecord
      .mockResolvedValueOnce(jobDetail)
      .mockResolvedValueOnce({ ...jobDetail, title: 'Refreshed exterior repaint' })
    mocks.loadJobEstimateFile
      .mockResolvedValueOnce({
        estimateFile: null,
        estimateFileError: 'No matching estimate in Drive folder',
      })
      .mockResolvedValueOnce({
        estimateFile: { id: 'file-1', name: 'Estimate.pdf', webViewLink: 'https://drive/file-1' },
        estimateFileError: null,
      })
    mocks.listPaintLogs.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'log-1',
        job_id: 'job-1',
        logged_at: '2026-04-24T12:00:00.000Z',
        notes: 'Primer',
      },
    ])

    const { result } = renderHook(() => useJobDetailPage(), {
      wrapper: createSWRWrapper(),
    })

    await waitFor(() => expect(result.current.job?.id).toBe('job-1'))

    await act(async () => {
      await result.current.resource.refresh()
    })

    await waitFor(() => expect(result.current.job?.title).toBe('Refreshed exterior repaint'))
    expect(mocks.loadJobRecord).toHaveBeenCalledTimes(2)
    expect(mocks.loadJobEstimateFile).toHaveBeenCalledWith('job-1')
    expect(mocks.listPaintLogs).toHaveBeenCalledWith('job-1')
    expect(result.current.estimateFile?.id).toBe('file-1')
    expect(result.current.paintLogs).toHaveLength(1)
  })

  it('updateEstimateDate converts local input, patches the job, and updates local detail state', async () => {
    mocks.patchJobDateFields.mockResolvedValue({
      estimate_date: '2026-05-01T15:00:00.000Z',
    })

    const { result } = renderHook(() => useJobDetailPage(), {
      wrapper: createSWRWrapper(),
    })

    await waitFor(() => expect(result.current.job?.id).toBe('job-1'))

    await act(async () => {
      await result.current.updateEstimateDate('2026-05-01T10:00')
    })

    expect(mocks.patchJobDateFields).toHaveBeenCalledWith('job-1', {
      estimate_date: new Date('2026-05-01T10:00').toISOString(),
    })
    expect(result.current.job?.estimate_date).toBe('2026-05-01T15:00:00.000Z')
    expect(mocks.invalidateSwrKey).toHaveBeenCalledWith('/api/jobs/job-1')
    expect(mocks.invalidateSwrKey).toHaveBeenCalledWith('/api/jobs')
  })

  it('updateEstimateDate ignores invalid local datetime values', async () => {
    const { result } = renderHook(() => useJobDetailPage(), {
      wrapper: createSWRWrapper(),
    })

    await waitFor(() => expect(result.current.job?.id).toBe('job-1'))

    await act(async () => {
      await result.current.updateEstimateDate('not-a-date')
    })

    expect(mocks.patchJobDateFields).not.toHaveBeenCalled()
  })

  it('supports copy notices and deletes through the shared detail action helper', async () => {
    const { result } = renderHook(() => useJobDetailPage(), {
      wrapper: createSWRWrapper(),
    })

    await waitFor(() => expect(result.current.job?.id).toBe('job-1'))

    await act(async () => {
      await result.current.copy('Email', 'taylor@example.com')
    })
    expect(result.current.notice).toBe('Email copied')

    await act(async () => {
      await result.current.deleteJob()
    })

    expect(mocks.deleteJob).toHaveBeenCalledWith('job-1')
    expect(mocks.replace).toHaveBeenCalledWith('/crm/jobs')
    expect(mocks.invalidateSwrKey).toHaveBeenCalledWith('/api/jobs/job-1')
    expect(mocks.invalidateSwrKey).toHaveBeenCalledWith('/api/jobs')
  })
})
