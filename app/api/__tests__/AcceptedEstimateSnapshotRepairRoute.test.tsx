import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireSessionUserOrg,
  mockResolveParams,
  mockReadUuidParam,
  mockRepairAcceptedEstimateSnapshotForJob,
} = vi.hoisted(() => ({
  mockRequireSessionUserOrg: vi.fn(),
  mockResolveParams: vi.fn(),
  mockReadUuidParam: vi.fn(),
  mockRepairAcceptedEstimateSnapshotForJob: vi.fn(),
}))

vi.mock('@/lib/server/apiRoute', async () => ({
  requireSessionUserOrg: mockRequireSessionUserOrg,
  resolveParams: mockResolveParams,
  readUuidParam: mockReadUuidParam,
  jsonError: (error: string, status: number) =>
    new Response(JSON.stringify({ error }), { status }),
}))

vi.mock('@/lib/server/accepted-estimates/service', () => ({
  repairAcceptedEstimateSnapshotForJob: mockRepairAcceptedEstimateSnapshotForJob,
}))

import { POST } from '../jobs/[id]/accepted-estimate/snapshot/route'

const repairedSource = {
  estimate_id: 'estimate-1',
  accepted_public_version_id: 'public-version-1',
  estimate_snapshot_id: 'snapshot-1',
}

describe('accepted estimate snapshot repair route', () => {
  beforeEach(() => {
    mockRequireSessionUserOrg.mockReset()
    mockResolveParams.mockReset()
    mockReadUuidParam.mockReset()
    mockRepairAcceptedEstimateSnapshotForJob.mockReset()

    mockRequireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
    mockResolveParams.mockResolvedValue({ id: 'job-1' })
    mockReadUuidParam.mockReturnValue({ ok: true, value: 'job-1' })
  })

  it('repairs the missing snapshot through the standard mutation envelope', async () => {
    mockRepairAcceptedEstimateSnapshotForJob.mockResolvedValue({
      ok: true,
      data: repairedSource,
    })

    const response = await POST(
      new Request('http://localhost/api/jobs/job-1/accepted-estimate/snapshot', {
        method: 'POST',
      }),
      { params: { id: 'job-1' } }
    )

    expect(mockRepairAcceptedEstimateSnapshotForJob).toHaveBeenCalledWith({
      requestOrigin: 'http://localhost',
      orgId: 'org-1',
      userId: 'user-1',
      jobId: 'job-1',
    })
    await expect(response.json()).resolves.toEqual({
      data: repairedSource,
      notice: 'Accepted quote snapshot repaired.',
    })
  })

  it('authenticates before reading params', async () => {
    mockRequireSessionUserOrg.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await POST(
      new Request('http://localhost/api/jobs/job-1/accepted-estimate/snapshot', {
        method: 'POST',
      }),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(401)
    expect(mockResolveParams).not.toHaveBeenCalled()
    expect(mockRepairAcceptedEstimateSnapshotForJob).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })
})
