import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireSessionUserOrg,
  mockResolveParams,
  mockReadUuidParam,
  mockGetLatestJobEstimateFile,
  mockListMatchingJobEstimateFiles,
} = vi.hoisted(() => ({
  mockRequireSessionUserOrg: vi.fn(),
  mockResolveParams: vi.fn(),
  mockReadUuidParam: vi.fn(),
  mockGetLatestJobEstimateFile: vi.fn(),
  mockListMatchingJobEstimateFiles: vi.fn(),
}))

vi.mock('@/lib/server/apiRoute', () => ({
  requireSessionUserOrg: mockRequireSessionUserOrg,
  resolveParams: mockResolveParams,
  readUuidParam: mockReadUuidParam,
  jsonError: (error: string, status: number) =>
    new Response(JSON.stringify({ error }), { status }),
}))

vi.mock('@/lib/jobs/estimateFiles', () => ({
  getLatestJobEstimateFile: mockGetLatestJobEstimateFile,
  listMatchingJobEstimateFiles: mockListMatchingJobEstimateFiles,
}))

vi.mock('@/lib/server/log', () => ({
  serverLog: { info: vi.fn(), warn: vi.fn() },
}))

import { GET } from '../jobs/[id]/estimate-file/route'

const jobId = 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d'
const session = { orgId: 'org-1', userId: 'user-1' }

function request(path = `/api/jobs/${jobId}/estimate-file`) {
  return new Request(`http://localhost${path}`)
}

describe('job estimate-file route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireSessionUserOrg.mockResolvedValue({ ok: true, session })
    mockResolveParams.mockResolvedValue({ id: jobId })
    mockReadUuidParam.mockReturnValue({ ok: true, value: jobId })
  })

  it('returns auth failures from requireSessionUserOrg', async () => {
    mockRequireSessionUserOrg.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 }),
    })

    const response = await GET(request(), { params: { id: jobId } })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Not authenticated' })
    expect(mockGetLatestJobEstimateFile).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid job ids from the shared UUID parser', async () => {
    mockResolveParams.mockResolvedValueOnce({ id: 'not-a-uuid' })
    mockReadUuidParam.mockReturnValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Invalid job id' }), { status: 400 }),
    })

    const response = await GET(request('/api/jobs/not-a-uuid/estimate-file'), {
      params: { id: 'not-a-uuid' },
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid job id' })
    expect(mockReadUuidParam).toHaveBeenCalledWith('not-a-uuid', 'job id')
    expect(mockGetLatestJobEstimateFile).not.toHaveBeenCalled()
  })

  it('maps missing customer address service errors', async () => {
    mockGetLatestJobEstimateFile.mockResolvedValueOnce({
      ok: false,
      kind: 'invalid_input',
      message: 'Customer address missing.',
    })

    const response = await GET(request(), { params: { id: jobId } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Customer address missing.' })
  })

  it('maps no-match service errors', async () => {
    mockGetLatestJobEstimateFile.mockResolvedValueOnce({
      ok: false,
      kind: 'not_found',
      message: 'No matching quote PDF found in Drive folder.',
    })

    const response = await GET(request(), { params: { id: jobId } })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'No matching quote PDF found in Drive folder.',
    })
  })

  it('returns the latest matching estimate file in a data envelope', async () => {
    mockGetLatestJobEstimateFile.mockResolvedValueOnce({
      ok: true,
      data: { id: 'file-2', name: 'Estimate-123 Main St-v2.pdf', version: 2 },
    })

    const response = await GET(request(), { params: { id: jobId } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: { id: 'file-2', name: 'Estimate-123 Main St-v2.pdf', version: 2 },
    })
    expect(mockGetLatestJobEstimateFile).toHaveBeenCalledWith({
      origin: 'http://localhost',
      orgId: 'org-1',
      userId: 'user-1',
      jobId,
    })
  })

  it('returns all matching estimate files with latest in a data envelope', async () => {
    const files = [
      { id: 'file-2', name: 'Estimate-123 Main St-v2.pdf', version: 2 },
      { id: 'file-1', name: 'Estimate-123 Main St-v1.pdf', version: 1 },
    ]
    mockListMatchingJobEstimateFiles.mockResolvedValueOnce({
      ok: true,
      data: { latest: files[0], files },
    })

    const response = await GET(request(`/api/jobs/${jobId}/estimate-file?all=1`), {
      params: { id: jobId },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { latest: files[0], files } })
    expect(mockListMatchingJobEstimateFiles).toHaveBeenCalledWith({
      origin: 'http://localhost',
      orgId: 'org-1',
      userId: 'user-1',
      jobId,
    })
  })

  it('returns an empty nullable success envelope when all=1 finds no matching files', async () => {
    mockListMatchingJobEstimateFiles.mockResolvedValueOnce({
      ok: true,
      data: { latest: null, files: [] },
    })

    const response = await GET(request(`/api/jobs/${jobId}/estimate-file?all=1`), {
      params: { id: jobId },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: { latest: null, files: [] },
    })
    expect(mockListMatchingJobEstimateFiles).toHaveBeenCalledWith({
      origin: 'http://localhost',
      orgId: 'org-1',
      userId: 'user-1',
      jobId,
    })
  })

  it('keeps redirect as a route-only exception for legacy Drive open links', async () => {
    mockGetLatestJobEstimateFile.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'file-2',
        name: 'Estimate-123 Main St-v2.pdf',
        webViewLink: 'https://drive.google.com/file/d/file-2/view',
      },
    })

    const response = await GET(request(`/api/jobs/${jobId}/estimate-file?redirect=1`), {
      params: { id: jobId },
    })

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://drive.google.com/file/d/file-2/view')
  })
})
