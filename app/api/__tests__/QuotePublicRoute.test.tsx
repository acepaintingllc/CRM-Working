import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLoadPublicEstimateByToken,
  mockMarkPublicEstimateViewed,
  mockWriteEstimatePublicEvent,
  mockFrom,
} = vi.hoisted(() => ({
  mockLoadPublicEstimateByToken: vi.fn(),
  mockMarkPublicEstimateViewed: vi.fn(),
  mockWriteEstimatePublicEvent: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/server/estimatePublicPortal', () => ({
  loadPublicEstimateByToken: mockLoadPublicEstimateByToken,
  markPublicEstimateViewed: mockMarkPublicEstimateViewed,
}))

vi.mock('@/lib/server/customer-send/repository', () => ({
  writeEstimatePublicEvent: mockWriteEstimatePublicEvent,
}))

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}))

import { GET } from '../quote-public/[token]/route'
import { POST as acceptQuote } from '../quote-public/[token]/accept/route'
import { POST as declineQuote } from '../quote-public/[token]/decline/route'

function createUpdateChain(result: unknown) {
  const chain = {
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  chain.eq.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  return chain
}

describe('quote public routes', () => {
  beforeEach(() => {
    mockLoadPublicEstimateByToken.mockReset()
    mockMarkPublicEstimateViewed.mockReset()
    mockWriteEstimatePublicEvent.mockReset()
    mockFrom.mockReset()
  })

  it('returns 400 for invalid token input and 404 for missing public quotes', async () => {
    const invalidResponse = await GET(new Request('http://localhost/api/quote-public/'), {
      params: { token: '' },
    })
    expect(invalidResponse.status).toBe(400)
    await expect(invalidResponse.json()).resolves.toEqual({ error: 'Invalid token' })

    mockLoadPublicEstimateByToken.mockResolvedValue({ error: 'Quote not found' })
    const missingResponse = await GET(
      new Request('http://localhost/api/quote-public/missing'),
      {
        params: { token: 'missing' },
      }
    )
    expect(mockLoadPublicEstimateByToken).toHaveBeenCalledWith(
      'missing',
      'http://localhost'
    )
    expect(missingResponse.status).toBe(404)
    await expect(missingResponse.json()).resolves.toEqual({ error: 'Quote not found' })
  })

  it('marks the first eligible public view as viewed and returns the snapshot payload', async () => {
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
      new Request('http://localhost/api/quote-public/token-1', {
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

  it('accept route validates required fields and writes acceptance metadata', async () => {
    mockLoadPublicEstimateByToken.mockResolvedValue({
      version: { org_id: 'org-1' },
      snapshot: { estimate_version_id: 'version-1' },
    })

    const invalidResponse = await acceptQuote(
      new Request('http://localhost/api/quote-public/token-1/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted_terms: true }),
      }),
      {
        params: { token: 'token-1' },
      }
    )
    expect(invalidResponse.status).toBe(400)
    await expect(invalidResponse.json()).resolves.toEqual({
      error: 'Legal name is required',
    })

    const updateSpy = vi.fn(() =>
      createUpdateChain({
        data: { id: 'version-1', status: 'accepted' },
        error: null,
      })
    )
    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return { update: updateSpy }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await acceptQuote(
      new Request('http://localhost/api/quote-public/token-1/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-agent': 'Vitest',
          'x-forwarded-for': '127.0.0.1',
        },
        body: JSON.stringify({
          legal_name: 'Taylor Smith',
          accepted_terms: true,
          signature_type: 'typed',
          signature_value: 'Taylor Smith',
        }),
      }),
      {
        params: { token: 'token-1' },
      }
    )

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'accepted',
        acceptance_json: expect.objectContaining({
          legal_name: 'Taylor Smith',
          signature_type: 'typed',
          signature_value: 'Taylor Smith',
          accepted_terms: true,
          user_agent: 'Vitest',
          ip: '127.0.0.1',
        }),
      })
    )
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        versionId: 'version-1',
        eventType: 'accepted',
        metadata: {
          legal_name: 'Taylor Smith',
          signature_type: 'typed',
        },
      })
    )
    await expect(response.json()).resolves.toEqual({
      ok: true,
      version: { id: 'version-1', status: 'accepted' },
    })
  })

  it('decline route records the decline state and event metadata', async () => {
    mockLoadPublicEstimateByToken.mockResolvedValue({
      version: { org_id: 'org-1' },
      snapshot: { estimate_version_id: 'version-1' },
    })

    const updateSpy = vi.fn(() =>
      createUpdateChain({
        data: { id: 'version-1', status: 'declined' },
        error: null,
      })
    )
    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return { update: updateSpy }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await declineQuote(
      new Request('http://localhost/api/quote-public/token-1/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Going another direction' }),
      }),
      {
        params: { token: 'token-1' },
      }
    )

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'declined',
        declined_at: expect.any(String),
        locked_at: expect.any(String),
      })
    )
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        versionId: 'version-1',
        eventType: 'declined',
        metadata: {
          reason: 'Going another direction',
        },
      })
    )
    await expect(response.json()).resolves.toEqual({
      ok: true,
      version: { id: 'version-1', status: 'declined' },
    })
  })
})
