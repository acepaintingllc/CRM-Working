import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLoadPublicEstimateWorkflow,
} = vi.hoisted(() => ({
  mockLoadPublicEstimateWorkflow: vi.fn(),
}))

vi.mock('@/lib/server/estimatePublicPortalWorkflow', () => ({
  loadPublicEstimateWorkflow: mockLoadPublicEstimateWorkflow,
  acceptPublicEstimateWorkflow: vi.fn(),
  declinePublicEstimateWorkflow: vi.fn(),
  normalizePublicEstimateAcceptanceInput: vi.fn(),
}))

import { GET } from '../estimate-public/[token]/route'

describe('estimate public route', () => {
  beforeEach(() => {
    mockLoadPublicEstimateWorkflow.mockReset()
  })

  it('returns 400 for invalid input and 404 for missing public estimates', async () => {
    const invalidResponse = await GET(new Request('http://localhost/api/estimate-public/'), {
      params: { token: '' },
    })
    expect(invalidResponse.status).toBe(400)
    await expect(invalidResponse.json()).resolves.toEqual({ error: 'Invalid token' })

    mockLoadPublicEstimateWorkflow.mockResolvedValue({
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

    expect(mockLoadPublicEstimateWorkflow).toHaveBeenCalledWith({
      token: 'missing',
      origin: 'http://localhost',
      userAgent: '',
    })
    expect(missingResponse.status).toBe(404)
    await expect(missingResponse.json()).resolves.toEqual({ error: 'Estimate not found' })
  })

  it('delegates public read handling to the workflow and returns the snapshot response envelope', async () => {
    mockLoadPublicEstimateWorkflow.mockResolvedValue({
      ok: true,
      data: {
        estimate_version_id: 'version-1',
        status: 'sent',
        viewed_at: null,
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

    expect(mockLoadPublicEstimateWorkflow).toHaveBeenCalledWith({
      token: 'token-1',
      origin: 'http://localhost',
      userAgent: 'Vitest',
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
