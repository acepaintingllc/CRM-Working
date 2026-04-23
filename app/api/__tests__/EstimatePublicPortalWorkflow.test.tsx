import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockFrom,
  mockWriteEstimatePublicEvent,
  mockServerLogInfo,
  mockServerLogError,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockWriteEstimatePublicEvent: vi.fn(),
  mockServerLogInfo: vi.fn(),
  mockServerLogError: vi.fn(),
}))

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/server/customer-send/repository', () => ({
  writeEstimatePublicEvent: mockWriteEstimatePublicEvent,
}))

vi.mock('@/lib/server/log', () => ({
  serverLog: {
    debug: vi.fn(),
    info: mockServerLogInfo,
    warn: vi.fn(),
    error: mockServerLogError,
  },
}))

import {
  loadPublicEstimateSnapshot,
  acceptPublicEstimate,
  declinePublicEstimate,
} from '@/lib/server/estimatePublicPortal'

function createMaybeSingleChain(result: unknown) {
  const chain = {
    eq: vi.fn(),
    in: vi.fn(),
    is: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  chain.eq.mockReturnValue(chain)
  chain.in.mockReturnValue(chain)
  chain.is.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  return chain
}

function createLoadedVersion(
  status: string,
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: 'version-1',
    org_id: 'org-1',
    estimate_id: 'estimate-1',
    version_number: 2,
    status,
    public_token: 'token-1',
    snapshot_json: {
      document: {
        meta: {
          title: 'Kitchen Quote',
          version_name: 'Option A',
        },
      },
    },
    accepted_at: status === 'accepted' ? '2026-04-01T00:00:00.000Z' : null,
    declined_at: status === 'declined' ? '2026-04-01T00:00:00.000Z' : null,
    viewed_at: status === 'viewed' ? '2026-04-01T00:00:00.000Z' : null,
    locked_at: status === 'accepted' || status === 'declined' ? '2026-04-01T00:00:00.000Z' : null,
    acceptance_json:
      status === 'accepted'
        ? {
            legal_name: 'Taylor Smith',
            signature_type: 'typed',
          }
        : null,
    ...overrides,
  }
}

describe('estimate public portal transitions', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockWriteEstimatePublicEvent.mockReset()
    mockServerLogInfo.mockReset()
    mockServerLogError.mockReset()
    mockWriteEstimatePublicEvent.mockResolvedValue({ ok: true, data: null })
  })

<<<<<<< Updated upstream
  it('accepts sent quotes and writes one accepted event', async () => {
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: { id: 'version-1', status: 'accepted' },
        error: null,
=======
  it('returns invalid_input for a blank public token', async () => {
    const result = await loadPublicEstimateSnapshot('')

    expect(result).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid token',
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns not_found when the public token does not exist', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: null,
              error: null,
            })
          ),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await loadPublicEstimateSnapshot('missing-token')

    expect(result).toEqual({
      ok: false,
      kind: 'not_found',
      message: 'Quote not found',
    })
  })

  it('marks the first eligible public view with org-scoped guards and writes one viewed event', async () => {
    const updateChain = createMaybeSingleChain({
      data: createLoadedVersion('viewed'),
      error: null,
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('sent', { viewed_at: null }),
              error: null,
            })
          ),
          update: vi.fn(() => updateChain),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await loadPublicEstimateSnapshot(
      'token-1',
      { origin: 'http://localhost' },
      { metadata: { user_agent: 'Vitest' } }
    )

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'viewed',
        viewed_at: '2026-04-01T00:00:00.000Z',
        public_url: 'http://localhost/quote/token-1',
      }),
    })
    expect(updateChain.eq).toHaveBeenNthCalledWith(1, 'org_id', 'org-1')
    expect(updateChain.eq).toHaveBeenNthCalledWith(2, 'id', 'version-1')
    expect(updateChain.is).toHaveBeenCalledWith('viewed_at', null)
    expect(updateChain.in).toHaveBeenCalledWith('status', ['sent', 'viewed'])
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        versionId: 'version-1',
        eventType: 'viewed',
        metadata: { user_agent: 'Vitest' },
>>>>>>> Stashed changes
      })
    )
    expect(mockServerLogInfo).toHaveBeenCalledWith(
      'estimate_public_view_write_result',
      expect.objectContaining({
        orgId: 'org-1',
        versionId: 'version-1',
        applied: true,
      })
    )
  })

  it('returns repeat views without writing again', async () => {
    const updateSpy = vi.fn()

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('viewed'),
              error: null,
            })
          ),
          update: updateSpy,
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await loadPublicEstimateSnapshot('token-1')

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'viewed',
        viewed_at: '2026-04-01T00:00:00.000Z',
      }),
    })
    expect(updateSpy).not.toHaveBeenCalled()
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
  })

  it('returns locked accepted and declined snapshots without attempting a view write', async () => {
    const updateSpy = vi.fn()
    mockFrom
      .mockImplementationOnce((table: string) => {
        if (table === 'estimate_public_versions') {
          return {
            select: vi.fn(() =>
              createMaybeSingleChain({
                data: createLoadedVersion('accepted'),
                error: null,
              })
            ),
            update: updateSpy,
          }
        }
        throw new Error(`Unexpected table ${table}`)
      })
      .mockImplementationOnce((table: string) => {
        if (table === 'estimate_public_versions') {
          return {
            select: vi.fn(() =>
              createMaybeSingleChain({
                data: createLoadedVersion('declined'),
                error: null,
              })
            ),
            update: updateSpy,
          }
        }
        throw new Error(`Unexpected table ${table}`)
      })

    const accepted = await loadPublicEstimateSnapshot('token-1')
    const declined = await loadPublicEstimateSnapshot('token-1')

    expect(accepted).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'accepted',
      }),
    })
    expect(declined).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'declined',
      }),
    })
    expect(updateSpy).not.toHaveBeenCalled()
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
  })

  it('reloads and returns the latest locked snapshot when the first-view write is skipped', async () => {
    const updateChain = createMaybeSingleChain({
      data: null,
      error: null,
    })
    let selectCount = 0

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() => {
            selectCount += 1
            return createMaybeSingleChain({
              data:
                selectCount === 1
                  ? createLoadedVersion('sent', { viewed_at: null })
                  : createLoadedVersion('accepted'),
              error: null,
            })
          }),
          update: vi.fn(() => updateChain),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await loadPublicEstimateSnapshot('token-1')

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'accepted',
      }),
    })
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
    expect(mockServerLogInfo).toHaveBeenCalledWith(
      'estimate_public_view_write_result',
      expect.objectContaining({
        orgId: 'org-1',
        versionId: 'version-1',
        applied: false,
        reason: 'skipped',
      })
    )
  })

  it('returns server_error and logs when the public snapshot is missing', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('sent', { snapshot_json: {} }),
              error: null,
            })
          ),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await loadPublicEstimateSnapshot('token-1')

    expect(result).toEqual({
      ok: false,
      kind: 'server_error',
      message: 'Quote snapshot missing',
    })
    expect(mockServerLogError).toHaveBeenCalledWith(
      'estimate_public_snapshot_load_failed',
      expect.objectContaining({
        token: 'token-1',
        orgId: 'org-1',
        versionId: 'version-1',
        message: 'Quote snapshot missing',
      })
    )
  })

  it('accepts sent quotes and writes one accepted event', async () => {
    const updateChain = createMaybeSingleChain({
      data: createLoadedVersion('accepted'),
      error: null,
    })
    const updateSpy = vi.fn(() => updateChain)

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('sent'),
              error: null,
            })
          ),
          update: updateSpy,
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
      signatureType: 'typed',
      signatureValue: 'Taylor Smith',
      userAgent: 'Vitest',
      ip: '127.0.0.1',
    })

    expect(result.ok).toBe(true)
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'accepted',
        acceptance_json: expect.objectContaining({
          legal_name: 'Taylor Smith',
          user_agent: 'Vitest',
          ip: '127.0.0.1',
        }),
      })
    )
    expect(updateChain.eq).toHaveBeenNthCalledWith(1, 'org_id', 'org-1')
    expect(updateChain.eq).toHaveBeenNthCalledWith(2, 'id', 'version-1')
    expect(updateChain.in).toHaveBeenCalledWith('status', ['sent', 'viewed'])
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(1)
    expect(mockServerLogInfo).toHaveBeenCalledWith(
      'estimate_public_transition_attempt',
      expect.objectContaining({
        action: 'accept',
        currentStatus: 'sent',
        orgId: 'org-1',
        versionId: 'version-1',
      })
    )
    expect(mockServerLogInfo).toHaveBeenCalledWith(
      'estimate_public_transition_event_written',
      expect.objectContaining({
        action: 'accept',
        eventType: 'accepted',
      })
    )
  })

  it('returns idempotent success for repeated accept and does not duplicate events', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('accepted'),
              error: null,
            })
          ),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
      signatureType: 'typed',
      signatureValue: 'Taylor Smith',
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        status: 'accepted',
      }),
    })
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
  })

  it('rejects accepting a declined quote as a conflict', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('declined'),
              error: null,
            })
          ),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
      signatureType: 'typed',
      signatureValue: 'Taylor Smith',
    })

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'Cannot accept a declined quote',
    })
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
  })

  it('declines viewed quotes and writes one declined event', async () => {
<<<<<<< Updated upstream
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: { id: 'version-1', status: 'declined' },
        error: null,
      })
    )
=======
    const updateChain = createMaybeSingleChain({
      data: createLoadedVersion('declined'),
      error: null,
    })
    const updateSpy = vi.fn(() => updateChain)
>>>>>>> Stashed changes

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('viewed'),
              error: null,
            })
          ),
          update: updateSpy,
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await declinePublicEstimate({
      token: 'token-1',
      reason: 'Going another direction',
    })

    expect(result.ok).toBe(true)
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'declined',
      })
    )
    expect(updateChain.eq).toHaveBeenNthCalledWith(1, 'org_id', 'org-1')
    expect(updateChain.eq).toHaveBeenNthCalledWith(2, 'id', 'version-1')
    expect(updateChain.in).toHaveBeenCalledWith('status', ['sent', 'viewed'])
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'declined',
        metadata: { reason: 'Going another direction' },
      })
    )
    expect(mockServerLogInfo).toHaveBeenCalledWith(
      'estimate_public_transition_attempt',
      expect.objectContaining({
        action: 'decline',
        currentStatus: 'viewed',
        orgId: 'org-1',
        versionId: 'version-1',
      })
    )
    expect(mockServerLogInfo).toHaveBeenCalledWith(
      'estimate_public_transition_event_written',
      expect.objectContaining({
        action: 'decline',
        eventType: 'declined',
      })
    )
  })

  it('returns idempotent success for repeated decline and does not duplicate events', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('declined'),
              error: null,
            })
          ),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await declinePublicEstimate({
      token: 'token-1',
      reason: 'Still declining',
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        status: 'declined',
      }),
    })
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
  })

  it('rejects declining an accepted quote as a conflict', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('accepted'),
              error: null,
            })
          ),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await declinePublicEstimate({
      token: 'token-1',
      reason: 'Too late',
    })

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'Cannot decline an accepted quote',
    })
  })

  it('rejects invalid acceptance payloads before loading or writing', async () => {
    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
      signatureType: 'typed',
      signatureValue: 'Taylor S.',
    })

    expect(result).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Typed signature must match the full legal name',
    })
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
  })

  it('returns stable repeat success when an accept write loses the race to another accept', async () => {
    const updateChain = createMaybeSingleChain({
      data: null,
      error: null,
    })
    let selectCount = 0

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() => {
            selectCount += 1
            return createMaybeSingleChain({
              data:
                selectCount === 1
                  ? createLoadedVersion('sent')
                  : createLoadedVersion('accepted'),
              error: null,
            })
          }),
          update: vi.fn(() => updateChain),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
      signatureType: 'typed',
      signatureValue: 'Taylor Smith',
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'accepted',
      }),
    })
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
    expect(mockServerLogInfo).toHaveBeenCalledWith(
      'estimate_public_transition_write_result',
      expect.objectContaining({
        action: 'accept',
        applied: false,
        latestStatus: 'accepted',
      })
    )
  })

  it('returns stable conflict when a decline write loses the race to an accept', async () => {
    const updateChain = createMaybeSingleChain({
      data: null,
      error: null,
    })
    let selectCount = 0

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() => {
            selectCount += 1
            return createMaybeSingleChain({
              data:
                selectCount === 1
                  ? createLoadedVersion('viewed')
                  : createLoadedVersion('accepted'),
              error: null,
            })
          }),
          update: vi.fn(() => updateChain),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await declinePublicEstimate({
      token: 'token-1',
      reason: 'Going another direction',
    })

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'Cannot decline an accepted quote',
    })
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
    expect(mockServerLogInfo).toHaveBeenCalledWith(
      'estimate_public_transition_write_result',
      expect.objectContaining({
        action: 'decline',
        applied: false,
        latestStatus: 'accepted',
      })
    )
  })

  it('returns accepted success even when accepted event logging fails after the status update', async () => {
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: createLoadedVersion('accepted'),
        error: null,
      })
    )

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('sent'),
              error: null,
            })
          ),
          update: updateSpy,
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })
    mockWriteEstimatePublicEvent.mockResolvedValueOnce({
      ok: false,
      kind: 'server_error',
      message: 'insert failed',
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
      signatureType: 'typed',
      signatureValue: 'Taylor Smith',
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'accepted',
      }),
    })
    expect(updateSpy).toHaveBeenCalledTimes(1)
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(1)
    expect(mockServerLogError).toHaveBeenCalledWith(
      'estimate_public_transition_event_failed',
      expect.objectContaining({
        action: 'accept',
        eventType: 'accepted',
        message: 'insert failed',
      })
    )
  })

  it('returns declined success even when declined event logging fails after the status update', async () => {
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: createLoadedVersion('declined'),
        error: null,
      })
    )

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('viewed'),
              error: null,
            })
          ),
          update: updateSpy,
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })
    mockWriteEstimatePublicEvent.mockResolvedValueOnce({
      ok: false,
      kind: 'server_error',
      message: 'insert failed',
    })

    const result = await declinePublicEstimate({
      token: 'token-1',
      reason: 'Going another direction',
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'declined',
      }),
    })
    expect(updateSpy).toHaveBeenCalledTimes(1)
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(1)
    expect(mockServerLogError).toHaveBeenCalledWith(
      'estimate_public_transition_event_failed',
      expect.objectContaining({
        action: 'decline',
        eventType: 'declined',
        message: 'insert failed',
      })
    )
  })
})
