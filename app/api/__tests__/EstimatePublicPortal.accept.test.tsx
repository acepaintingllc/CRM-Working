import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockFrom,
  mockWriteEstimatePublicEvent,
  mockSendPublicEstimateAcceptanceNotifications,
  mockSendPublicEstimateDeclineNotification,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockWriteEstimatePublicEvent: vi.fn(),
  mockSendPublicEstimateAcceptanceNotifications: vi.fn(),
  mockSendPublicEstimateDeclineNotification: vi.fn(),
}))

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/server/customer-send/repository', () => ({
  writeEstimatePublicEvent: mockWriteEstimatePublicEvent,
}))

vi.mock('@/lib/server/publicEstimateNotifications', () => ({
  sendPublicEstimateAcceptanceNotifications: mockSendPublicEstimateAcceptanceNotifications,
  sendPublicEstimateDeclineNotification: mockSendPublicEstimateDeclineNotification,
}))

import {
  acceptPublicEstimate,
} from '@/lib/server/estimatePublicPortal'
import {
  createAcceptedEventLookup,
  createLoadedVersion,
  createMaybeSingleChain,
  createUpdateOnlyChain,
} from './estimatePublicPortalWorkflow.testUtils'

describe('estimate public portal accept route contracts', () => {
  beforeEach(() => {
    vi.useRealTimers()
    mockFrom.mockReset()
    mockWriteEstimatePublicEvent.mockReset()
    mockWriteEstimatePublicEvent.mockResolvedValue({ ok: true, data: null })
    mockSendPublicEstimateAcceptanceNotifications.mockReset()
    mockSendPublicEstimateDeclineNotification.mockReset()
    mockSendPublicEstimateAcceptanceNotifications.mockResolvedValue({
      internal: { messageId: 'internal-1' },
      customer: { messageId: 'customer-1' },
    })
    mockSendPublicEstimateDeclineNotification.mockResolvedValue({
      internal: { messageId: 'internal-1' },
    })
  })

  it('accepts sent quotes and writes one accepted event', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-01T00:00:00.000Z'))

    const calls: string[] = []
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: createLoadedVersion('accepted'),
        error: null,
      }, {
        in: (column, values) => {
          expect(column).toBe('status')
          expect(values).toEqual(['sent', 'viewed'])
        },
        maybeSingle: () => {
          calls.push('public-version-update')
        },
      })
    )
    const estimateUpdateSpy = vi.fn(() =>
      createUpdateOnlyChain({ error: null }, (filters) => {
        expect(filters).toEqual({
          org_id: 'org-1',
          id: 'estimate-1',
          accepted_public_version_id: null,
        })
        calls.push('estimate-update')
      })
    )
    const jobUpdateSpy = vi.fn(() =>
      createUpdateOnlyChain({ error: null }, (filters) => {
        expect(filters).toEqual({ org_id: 'org-1', id: 'job-1' })
        calls.push('job-update')
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
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: { id: 'estimate-1', job_id: 'job-1' },
              error: null,
            })
          ),
          update: estimateUpdateSpy,
        }
      }
      if (table === 'jobs') {
        return {
          update: jobUpdateSpy,
        }
      }
      if (table === 'estimate_public_events') {
        return createAcceptedEventLookup(null)
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
    if (!result.ok) throw new Error('Expected accepted result')
    expect(result.data).toEqual(
      expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'accepted',
        accepted_at: '2026-04-01T00:00:00.000Z',
      })
    )
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
    expect(estimateUpdateSpy).toHaveBeenCalledWith({
      accepted_at: '2026-04-01T00:00:00.000Z',
      accepted_public_version_id: 'version-1',
      version_state: 'live',
    })
    expect(jobUpdateSpy).toHaveBeenCalledWith({
      linked_estimate_id: 'estimate-1',
      status: 'scheduled',
    })
    expect(calls).toEqual([
      'public-version-update',
      'estimate-update',
      'job-update',
    ])
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(1)
    expect(mockSendPublicEstimateAcceptanceNotifications).toHaveBeenCalledTimes(1)
    expect(mockSendPublicEstimateAcceptanceNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: undefined,
        orgId: 'org-1',
        userId: 'staff-user-1',
        publicToken: 'token-1',
        acceptedBy: 'Taylor Smith',
        acceptedAt: '2026-04-01T00:00:00.000Z',
      })
    )
    expect(mockSendPublicEstimateDeclineNotification).not.toHaveBeenCalled()
  })

  it('logs notification delivery failures without rolling back accepted quotes', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSendPublicEstimateAcceptanceNotifications.mockResolvedValueOnce({
      internal: { error: 'Gmail authorization required' },
      customer: { skipped: true, reason: 'missing_sender_user' },
    })

    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: createLoadedVersion('accepted'),
        error: null,
      })
    )
    const estimateUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    const jobUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))

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
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: { id: 'estimate-1', job_id: 'job-1' },
              error: null,
            })
          ),
          update: estimateUpdateSpy,
        }
      }
      if (table === 'jobs') {
        return {
          update: jobUpdateSpy,
        }
      }
      if (table === 'estimate_public_events') {
        return createAcceptedEventLookup(null)
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
      origin: 'https://example.test',
    })

    expect(result.ok).toBe(true)
    expect(errorSpy).toHaveBeenCalledWith(
      '[public-estimate-notification] acceptance internal failed',
      'Gmail authorization required'
    )
    expect(errorSpy).toHaveBeenCalledWith(
      '[public-estimate-notification] acceptance customer skipped',
      'missing_sender_user'
    )

    errorSpy.mockRestore()
  })

  it('returns conflict when status-conditional accept update affects no row', async () => {
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: null,
        error: null,
      }, {
        in: (column, values) => {
          expect(column).toBe('status')
          expect(values).toEqual(['sent', 'viewed'])
        },
      })
    )
    const estimateUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    const jobUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))

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
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: { id: 'estimate-1', job_id: 'job-1' },
              error: null,
            })
          ),
          update: estimateUpdateSpy,
        }
      }
      if (table === 'jobs') {
        return {
          update: jobUpdateSpy,
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'Quote status changed before this action completed',
    })
    expect(estimateUpdateSpy).not.toHaveBeenCalled()
    expect(jobUpdateSpy).not.toHaveBeenCalled()
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
  })

  it('rejects accepting a stale public version when the estimate is already accepted by another version', async () => {
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: createLoadedVersion('accepted'),
        error: null,
      })
    )
    const estimateUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    const jobUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))

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
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: {
                id: 'estimate-1',
                job_id: 'job-1',
                accepted_public_version_id: 'version-2',
                accepted_at: '2026-04-01T00:00:00.000Z',
              },
              error: null,
            })
          ),
          update: estimateUpdateSpy,
        }
      }
      if (table === 'jobs') {
        return {
          update: jobUpdateSpy,
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'Estimate is already accepted by another public version',
    })
    expect(updateSpy).not.toHaveBeenCalled()
    expect(estimateUpdateSpy).not.toHaveBeenCalled()
    expect(jobUpdateSpy).not.toHaveBeenCalled()
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
  })

  it('maps accepted public version unique-index races to conflict', async () => {
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: null,
        error: {
          message:
            'duplicate key value violates unique constraint "estimate_public_versions_one_accepted_per_estimate_idx"',
        },
      })
    )
    const estimateUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    const jobUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))

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
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: {
                id: 'estimate-1',
                job_id: 'job-1',
                accepted_public_version_id: null,
                accepted_at: null,
              },
              error: null,
            })
          ),
          update: estimateUpdateSpy,
        }
      }
      if (table === 'jobs') {
        return {
          update: jobUpdateSpy,
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'Estimate is already accepted by another public version',
    })
    expect(estimateUpdateSpy).not.toHaveBeenCalled()
    expect(jobUpdateSpy).not.toHaveBeenCalled()
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
    })

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'Cannot accept a declined quote',
    })
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
  })

  it('rejects accepting a superseded quote as a conflict', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('superseded'),
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
      signatureType: 'typed',
      signatureValue: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'A newer quote is available.',
    })
  })
})
