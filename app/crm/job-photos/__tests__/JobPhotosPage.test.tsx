import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  fetchJobList: vi.fn(),
  uploadJobSitePhotos: vi.fn(),
}))

vi.mock('@/lib/jobs/client', () => ({
  fetchJobList: () => mocks.fetchJobList(),
  getJobPhotosFolderUrl: (folderId: string | null | undefined) =>
    folderId ? `https://drive.google.com/drive/folders/${folderId}` : null,
  uploadJobSitePhotos: (jobId: string, form: FormData) => mocks.uploadJobSitePhotos(jobId, form),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

import JobPhotosPage from '../page'

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

function largeImageFile(name: string) {
  return imageFile(name, 4 * 1024 * 1024 + 1)
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
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    mocks.fetchJobList.mockReset()
    mocks.uploadJobSitePhotos.mockReset()
    mocks.fetchJobList.mockResolvedValue(jobs)

    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    })
  })

  it('queues files, removes mistakes, and uploads the remaining file', async () => {
    mocks.uploadJobSitePhotos.mockImplementation((_jobId: string, form: FormData) => Promise.resolve(uploadResponse(form)))
    await renderLoadedPage()

    fireEvent.click(screen.getByRole('button', { name: /Kitchen repaint/i }))
    fireEvent.change(screen.getByLabelText('Upload Photos'), {
      target: { files: [imageFile('keep.png'), imageFile('mistake.png')] },
    })

    expect(await screen.findByText('keep.png')).toBeTruthy()
    expect(screen.getByText('mistake.png')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Remove mistake.png' }))
    expect(screen.queryByText('mistake.png')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Upload 1 photo' }))

    await waitFor(() => expect(mocks.uploadJobSitePhotos).toHaveBeenCalledTimes(1))
    const [jobId, form] = mocks.uploadJobSitePhotos.mock.calls[0]
    expect(jobId).toBe('job-1')
    expect(form.getAll('photos')).toHaveLength(1)
    expect((form.getAll('photos')[0] as File).name).toBe('keep.png')
    expect(screen.queryByText('keep.png')).toBeNull()
    expect(await screen.findByText('Upload complete.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open Photos' })).toHaveAttribute('href', 'https://drive.example/folder-1')
  })

  it('keeps failed files queued for retry after partial failure', async () => {
    mocks.uploadJobSitePhotos.mockImplementation((_jobId: string, form: FormData) => {
      const file = form.getAll('photos')[0] as File
      const failedId = file.name === 'retry.png' ? String(form.getAll('clientLocalId')[0]) : ''
      return Promise.resolve(uploadResponse(form, failedId ? [failedId] : []))
    })
    await renderLoadedPage()

    fireEvent.click(screen.getByRole('button', { name: /Kitchen repaint/i }))
    fireEvent.change(screen.getByLabelText('Upload Photos'), {
      target: { files: [imageFile('success.png'), imageFile('retry.png')] },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Upload 2 photos' }))

    await waitFor(() => expect(mocks.uploadJobSitePhotos).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('success.png')).toBeNull()
    expect(await screen.findByText('retry.png')).toBeTruthy()
    expect(screen.getByText('Drive rejected this photo.')).toBeTruthy()
    expect(screen.getByText('1 photo failed to upload.')).toBeTruthy()
  })

  it('uploads queued photos in separate requests to avoid platform payload limits', async () => {
    mocks.uploadJobSitePhotos.mockImplementation((_jobId: string, form: FormData) => Promise.resolve(uploadResponse(form)))
    await renderLoadedPage()

    fireEvent.click(screen.getByRole('button', { name: /Kitchen repaint/i }))
    fireEvent.change(screen.getByLabelText('Upload Photos'), {
      target: { files: [imageFile('first.png'), imageFile('second.png')] },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Upload 2 photos' }))

    await waitFor(() => expect(mocks.uploadJobSitePhotos).toHaveBeenCalledTimes(2))
    expect(mocks.uploadJobSitePhotos.mock.calls.map(([, form]) => (form.getAll('photos')[0] as File).name)).toEqual([
      'first.png',
      'second.png',
    ])
    expect(mocks.uploadJobSitePhotos.mock.calls.every(([, form]) => form.getAll('photos').length === 1)).toBe(true)
    expect(await screen.findByText('2 photos uploaded successfully.')).toBeTruthy()
  })

  it('compresses photos over 4 MB before uploading them', async () => {
    const compressedBlob = new Blob([new Uint8Array(2 * 1024 * 1024)], { type: 'image/jpeg' })
    const drawImage = vi.fn()
    const toBlob = vi.fn((callback: BlobCallback) => callback(compressedBlob))
    const originalCreateElement = document.createElement.bind(document)
    const originalImage = globalThis.Image

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage }),
          toBlob,
        } as unknown as HTMLCanvasElement
      }
      return originalCreateElement(tagName)
    })

    class TestImage {
      width = 4000
      height = 3000
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      set src(_value: string) {
        this.onload?.()
      }
    }

    vi.stubGlobal('Image', TestImage)

    mocks.uploadJobSitePhotos.mockImplementation((_jobId: string, form: FormData) => Promise.resolve(uploadResponse(form)))
    await renderLoadedPage()

    fireEvent.click(screen.getByRole('button', { name: /Kitchen repaint/i }))
    fireEvent.change(screen.getByLabelText('Upload Photos'), {
      target: { files: [largeImageFile('large.png')] },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Upload 1 photo' }))

    await waitFor(() => expect(mocks.uploadJobSitePhotos).toHaveBeenCalledTimes(1))
    const [, form] = mocks.uploadJobSitePhotos.mock.calls[0]
    const uploadedFile = form.getAll('photos')[0] as File
    expect(uploadedFile.name).toBe('large.jpg')
    expect(uploadedFile.type).toBe('image/jpeg')
    expect(uploadedFile.size).toBe(compressedBlob.size)
    expect(drawImage).toHaveBeenCalled()
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', expect.any(Number))

    vi.stubGlobal('Image', originalImage)
  })

  it('keeps upload controls unavailable until a job is selected', async () => {
    await renderLoadedPage()

    expect(screen.queryByRole('dialog', { name: /Upload photos for/i })).toBeNull()
    expect(screen.queryByLabelText('Upload Photos')).toBeNull()
    expect(mocks.uploadJobSitePhotos).not.toHaveBeenCalled()
  })

  it('blocks upload when no photos are queued', async () => {
    await renderLoadedPage()

    fireEvent.click(screen.getByRole('button', { name: /Kitchen repaint/i }))
    const dialog = screen.getByRole('dialog', { name: 'Upload photos for Kitchen repaint' })
    const uploadButton = within(dialog).getByRole('button', { name: 'Upload 0 photos' }) as HTMLButtonElement

    expect(uploadButton.disabled).toBe(true)
    expect(mocks.uploadJobSitePhotos).not.toHaveBeenCalled()
  })
})



