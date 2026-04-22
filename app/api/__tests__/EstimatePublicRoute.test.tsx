import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLoadPublicEstimateByToken,
  mockMarkPublicEstimateViewed,
} = vi.hoisted(() => ({
  mockLoadPublicEstimateByToken: vi.fn(),
  mockMarkPublicEstimateViewed: vi.fn(),
}))

vi.mock('@/lib/server/estimatePublicPortal', () => ({
  loadPublicEstimateByToken: mockLoadPublicEstimateByToken,
  markPublicEstimateViewed: mockMarkPublicEstimateViewed,
}))

import { GET } from '../estimate-public/[token]/route'

describe('estimate public route', () => {
  beforeEach(() => {
    mockLoadPublicEstimateByToken.mockReset()
    mockMarkPublicEstimateViewed.mockReset()
  })

  it('returns 400 for invalid input and 404 for missing public estimates', async () => {
    const invalidResponse = await GET(new Request('http://localhost/api/estimate-public/'), {
      params: { token: '' },
    })
    expect(invalidResponse.status).toBe(400)
    await expect(invalidResponse.json()).resolves.toEqual({ error: 'Invalid token' })

    mockLoadPublicEstimateByToken.mockResolvedValue({ error: 'Estimate not found' })
    const missingResponse = await GET(
      new Request('http://localhost/api/estimate-public/missing'),
      {
        params: { token: 'missing' },
      }
    )

    expect(mockLoadPublicEstimateByToken).toHaveBeenCalledWith(
      'missing',
      'http://localhost'
    )
    expect(missingResponse.status).toBe(404)
    await expect(missingResponse.json()).resolves.toEqual({ error: 'Estimate not found' })
  })

  it('marks the first eligible public estimate view and returns the snapshot', async () => {
    mockLoadPublicEstimateByToken.mockResolvedValue({
      version: { org_id: 'org-1' },
      snapshot: {
        estimate_version_id: 'version-1',
        status: 'sent',
        viewed_at: null,
        public_token: 'token-1',
      },
    })
    mockMarkPublicEstimateViewed.mockResolvedValue({ ok: true })

    const response = await GET(
      new Request('http://localhost/api/estimate-public/token-1', {
        headers: { 'user-agent': 'Vitest' },
      }),
      {
        params: { token: 'token-1' },
      }
    )

    expect(mockMarkPublicEstimateViewed).toHaveBeenCalledWith({
      versionId: 'version-1',
      orgId: 'org-1',
      metadata: {
        user_agent: 'Vitest',
      },
    })
    await expect(response.json()).resolves.toEqual({
      ok: true,
      estimate_version_id: 'version-1',
      status: 'sent',
      viewed_at: null,
      public_token: 'token-1',
    })
  })
})
