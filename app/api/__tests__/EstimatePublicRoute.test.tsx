import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLoadPublicEstimatePortalSnapshot,
} = vi.hoisted(() => ({
  mockLoadPublicEstimatePortalSnapshot: vi.fn(),
}))

vi.mock('@/lib/server/estimatePublicPortal', () => ({
  loadPublicEstimatePortalSnapshot: mockLoadPublicEstimatePortalSnapshot,
}))

import { GET } from '../estimate-public/[token]/route'

describe('estimate public route', () => {
  beforeEach(() => {
    mockLoadPublicEstimatePortalSnapshot.mockReset()
  })

  it('returns 400 for invalid input and 404 for missing public estimates', async () => {
    mockLoadPublicEstimatePortalSnapshot.mockResolvedValueOnce({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid token',
    })
    const invalidResponse = await GET(new Request('http://localhost/api/estimate-public/'), {
      params: { token: '' },
    })
    expect(invalidResponse.status).toBe(400)
    await expect(invalidResponse.json()).resolves.toEqual({ error: 'Invalid token' })

    mockLoadPublicEstimatePortalSnapshot.mockResolvedValue({
      ok: false,
      kind: 'not_found',
      message: 'Estimate not found',
    })
    const missingResponse = await GET(
      new Request('http://localhost/api/estimate-public/missing'),
      {
        params: { token: 'missing' },
      }
    )

    expect(mockLoadPublicEstimatePortalSnapshot).toHaveBeenCalledWith({
      token: 'missing',
      origin: 'http://localhost',
      actorType: 'customer',
      metadata: { route: 'estimate-public', user_agent: '' },
    })
    expect(missingResponse.status).toBe(404)
    await expect(missingResponse.json()).resolves.toEqual({ error: 'Estimate not found' })
  })

  it('marks the first eligible public estimate view and returns the snapshot', async () => {
    mockLoadPublicEstimatePortalSnapshot.mockResolvedValue({
      ok: true,
      data: {
        estimate_version_id: 'version-1',
        status: 'viewed',
        viewed_at: '2026-04-01T00:00:00.000Z',
        public_token: 'token-1',
      },
    })

    const response = await GET(
      new Request('http://localhost/api/estimate-public/token-1', {
        headers: { 'user-agent': 'Vitest' },
      }),
      {
        params: { token: 'token-1' },
      }
    )

    expect(mockLoadPublicEstimatePortalSnapshot).toHaveBeenCalledWith({
      token: 'token-1',
      origin: 'http://localhost',
      actorType: 'customer',
      metadata: { route: 'estimate-public', user_agent: 'Vitest' },
    })
    await expect(response.json()).resolves.toEqual({
      data: {
        estimate_version_id: 'version-1',
        status: 'viewed',
        viewed_at: '2026-04-01T00:00:00.000Z',
        public_token: 'token-1',
      },
    })
  })
})
