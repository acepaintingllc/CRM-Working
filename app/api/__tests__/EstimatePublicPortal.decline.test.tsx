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
  declinePublicEstimate,
} from '@/lib/server/estimatePublicPortal'
import {
  createAcceptedEventLookup,
  createLoadedVersion,
  createMaybeSingleChain,
} from './estimatePublicPortalWorkflow.testUtils'

describe('estimate public portal decline route contracts', () => {
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

  it('declines viewed quotes and writes one declined event', async () => {
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: createLoadedVersion('declined'),
        error: null,
      }, {
        in: (column, values) => {
          expect(column).toBe('status')
          expect(values).toEqual(['sent', 'viewed'])
        },
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
      if (table === 'estimate_public_events') {
        return createAcceptedEventLookup(null)
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await declinePublicEstimate({
      token: 'token-1',
      reason: 'Going another direction',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected declined result')
    expect(result.data).toEqual(
      expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'declined',
        declined_at: '2026-04-01T00:00:00.000Z',
      })
    )
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'declined',
      })
    )
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'declined',
        metadata: { reason: 'Going another direction' },
      })
    )
    expect(mockSendPublicEstimateDeclineNotification).toHaveBeenCalledTimes(1)
    expect(mockSendPublicEstimateDeclineNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: undefined,
        orgId: 'org-1',
        userId: 'staff-user-1',
        publicToken: 'token-1',
        declinedAt: expect.any(String),
        reason: 'Going another direction',
      })
    )
    expect(mockSendPublicEstimateAcceptanceNotifications).not.toHaveBeenCalled()
  })

  it('writes missing declined event for repeated decline', async () => {
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
      if (table === 'estimate_public_events') {
        return createAcceptedEventLookup(null)
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
        estimate_version_id: 'version-1',
        status: 'declined',
      }),
    })
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(1)
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'declined',
        actorType: 'customer',
        metadata: { reason: 'Still declining' },
      })
    )
  })

  it('does not duplicate existing declined event for repeated decline', async () => {
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
      if (table === 'estimate_public_events') {
        return createAcceptedEventLookup({ id: 'event-1' })
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
        estimate_version_id: 'version-1',
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
})
