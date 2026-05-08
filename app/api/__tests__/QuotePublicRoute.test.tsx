import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLoadPublicEstimatePortalSnapshot,
  mockAcceptPublicEstimate,
  mockDeclinePublicEstimate,
} = vi.hoisted(() => ({
  mockLoadPublicEstimatePortalSnapshot: vi.fn(),
  mockAcceptPublicEstimate: vi.fn(),
  mockDeclinePublicEstimate: vi.fn(),
}))

vi.mock('@/lib/server/estimatePublicPortal', () => ({
  loadPublicEstimatePortalSnapshot: mockLoadPublicEstimatePortalSnapshot,
  acceptPublicEstimate: mockAcceptPublicEstimate,
  declinePublicEstimate: mockDeclinePublicEstimate,
}))

import { POST as acceptQuote } from '../quote-public/[token]/accept/route'
import { POST as declineQuote } from '../quote-public/[token]/decline/route'
import { GET } from '../quote-public/[token]/route'

describe('quote public routes', () => {
  beforeEach(() => {
    mockLoadPublicEstimatePortalSnapshot.mockReset()
    mockAcceptPublicEstimate.mockReset()
    mockDeclinePublicEstimate.mockReset()
  })

  it('returns 400 for invalid token input and 404 for missing public quotes', async () => {
    mockLoadPublicEstimatePortalSnapshot.mockResolvedValueOnce({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid token',
    })
    const invalidResponse = await GET(new Request('http://localhost/api/quote-public/'), {
      params: { token: '' },
    })
    expect(invalidResponse.status).toBe(400)
    await expect(invalidResponse.json()).resolves.toEqual({ error: 'Invalid token' })

    mockLoadPublicEstimatePortalSnapshot.mockResolvedValue({
      ok: false,
      kind: 'not_found',
      message: 'Quote not found',
    })
    const missingResponse = await GET(
      new Request('http://localhost/api/quote-public/missing'),
      {
        params: { token: 'missing' },
      }
    )
    expect(mockLoadPublicEstimatePortalSnapshot).toHaveBeenCalledWith({
      token: 'missing',
      origin: 'http://localhost',
      actorType: 'customer',
      metadata: { route: 'quote-public', user_agent: '' },
    })
    expect(missingResponse.status).toBe(404)
    await expect(missingResponse.json()).resolves.toEqual({ error: 'Quote not found' })
  })

  it('marks the first eligible public view as viewed and returns the snapshot payload', async () => {
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
      new Request('http://localhost/api/quote-public/token-1', {
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
      metadata: { route: 'quote-public', user_agent: 'Vitest' },
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

  it('accept route validates required fields and writes acceptance metadata', async () => {
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
    expect(mockAcceptPublicEstimate).not.toHaveBeenCalled()

    mockAcceptPublicEstimate.mockResolvedValue({
      ok: true,
      data: { estimate_version_id: 'version-1', status: 'accepted' },
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
          customer_email: 'taylor@example.com',
          signature_type: 'typed',
          signature_value: 'Taylor Smith',
        }),
      }),
      {
        params: { token: 'token-1' },
      }
    )

    expect(mockAcceptPublicEstimate).toHaveBeenCalledWith({
      token: 'token-1',
      legalName: 'Taylor Smith',
      customerEmail: 'taylor@example.com',
      signatureType: 'typed',
      signatureValue: 'Taylor Smith',
      acceptedTerms: true,
      userAgent: 'Vitest',
      ip: '127.0.0.1',
      origin: 'http://localhost',
    })
    await expect(response.json()).resolves.toEqual({
      data: { estimate_version_id: 'version-1', status: 'accepted' },
    })
  })

  it('accept route maps malformed input and invalid transitions clearly', async () => {
    const malformedResponse = await acceptQuote(
      new Request('http://localhost/api/quote-public/token-1/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{',
      }),
      {
        params: { token: 'token-1' },
      }
    )
    expect(malformedResponse.status).toBe(400)
    await expect(malformedResponse.json()).resolves.toEqual({
      error: 'Invalid JSON body.',
    })
    expect(mockAcceptPublicEstimate).not.toHaveBeenCalled()

    mockAcceptPublicEstimate.mockResolvedValue({
      ok: false,
      kind: 'conflict',
      message: 'Cannot accept a declined quote',
    })

    const conflictResponse = await acceptQuote(
      new Request('http://localhost/api/quote-public/token-1/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legal_name: 'Taylor Smith',
          accepted_terms: true,
          signature_value: 'Taylor Smith',
        }),
      }),
      {
        params: { token: 'token-1' },
      }
    )

    expect(conflictResponse.status).toBe(409)
    await expect(conflictResponse.json()).resolves.toEqual({
      error: 'Cannot accept a declined quote',
    })
  })

  it('accept route rejects invalid signature contracts before calling the workflow service', async () => {
    const mismatchResponse = await acceptQuote(
      new Request('http://localhost/api/quote-public/token-1/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legal_name: 'Taylor Smith',
          accepted_terms: true,
          signature_type: 'typed',
          signature_value: 'Taylor S.',
        }),
      }),
      {
        params: { token: 'token-1' },
      }
    )

    expect(mismatchResponse.status).toBe(400)
    await expect(mismatchResponse.json()).resolves.toEqual({
      error: 'Typed signature must match the full legal name',
    })

    const drawnResponse = await acceptQuote(
      new Request('http://localhost/api/quote-public/token-1/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legal_name: 'Taylor Smith',
          accepted_terms: true,
          signature_type: 'drawn',
          signature_value: 'not-a-data-url',
        }),
      }),
      {
        params: { token: 'token-1' },
      }
    )

    expect(drawnResponse.status).toBe(400)
    await expect(drawnResponse.json()).resolves.toEqual({
      error: 'Drawn signature is invalid',
    })
    expect(mockAcceptPublicEstimate).not.toHaveBeenCalled()
  })

  it('accept route preserves legacy payload aliases while normalizing whitespace', async () => {
    mockAcceptPublicEstimate.mockResolvedValue({
      ok: true,
      data: { estimate_version_id: 'version-1', status: 'accepted' },
    })

    await acceptQuote(
      new Request('http://localhost/api/quote-public/token-1/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-agent': 'Vitest',
          'x-forwarded-for': '127.0.0.1',
        },
        body: JSON.stringify({
          full_name: '  Taylor Smith  ',
          agreement_checked: true,
          signature: '  Taylor Smith  ',
        }),
      }),
      {
        params: { token: 'token-1' },
      }
    )

    expect(mockAcceptPublicEstimate).toHaveBeenCalledWith({
      token: 'token-1',
      legalName: 'Taylor Smith',
      customerEmail: '',
      signatureType: 'typed',
      signatureValue: 'Taylor Smith',
      acceptedTerms: true,
      userAgent: 'Vitest',
      ip: '127.0.0.1',
      origin: 'http://localhost',
    })
  })

  it('decline route records the decline state and event metadata', async () => {
    mockDeclinePublicEstimate.mockResolvedValue({
      ok: true,
      data: { estimate_version_id: 'version-1', status: 'declined' },
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

    expect(mockDeclinePublicEstimate).toHaveBeenCalledWith({
      token: 'token-1',
      reason: 'Going another direction',
      origin: 'http://localhost',
    })
    await expect(response.json()).resolves.toEqual({
      data: { estimate_version_id: 'version-1', status: 'declined' },
    })
  })

  it('decline route maps idempotent retries and conflicts from the workflow service', async () => {
    mockDeclinePublicEstimate.mockResolvedValueOnce({
      ok: true,
      data: { estimate_version_id: 'version-1', status: 'declined' },
    })

    const retryResponse = await declineQuote(
      new Request('http://localhost/api/quote-public/token-1/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Still declining' }),
      }),
      {
        params: { token: 'token-1' },
      }
    )

    expect(retryResponse.status).toBe(200)
    await expect(retryResponse.json()).resolves.toEqual({
      data: { estimate_version_id: 'version-1', status: 'declined' },
    })

    mockDeclinePublicEstimate.mockResolvedValueOnce({
      ok: false,
      kind: 'conflict',
      message: 'Cannot decline an accepted quote',
    })

    const conflictResponse = await declineQuote(
      new Request('http://localhost/api/quote-public/token-1/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Too late' }),
      }),
      {
        params: { token: 'token-1' },
      }
    )

    expect(conflictResponse.status).toBe(409)
    await expect(conflictResponse.json()).resolves.toEqual({
      error: 'Cannot decline an accepted quote',
    })
  })

  it('decline route rejects malformed json before hitting the workflow service', async () => {
    const response = await declineQuote(
      new Request('http://localhost/api/quote-public/token-1/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      }),
      {
        params: { token: 'token-1' },
      }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid JSON body.',
    })
    expect(mockDeclinePublicEstimate).not.toHaveBeenCalled()
  })
})
