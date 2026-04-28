import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JobPhotosPage from '../page'

const mockFetchJobList = vi.fn()
const mockUploadJobSitePhotos = vi.fn()

vi.mock('@/lib/jobs/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/jobs/client')>('@/lib/jobs/client')

  return {
    ...actual,
    fetchJobList: () => mockFetchJobList(),
    uploadJobSitePhotos: (jobId: string, form: FormData) => mockUploadJobSitePhotos(jobId, form),
  }
})

const jobs = [
  {
    id: 'job-1',
    customer_id: 'customer-1',
    customer_name: 'Alice Homeowner',
    customer_address: '123 Main St',
    title: 'Kitchen repaint',
    description: null,
    status: 'scheduled',
    estimate_date: null,
    estimate_sent_at: null,
    scheduled_date: '2026-05-01',
    completed_at: null,
  },
  {
    id: 'job-2',
    customer_id: 'customer-2',
    customer_name: 'Bob Builder',
    customer_address: '456 Oak Ave',
    title: 'Exterior touch-up',
    description: null,
    status: 'new',
    estimate_date: null,
    estimate_sent_at: null,
    scheduled_date: null,
    completed_at: null,
  },
]

function imageFile(name: string, size = 12) {
  return new File([new Uint8Array(size)], name, { type: 'image/png', lastModified: Date.UTC(2026, 0, 1) })
}

function uploadResponse(form: FormData, failedIds: string[] = []) {
  const ids = form.getAll('clientLocalId').map(String)
  const files = form.getAll('photos') as File[]
  const failed = new Set(failedIds)

  return {
    data: {
      photos: ids
        .filter((id) => !failed.has(id))
        .map((id, index) => ({
          id: `photo-${id}`,
          job_id: 'job-1',
          jobId: 'job-1',
          category: form.get('category') ?? 'before',
          job_drive_folder_id: 'folder-1',
          jobDriveFolderId: 'folder-1',
          drive_file_id: `drive-${id}`,
          driveFileId: `drive-${id}`,
          drive_folder_id: 'folder-before',
          driveFolderId: 'folder-before',
          url: null,
          drive_url: null,
          driveUrl: null,
          caption: null,
          file_name: files[index]?.name ?? null,
          fileName: files[index]?.name ?? null,
          original_name: files[index]?.name ?? null,
          originalName: files[index]?.name ?? null,
          mime_type: files[index]?.type ?? null,
          mimeType: files[index]?.type ?? null,
          size_bytes: files[index]?.size ?? null,
          sizeBytes: files[index]?.size ?? null,
          captured_at: '2026-01-01T00:00:00.000Z',
          capturedAt: '2026-01-01T00:00:00.000Z',
          uploaded_at: '2026-01-01T00:00:00.000Z',
          uploadedAt: '2026-01-01T00:00:00.000Z',
          client_local_id: id,
          clientLocalId: id,
          created_at: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
        })),
      jobFolder: { id: 'folder-1', webViewLink: 'https://drive.example/folder-1' },
      categoryFolder: { id: 'folder-before', webViewLink: 'https://drive.example/folder-before' },
      failed: ids
        .filter((id) => failed.has(id))
        .map((id, index) => ({
          originalName: files[index]?.name ?? 'photo.png',
          clientLocalId: id,
          message: 'Drive rejected this photo.',
        })),
    },
    notice: 'Upload complete.',
  }
}

async function renderLoadedPage() {
  render(<JobPhotosPage />)
  await screen.findByRole('button', { name: /Kitchen repaint/i })
}

describe('JobPhotosPage', () => {
  beforeEach(() => {
    mockFetchJobList.mockReset()
    mockUploadJobSitePhotos.mockReset()
    mockFetchJobList.mockResolvedValue(jobs)

    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    })
  })

  it('queues files, removes mistakes, and uploads the remaining file', async () => {
    mockUploadJobSitePhotos.mockImplementation((_jobId: string, form: FormData) => Promise.resolve(uploadResponse(form)))
    await renderLoadedPage()

    fireEvent.click(screen.getByRole('button', { name: /Kitchen repaint/i }))
    fireEvent.change(screen.getByLabelText('Take Photos'), {
      target: { files: [imageFile('keep.png'), imageFile('mistake.png')] },
    })

    expect(await screen.findByText('keep.png')).toBeTruthy()
    expect(screen.getByText('mistake.png')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Remove mistake.png' }))
    expect(screen.queryByText('mistake.png')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Upload 1 photo' }))

    await waitFor(() => expect(mockUploadJobSitePhotos).toHaveBeenCalledTimes(1))
    const [jobId, form] = mockUploadJobSitePhotos.mock.calls[0]
    expect(jobId).toBe('job-1')
    expect(form.getAll('photos')).toHaveLength(1)
    expect((form.getAll('photos')[0] as File).name).toBe('keep.png')
    expect(screen.queryByText('keep.png')).toBeNull()
    expect(await screen.findByText('Upload complete.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open Photos' })).toHaveAttribute('href', 'https://drive.example/folder-1')
  })

  it('keeps failed files queued for retry after partial failure', async () => {
    mockUploadJobSitePhotos.mockImplementation((_jobId: string, form: FormData) => {
      const failedId = String(form.getAll('clientLocalId')[1])
      return Promise.resolve(uploadResponse(form, [failedId]))
    })
    await renderLoadedPage()

    fireEvent.click(screen.getByRole('button', { name: /Kitchen repaint/i }))
    fireEvent.change(screen.getByLabelText('Upload Photos'), {
      target: { files: [imageFile('success.png'), imageFile('retry.png')] },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Upload 2 photos' }))

    await waitFor(() => expect(mockUploadJobSitePhotos).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('success.png')).toBeNull()
    expect(await screen.findByText('retry.png')).toBeTruthy()
    expect(screen.getByText('Drive rejected this photo.')).toBeTruthy()
    expect(screen.getByText('1 photo failed to upload.')).toBeTruthy()
  })

  it('blocks upload when no job is selected', async () => {
    await renderLoadedPage()

    fireEvent.change(screen.getByLabelText('Take Photos'), { target: { files: [imageFile('orphan.png')] } })
    fireEvent.click(await screen.findByRole('button', { name: 'Upload 1 photo' }))

    expect(await screen.findByText('Choose a job before uploading photos.')).toBeTruthy()
    expect(mockUploadJobSitePhotos).not.toHaveBeenCalled()
  })

  it('blocks upload when no photos are queued', async () => {
    await renderLoadedPage()

    fireEvent.click(screen.getByRole('button', { name: /Kitchen repaint/i }))
    const uploadSection = screen.getByRole('region', { name: 'Upload photos' })
    fireEvent.click(within(uploadSection).getByRole('button', { name: 'Upload photos' }))

    expect(await screen.findByText('Add at least one photo before uploading.')).toBeTruthy()
    expect(mockUploadJobSitePhotos).not.toHaveBeenCalled()
  })
})

