import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireSessionUserOrg,
  mockResolveParams,
  mockReadUuidParam,
  mockReadJsonBody,
  mockLoadJobReview,
  mockNormalizeReviewSnapshotId,
  mockNormalizeJobReviewInput,
  mockSaveJobReview,
  mockLockJobReview,
} = vi.hoisted(() => ({
  mockRequireSessionUserOrg: vi.fn(),
  mockResolveParams: vi.fn(),
  mockReadUuidParam: vi.fn(),
  mockReadJsonBody: vi.fn(),
  mockLoadJobReview: vi.fn(),
  mockNormalizeReviewSnapshotId: vi.fn(),
  mockNormalizeJobReviewInput: vi.fn(),
  mockSaveJobReview: vi.fn(),
  mockLockJobReview: vi.fn(),
}))

vi.mock('@/lib/server/apiRoute', () => ({
  requireSessionUserOrg: mockRequireSessionUserOrg,
  resolveParams: mockResolveParams,
  readUuidParam: mockReadUuidParam,
  readJsonBody: mockReadJsonBody,
  jsonError: (error: string, status: number) =>
    new Response(JSON.stringify({ error }), { status }),
}))

vi.mock('@/lib/server/estimate-feedback/reviews', () => ({
  loadJobReview: mockLoadJobReview,
  normalizeReviewSnapshotId: mockNormalizeReviewSnapshotId,
  normalizeJobReviewInput: mockNormalizeJobReviewInput,
  saveJobReview: mockSaveJobReview,
  lockJobReview: mockLockJobReview,
}))

import { GET, PUT } from '../jobs/[id]/review/route'
import { POST as LOCK } from '../jobs/[id]/review/lock/route'

const review = {
  id: 'review-1',
  job_id: 'job-1',
  estimate_snapshot_id: 'snapshot-1',
  status: 'draft',
}

describe('job review routes', () => {
  beforeEach(() => {
    mockRequireSessionUserOrg.mockReset()
    mockResolveParams.mockReset()
    mockReadUuidParam.mockReset()
    mockReadJsonBody.mockReset()
    mockLoadJobReview.mockReset()
    mockNormalizeReviewSnapshotId.mockReset()
    mockNormalizeJobReviewInput.mockReset()
    mockSaveJobReview.mockReset()
    mockLockJobReview.mockReset()

    mockRequireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
    mockResolveParams.mockResolvedValue({ id: 'job-1' })
    mockReadUuidParam.mockReturnValue({ ok: true, value: 'job-1' })
    mockReadJsonBody.mockResolvedValue({
      ok: true,
      value: { estimate_snapshot_id: 'snapshot-1', checklist: [] },
    })
    mockNormalizeReviewSnapshotId.mockReturnValue({ ok: true, data: 'snapshot-1' })
    mockNormalizeJobReviewInput.mockReturnValue({
      ok: true,
      data: { estimate_snapshot_id: 'snapshot-1', checklist: [] },
    })
  })

  it('GET requires auth before service work', async () => {
    mockRequireSessionUserOrg.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await GET(
      new Request('http://localhost/api/jobs/job-1/review?estimateSnapshotId=snapshot-1'),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(401)
    expect(mockResolveParams).not.toHaveBeenCalled()
    expect(mockReadUuidParam).not.toHaveBeenCalled()
    expect(mockNormalizeReviewSnapshotId).not.toHaveBeenCalled()
    expect(mockLoadJobReview).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('PUT requires auth before body parsing or service work', async () => {
    mockRequireSessionUserOrg.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await PUT(
      new Request('http://localhost/api/jobs/job-1/review', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate_snapshot_id: 'snapshot-1' }),
      }),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(401)
    expect(mockResolveParams).not.toHaveBeenCalled()
    expect(mockReadJsonBody).not.toHaveBeenCalled()
    expect(mockNormalizeJobReviewInput).not.toHaveBeenCalled()
    expect(mockSaveJobReview).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('POST lock requires auth before body parsing or service work', async () => {
    mockRequireSessionUserOrg.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await LOCK(
      new Request('http://localhost/api/jobs/job-1/review/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate_snapshot_id: 'snapshot-1' }),
      }),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(401)
    expect(mockResolveParams).not.toHaveBeenCalled()
    expect(mockReadJsonBody).not.toHaveBeenCalled()
    expect(mockNormalizeReviewSnapshotId).not.toHaveBeenCalled()
    expect(mockLockJobReview).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns 400 with an error envelope for an invalid job id', async () => {
    mockReadUuidParam.mockReturnValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Invalid job id' }), { status: 400 }),
    })

    const response = await GET(
      new Request('http://localhost/api/jobs/not-a-uuid/review?estimateSnapshotId=snapshot-1'),
      { params: { id: 'not-a-uuid' } }
    )

    expect(response.status).toBe(400)
    expect(mockLoadJobReview).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Invalid job id' })
  })

  it('returns 400 with an error envelope for an invalid estimate snapshot id', async () => {
    mockNormalizeReviewSnapshotId.mockReturnValueOnce({
      ok: false,
      message: 'Invalid estimate snapshot id',
    })

    const response = await GET(
      new Request('http://localhost/api/jobs/job-1/review?estimateSnapshotId=bad-snapshot'),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(400)
    expect(mockLoadJobReview).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Invalid estimate snapshot id' })
  })

  it('GET returns the standard data envelope', async () => {
    mockLoadJobReview.mockResolvedValue({ ok: true, data: review })

    const response = await GET(
      new Request('http://localhost/api/jobs/job-1/review?estimateSnapshotId=snapshot-1'),
      { params: { id: 'job-1' } }
    )

    expect(mockLoadJobReview).toHaveBeenCalledWith('org-1', 'job-1', 'snapshot-1')
    await expect(response.json()).resolves.toEqual({ data: review })
  })

  it('PUT returns the standard mutation envelope', async () => {
    mockSaveJobReview.mockResolvedValue({ ok: true, data: review })

    const response = await PUT(
      new Request('http://localhost/api/jobs/job-1/review', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate_snapshot_id: 'snapshot-1', checklist: [] }),
      }),
      { params: { id: 'job-1' } }
    )

    expect(mockSaveJobReview).toHaveBeenCalledWith({
      orgId: 'org-1',
      jobId: 'job-1',
      userId: 'user-1',
      input: { estimate_snapshot_id: 'snapshot-1', checklist: [] },
    })
    await expect(response.json()).resolves.toEqual({
      data: review,
      notice: 'Job review saved.',
    })
  })

  it('POST lock returns the standard mutation envelope', async () => {
    mockLockJobReview.mockResolvedValue({ ok: true, data: { ...review, status: 'locked' } })

    const response = await LOCK(
      new Request('http://localhost/api/jobs/job-1/review/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate_snapshot_id: 'snapshot-1' }),
      }),
      { params: { id: 'job-1' } }
    )

    expect(mockLockJobReview).toHaveBeenCalledWith({
      orgId: 'org-1',
      jobId: 'job-1',
      userId: 'user-1',
      estimateSnapshotId: 'snapshot-1',
    })
    await expect(response.json()).resolves.toEqual({
      data: { ...review, status: 'locked' },
      notice: 'Job review locked.',
    })
  })

  it('maps GET service errors through serviceResultResponse', async () => {
    mockLoadJobReview.mockResolvedValue({
      ok: false,
      kind: 'not_found',
      message: 'Job review not found',
    })

    const response = await GET(
      new Request('http://localhost/api/jobs/job-1/review?estimateSnapshotId=snapshot-1'),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Job review not found' })
  })

  it('maps lock service errors through serviceResultResponse', async () => {
    mockLockJobReview.mockResolvedValue({
      ok: false,
      kind: 'conflict',
      message: 'Job review is already locked',
    })

    const response = await LOCK(
      new Request('http://localhost/api/jobs/job-1/review/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate_snapshot_id: 'snapshot-1' }),
      }),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: 'Job review is already locked' })
  })
})
