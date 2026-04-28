import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireSessionUserOrg,
  mockResolveParams,
  mockReadUuidParam,
  mockListJobSitePhotos,
  mockUploadJobSitePhotos,
} = vi.hoisted(() => ({
  mockRequireSessionUserOrg: vi.fn(),
  mockResolveParams: vi.fn(),
  mockReadUuidParam: vi.fn(),
  mockListJobSitePhotos: vi.fn(),
  mockUploadJobSitePhotos: vi.fn(),
}))

vi.mock('@/lib/server/apiRoute', async () => ({
  requireSessionUserOrg: mockRequireSessionUserOrg,
  resolveParams: mockResolveParams,
  readUuidParam: mockReadUuidParam,
  jsonError: (error: string, status: number) =>
    new Response(JSON.stringify({ error }), { status }),
}))

vi.mock('@/lib/jobs/sitePhotos', () => ({
  listJobSitePhotos: mockListJobSitePhotos,
  uploadJobSitePhotos: mockUploadJobSitePhotos,
}))

import { GET, POST } from '../jobs/[id]/site-photos/route'

describe('job site photos route', () => {
  beforeEach(() => {
    mockRequireSessionUserOrg.mockReset()
    mockResolveParams.mockReset()
    mockReadUuidParam.mockReset()
    mockListJobSitePhotos.mockReset()
    mockUploadJobSitePhotos.mockReset()

    mockRequireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
    mockResolveParams.mockResolvedValue({ id: 'job-1' })
    mockReadUuidParam.mockReturnValue({ ok: true, value: 'job-1' })
  })

  it('GET returns the standard data envelope for site photos', async () => {
    const data = {
      photos: { before: [], damage: [], after: [] },
      jobFolder: { id: 'folder-1', webViewLink: 'https://drive.example/job' },
      categoryFolders: {
        before: { id: null, webViewLink: null },
        damage: { id: null, webViewLink: null },
        after: { id: null, webViewLink: null },
      },
    }
    mockListJobSitePhotos.mockResolvedValue({ ok: true, data })

    const response = await GET(new Request('http://localhost/api/jobs/job-1/site-photos'), {
      params: { id: 'job-1' },
    })

    expect(mockListJobSitePhotos).toHaveBeenCalledWith('org-1', 'job-1')
    await expect(response.json()).resolves.toEqual({ data })
  })

  it('POST parses multipart form data and delegates upload files to service', async () => {
    const formData = new FormData()
    formData.set('category', 'before')
    formData.append('photos', new File([new Uint8Array([1, 2, 3])], 'before.jpg', { type: 'image/jpeg' }))
    formData.append('photos', new File([new Uint8Array([4, 5])], 'damage.png', { type: 'image/png' }))
    formData.append('clientLocalId', 'local-1')
    formData.append('clientLocalId', 'local-2')
    formData.append('capturedAt', '2026-04-27T15:00:00.000Z')
    formData.append('capturedAt', '2026-04-27T16:00:00.000Z')
    mockUploadJobSitePhotos.mockResolvedValue({
      ok: true,
      data: { photos: [{ id: 'photo-1' }], failed: [], jobFolder: null, categoryFolder: null },
    })

    const response = await POST(
      new Request('http://localhost/api/jobs/job-1/site-photos', {
        method: 'POST',
        body: formData,
      }),
      { params: { id: 'job-1' } }
    )

    expect(mockUploadJobSitePhotos).toHaveBeenCalledTimes(1)
    const input = mockUploadJobSitePhotos.mock.calls[0][0]
    expect(input).toMatchObject({
      origin: 'http://localhost',
      orgId: 'org-1',
      userId: 'user-1',
      jobId: 'job-1',
      category: 'before',
    })
    expect(input.files).toHaveLength(2)
    expect(input.files[0]).toMatchObject({
      originalName: 'before.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 3,
      clientLocalId: 'local-1',
      capturedAt: '2026-04-27T15:00:00.000Z',
    })
    expect(Array.from(new Uint8Array(input.files[0].buffer))).toEqual([1, 2, 3])
    expect(input.files[1]).toMatchObject({
      originalName: 'damage.png',
      mimeType: 'image/png',
      sizeBytes: 2,
      clientLocalId: 'local-2',
      capturedAt: '2026-04-27T16:00:00.000Z',
    })
    expect(Array.from(new Uint8Array(input.files[1].buffer))).toEqual([4, 5])
    await expect(response.json()).resolves.toEqual({
      data: { photos: [{ id: 'photo-1' }], failed: [], jobFolder: null, categoryFolder: null },
      notice: 'Photos uploaded.',
    })
  })

  it('POST returns 400 when no photos are included', async () => {
    const formData = new FormData()
    formData.set('category', 'before')

    const response = await POST(
      new Request('http://localhost/api/jobs/job-1/site-photos', {
        method: 'POST',
        body: formData,
      }),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(400)
    expect(mockUploadJobSitePhotos).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      error: 'Add at least one photo before uploading.',
    })
  })

  it('POST returns 400 when multipart form data cannot be parsed', async () => {
    const response = await POST(
      new Request('http://localhost/api/jobs/job-1/site-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'before' }),
      }),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(400)
    expect(mockUploadJobSitePhotos).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Invalid multipart form data.' })
  })

  it('maps service validation errors', async () => {
    const formData = new FormData()
    formData.set('category', 'unsupported')
    formData.append('photos', new File([new Uint8Array([1])], 'photo.gif', { type: 'image/gif' }))
    mockUploadJobSitePhotos.mockResolvedValue({
      ok: false,
      kind: 'invalid_input',
      message: 'Choose a valid photo category.',
    })

    const response = await POST(
      new Request('http://localhost/api/jobs/job-1/site-photos', {
        method: 'POST',
        body: formData,
      }),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Choose a valid photo category.' })
  })

  it('returns auth responses before reading params', async () => {
    mockRequireSessionUserOrg.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await GET(new Request('http://localhost/api/jobs/job-1/site-photos'), {
      params: { id: 'job-1' },
    })

    expect(response.status).toBe(401)
    expect(mockResolveParams).not.toHaveBeenCalled()
    expect(mockListJobSitePhotos).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('POST returns auth responses before parsing the body', async () => {
    mockRequireSessionUserOrg.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await POST(
      new Request('http://localhost/api/jobs/job-1/site-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'before' }),
      }),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(401)
    expect(mockResolveParams).not.toHaveBeenCalled()
    expect(mockUploadJobSitePhotos).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns invalid id responses before calling the service', async () => {
    mockReadUuidParam.mockReturnValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Invalid job id' }), { status: 400 }),
    })

    const response = await GET(new Request('http://localhost/api/jobs/not-a-uuid/site-photos'), {
      params: { id: 'not-a-uuid' },
    })

    expect(response.status).toBe(400)
    expect(mockListJobSitePhotos).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Invalid job id' })
  })
})
