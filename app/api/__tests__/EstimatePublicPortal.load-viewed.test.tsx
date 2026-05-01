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
  loadPublicEstimateSnapshot,
  markPublicEstimateViewed,
} from '@/lib/server/estimatePublicPortal'
import {
  createLoadedVersion,
  createMaybeSingleChain,
} from './estimatePublicPortalWorkflow.testUtils'

describe('estimate public portal load and viewed route contracts', () => {
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

  it('marks viewed with org and status guards and writes one viewed event', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-02T12:00:00.000Z'))

    const updateFilters: Array<[string, unknown]> = []
    const updateStatusFilters: Array<[string, unknown[]]> = []
    const nullFilters: Array<[string, unknown]> = []
    const viewedVersion = {
      ...createLoadedVersion('viewed'),
      viewed_at: '2026-04-02T12:00:00.000Z',
    }
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain(
        {
          data: viewedVersion,
          error: null,
        },
        {
          eq: (column, value) => {
            updateFilters.push([column, value])
          },
          in: (column, values) => {
            updateStatusFilters.push([column, values])
          },
          is: (column, value) => {
            nullFilters.push([column, value])
          },
        }
      )
    )

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          update: updateSpy,
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await markPublicEstimateViewed({
      orgId: 'org-1',
      versionId: 'version-1',
      actorType: 'staff',
      metadata: { origin: 'preview' },
    })

    expect(result).toEqual({
      ok: true,
      viewed_at: '2026-04-02T12:00:00.000Z',
      version: viewedVersion,
    })
    expect(updateSpy).toHaveBeenCalledWith({
      status: 'viewed',
      viewed_at: '2026-04-02T12:00:00.000Z',
    })
    expect(updateFilters).toEqual([
      ['org_id', 'org-1'],
      ['id', 'version-1'],
    ])
    expect(updateStatusFilters).toEqual([
      ['status', ['sent', 'viewed']],
    ])
    expect(nullFilters).toEqual([
      ['viewed_at', null],
    ])
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(1)
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledWith({
      orgId: 'org-1',
      versionId: 'version-1',
      eventType: 'viewed',
      actorType: 'staff',
      metadata: { origin: 'preview' },
    })
  })

  it('keeps the loaded snapshot when viewed update races and affects no row', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-02T12:00:00.000Z'))

    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: null,
        error: null,
      })
    )

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: {
                ...createLoadedVersion('sent'),
                viewed_at: null,
              },
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
        status: 'sent',
        viewed_at: null,
      }),
    })
    expect(updateSpy).toHaveBeenCalledWith({
      status: 'viewed',
      viewed_at: '2026-04-02T12:00:00.000Z',
    })
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
  })

  it('treats already-viewed rows as a no-op and skips viewed event writes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-02T12:00:00.000Z'))

    const nullFilters: Array<[string, unknown]> = []
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain(
        {
          data: null,
          error: null,
        },
        {
          is: (column, value) => {
            nullFilters.push([column, value])
          },
        }
      )
    )

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          update: updateSpy,
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await markPublicEstimateViewed({
      orgId: 'org-1',
      versionId: 'version-1',
      actorType: 'customer',
    })

    expect(result).toEqual({
      ok: true,
      viewed_at: null,
      version: null,
    })
    expect(nullFilters).toEqual([
      ['viewed_at', null],
    ])
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
  })
})
