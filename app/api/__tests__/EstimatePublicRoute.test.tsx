import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockLoadPublicEstimateSnapshot } = vi.hoisted(() => ({
  mockLoadPublicEstimateSnapshot: vi.fn(),
}))

vi.mock('@/lib/server/estimatePublicPortal', () => ({
  loadPublicEstimateSnapshot: mockLoadPublicEstimateSnapshot,
}))

import { GET } from '../estimate-public/[token]/route'

describe('estimate public route', () => {
  beforeEach(() => {
    mockLoadPublicEstimateSnapshot.mockReset()
  })

  it('returns 400 for invalid input and 404 for missing public estimates', async () => {
    mockLoadPublicEstimateSnapshot.mockResolvedValueOnce({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid token',
    })
    const invalidResponse = await GET(new Request('http://localhost/api/estimate-public/'), {
      params: { token: '' },
    })
    expect(invalidResponse.status).toBe(400)
    await expect(invalidResponse.json()).resolves.toEqual({ error: 'Invalid token' })

    mockLoadPublicEstimateSnapshot.mockResolvedValueOnce({
      ok: false,
      kind: 'not_found',
      message: 'Quote not found',
    })
    const missingResponse = await GET(
      new Request('http://localhost/api/estimate-public/missing'),
      {
        params: { token: 'missing' },
      }
    )

    expect(mockLoadPublicEstimateSnapshot).toHaveBeenLastCalledWith(
      'missing',
      { origin: 'http://localhost' },
      {
        metadata: {
          route: 'estimate-public-api',
          user_agent: '',
        },
      }
    )
    expect(missingResponse.status).toBe(404)
    await expect(missingResponse.json()).resolves.toEqual({ error: 'Quote not found' })
  })

  it('returns the shared snapshot data payload', async () => {
    mockLoadPublicEstimateSnapshot.mockResolvedValue({
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

    expect(mockLoadPublicEstimateSnapshot).toHaveBeenCalledWith(
      'token-1',
      { origin: 'http://localhost' },
      {
        metadata: {
          route: 'estimate-public-api',
          user_agent: 'Vitest',
        },
      }
    )
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
