import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockLoadPublicEstimatePortalSnapshot } = vi.hoisted(() => ({
  mockLoadPublicEstimatePortalSnapshot: vi.fn(),
}))

vi.mock('@/lib/server/estimatePublicPortal', () => ({
  loadPublicEstimatePortalSnapshot: mockLoadPublicEstimatePortalSnapshot,
}))

import { GET as getEstimatePublic } from '../estimate-public/[token]/route'
import { GET as getQuotePublic } from '../quote-public/[token]/route'

const canonicalPublicData = {
  estimate_version_id: 'version-1',
  document: {
    meta: { title: 'Kitchen Quote' },
    total: 4250,
  },
  snapshot_json: {
    artifact_kind: 'customer_estimate_artifact',
    artifact_version: 1,
    document: {
      meta: { title: 'Kitchen Quote' },
      total: 4250,
    },
  },
}

describe('public estimate read routes', () => {
  beforeEach(() => {
    mockLoadPublicEstimatePortalSnapshot.mockReset()
    mockLoadPublicEstimatePortalSnapshot.mockResolvedValue({
      ok: true,
      data: canonicalPublicData,
    })
  })

  it('uses the shared portal snapshot contract for the estimate-public alias', async () => {
    const response = await getEstimatePublic(new Request('https://example.test/api/estimate-public/token-1', {
      headers: { 'user-agent': 'Vitest Estimate Route' },
    }), {
      params: Promise.resolve({ token: 'token-1' }),
    })

    expect(mockLoadPublicEstimatePortalSnapshot).toHaveBeenCalledWith({
      token: 'token-1',
      origin: 'https://example.test',
      actorType: 'customer',
      metadata: {
        route: 'estimate-public',
        user_agent: 'Vitest Estimate Route',
      },
    })
    await expect(response.json()).resolves.toEqual({
      data: canonicalPublicData,
    })
  })

  it('uses the shared portal snapshot contract for the quote-public alias', async () => {
    const response = await getQuotePublic(new Request('https://example.test/api/quote-public/token-2', {
      headers: { 'user-agent': 'Vitest Quote Route' },
    }), {
      params: Promise.resolve({ token: 'token-2' }),
    })

    expect(mockLoadPublicEstimatePortalSnapshot).toHaveBeenCalledWith({
      token: 'token-2',
      origin: 'https://example.test',
      actorType: 'customer',
      metadata: {
        route: 'quote-public',
        user_agent: 'Vitest Quote Route',
      },
    })
    await expect(response.json()).resolves.toEqual({
      data: canonicalPublicData,
    })
  })
})
