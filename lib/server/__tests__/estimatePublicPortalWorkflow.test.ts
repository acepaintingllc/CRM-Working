import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLoadPublicEstimateRecordByToken,
  mockMarkPublicEstimateViewedRecord,
  mockUpdatePublicEstimateVersionRecord,
  mockWritePublicEstimateEvent,
} = vi.hoisted(() => ({
  mockLoadPublicEstimateRecordByToken: vi.fn(),
  mockMarkPublicEstimateViewedRecord: vi.fn(),
  mockUpdatePublicEstimateVersionRecord: vi.fn(),
  mockWritePublicEstimateEvent: vi.fn(),
}))

vi.mock('@/lib/server/estimatePublicPortalRepository', () => ({
  loadPublicEstimateRecordByToken: mockLoadPublicEstimateRecordByToken,
  markPublicEstimateViewedRecord: mockMarkPublicEstimateViewedRecord,
  updatePublicEstimateVersionRecord: mockUpdatePublicEstimateVersionRecord,
  writePublicEstimateEvent: mockWritePublicEstimateEvent,
}))

import {
  acceptPublicEstimateWorkflow,
  declinePublicEstimateWorkflow,
  loadPublicEstimateWorkflow,
  normalizePublicEstimateAcceptanceInput,
} from '@/lib/server/estimatePublicPortalWorkflow'

function createLoadedVersion(status: string) {
  return {
    version: {
      id: 'version-1',
      org_id: 'org-1',
      estimate_id: 'estimate-1',
      version_number: 2,
      status,
      public_token: 'token-1',
      accepted_at: status === 'accepted' ? '2026-04-01T00:00:00.000Z' : null,
      declined_at: status === 'declined' ? '2026-04-01T00:00:00.000Z' : null,
      locked_at:
        status === 'accepted' || status === 'declined'
          ? '2026-04-01T00:00:00.000Z'
          : null,
      acceptance_json:
        status === 'accepted'
          ? {
              legal_name: 'Taylor Smith',
              signature_type: 'typed',
            }
          : null,
    },
    snapshot: {
      estimate_id: 'estimate-1',
      estimate_version_id: 'version-1',
      version_number: 2,
      status,
      public_token: 'token-1',
      public_url: 'https://example.test/quote/token-1',
      draft: {},
      document: {
        meta: {
          estimate_id: 'estimate-1',
          version_name: 'Option A',
          version_state: status,
          flow_version: 'v2',
          title: 'Kitchen Quote',
          quote_date: '2026-04-01',
          sent_at: null,
          viewed_at: null,
          accepted_at: null,
          declined_at: null,
          status,
          public_token: 'token-1',
        },
        company: {
          business_name: 'ACE',
          timezone: 'America/Chicago',
          main_phone: '',
          business_email: '',
          address: '',
          website: '',
          sender_signature: '',
          logo_url: '',
        },
        customer: {
          name: 'Taylor Smith',
          email: '',
          phone: '',
          address: '',
          street: '',
          city: '',
          state: '',
          zip: '',
        },
        intro_paragraph: '',
        closing_paragraph: '',
        quote_validity_days: 30,
        deposit_language: '',
        card_fee_note: '',
        quote_rows: [],
        scopes: [],
        total: null,
        terms: [],
      },
      snapshot_json: {
        document: {
          meta: {
            title: 'Kitchen Quote',
            version_name: 'Option A',
          },
        },
      },
      sent_at: status === 'sent' ? '2026-04-01T00:00:00.000Z' : null,
      viewed_at: status === 'viewed' ? '2026-04-02T00:00:00.000Z' : null,
      accepted_at: status === 'accepted' ? '2026-04-03T00:00:00.000Z' : null,
      declined_at: status === 'declined' ? '2026-04-03T00:00:00.000Z' : null,
      locked_at:
        status === 'accepted' || status === 'declined'
          ? '2026-04-03T00:00:00.000Z'
          : null,
    },
  }
}

describe('estimate public portal workflow', () => {
  beforeEach(() => {
    mockLoadPublicEstimateRecordByToken.mockReset()
    mockMarkPublicEstimateViewedRecord.mockReset()
    mockUpdatePublicEstimateVersionRecord.mockReset()
    mockWritePublicEstimateEvent.mockReset()
    mockWritePublicEstimateEvent.mockResolvedValue({ ok: true, data: null })
  })

  it('rejects invalid token input before loading', async () => {
    const result = await loadPublicEstimateWorkflow({ token: '' })

    expect(result).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid token',
    })
    expect(mockLoadPublicEstimateRecordByToken).not.toHaveBeenCalled()
  })

  it('returns not found from the repository boundary', async () => {
    mockLoadPublicEstimateRecordByToken.mockResolvedValue({
      ok: false,
      kind: 'not_found',
      message: 'Quote not found',
    })

    const result = await loadPublicEstimateWorkflow({ token: 'missing' })

    expect(result).toEqual({
      ok: false,
      kind: 'not_found',
      message: 'Quote not found',
    })
  })

  it('marks the first eligible public view and returns the original snapshot payload', async () => {
    mockLoadPublicEstimateRecordByToken.mockResolvedValue(createLoadedVersion('sent'))
    mockMarkPublicEstimateViewedRecord.mockResolvedValue({
      ok: true,
      data: {
        viewedAt: '2026-04-02T00:00:00.000Z',
        version: { id: 'version-1' },
      },
    })

    const result = await loadPublicEstimateWorkflow({
      token: 'token-1',
      origin: 'http://localhost',
      userAgent: 'Vitest',
    })

    expect(mockLoadPublicEstimateRecordByToken).toHaveBeenCalledWith({
      token: 'token-1',
      origin: 'http://localhost',
    })
    expect(mockMarkPublicEstimateViewedRecord).toHaveBeenCalledWith({
      versionId: 'version-1',
    })
    expect(mockWritePublicEstimateEvent).toHaveBeenCalledWith({
      orgId: 'org-1',
      versionId: 'version-1',
      eventType: 'viewed',
      actorType: 'customer',
      metadata: {
        user_agent: 'Vitest',
      },
    })
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'sent',
        viewed_at: null,
      }),
    })
  })

  it('does not mark a view again when already viewed', async () => {
    mockLoadPublicEstimateRecordByToken.mockResolvedValue(createLoadedVersion('viewed'))

    const result = await loadPublicEstimateWorkflow({
      token: 'token-1',
      origin: 'http://localhost',
      userAgent: 'Vitest',
    })

    expect(result.ok).toBe(true)
    expect(mockMarkPublicEstimateViewedRecord).not.toHaveBeenCalled()
    expect(mockWritePublicEstimateEvent).not.toHaveBeenCalled()
  })

  it('normalizes acceptance payload aliases in one place', () => {
    expect(
      normalizePublicEstimateAcceptanceInput({
        full_name: 'Taylor Smith',
        signature: 'Taylor Smith',
        agreement_checked: true,
      })
    ).toEqual({
      legalName: 'Taylor Smith',
      signatureType: 'typed',
      signatureValue: 'Taylor Smith',
      acceptedTerms: true,
    })
  })

  it('accepts sent quotes and writes one accepted event', async () => {
    mockLoadPublicEstimateRecordByToken.mockResolvedValue(createLoadedVersion('sent'))
    mockUpdatePublicEstimateVersionRecord.mockResolvedValue({
      ok: true,
      data: { id: 'version-1', status: 'accepted' },
    })

    const result = await acceptPublicEstimateWorkflow({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
      signatureType: 'typed',
      signatureValue: 'Taylor Smith',
      userAgent: 'Vitest',
      ip: '127.0.0.1',
    })

    expect(result.ok).toBe(true)
    expect(mockUpdatePublicEstimateVersionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        versionId: 'version-1',
        payload: expect.objectContaining({
          status: 'accepted',
          acceptance_json: expect.objectContaining({
            legal_name: 'Taylor Smith',
            user_agent: 'Vitest',
            ip: '127.0.0.1',
          }),
        }),
      })
    )
    expect(mockWritePublicEstimateEvent).toHaveBeenCalledTimes(1)
  })

  it('accepts viewed quotes and writes one accepted event', async () => {
    const loaded = createLoadedVersion('sent')
    loaded.snapshot.status = 'viewed'
    loaded.snapshot.viewed_at = '2026-04-02T00:00:00.000Z'
    loaded.version.status = 'viewed'
    mockLoadPublicEstimateRecordByToken.mockResolvedValue(loaded)
    mockUpdatePublicEstimateVersionRecord.mockResolvedValue({
      ok: true,
      data: { id: 'version-1', status: 'accepted' },
    })

    const result = await acceptPublicEstimateWorkflow({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(result.ok).toBe(true)
    expect(mockWritePublicEstimateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'accepted',
      })
    )
  })

  it('returns idempotent success for repeated accept and does not duplicate events', async () => {
    mockLoadPublicEstimateRecordByToken.mockResolvedValue(createLoadedVersion('accepted'))

    const result = await acceptPublicEstimateWorkflow({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        status: 'accepted',
      }),
    })
    expect(mockWritePublicEstimateEvent).not.toHaveBeenCalled()
  })

  it('rejects accepting a declined quote as a conflict', async () => {
    mockLoadPublicEstimateRecordByToken.mockResolvedValue(createLoadedVersion('declined'))

    const result = await acceptPublicEstimateWorkflow({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'Cannot accept a declined quote',
    })
    expect(mockWritePublicEstimateEvent).not.toHaveBeenCalled()
  })

  it('declines sent quotes and writes one declined event', async () => {
    mockLoadPublicEstimateRecordByToken.mockResolvedValue(createLoadedVersion('sent'))
    mockUpdatePublicEstimateVersionRecord.mockResolvedValue({
      ok: true,
      data: { id: 'version-1', status: 'declined' },
    })

    const result = await declinePublicEstimateWorkflow({
      token: 'token-1',
      reason: 'Going another direction',
    })

    expect(result.ok).toBe(true)
    expect(mockUpdatePublicEstimateVersionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          status: 'declined',
        }),
      })
    )
    expect(mockWritePublicEstimateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'declined',
        metadata: { reason: 'Going another direction' },
      })
    )
  })

  it('declines viewed quotes and writes one declined event', async () => {
    const loaded = createLoadedVersion('sent')
    loaded.snapshot.status = 'viewed'
    loaded.snapshot.viewed_at = '2026-04-02T00:00:00.000Z'
    loaded.version.status = 'viewed'
    mockLoadPublicEstimateRecordByToken.mockResolvedValue(loaded)
    mockUpdatePublicEstimateVersionRecord.mockResolvedValue({
      ok: true,
      data: { id: 'version-1', status: 'declined' },
    })

    const result = await declinePublicEstimateWorkflow({
      token: 'token-1',
      reason: 'Going another direction',
    })

    expect(result.ok).toBe(true)
    expect(mockWritePublicEstimateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'declined',
      })
    )
  })

  it('returns idempotent success for repeated decline and does not duplicate events', async () => {
    mockLoadPublicEstimateRecordByToken.mockResolvedValue(createLoadedVersion('declined'))

    const result = await declinePublicEstimateWorkflow({
      token: 'token-1',
      reason: 'Still declining',
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        status: 'declined',
      }),
    })
    expect(mockWritePublicEstimateEvent).not.toHaveBeenCalled()
  })

  it('rejects declining an accepted quote as a conflict', async () => {
    mockLoadPublicEstimateRecordByToken.mockResolvedValue(createLoadedVersion('accepted'))

    const result = await declinePublicEstimateWorkflow({
      token: 'token-1',
      reason: 'Too late',
    })

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'Cannot decline an accepted quote',
    })
  })
})
