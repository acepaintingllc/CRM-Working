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
  createEventLookupSequence,
  createJobLookup,
  createLoadedVersion,
  createMaybeSingleChain,
  createUpdateOnlyChain,
} from './estimatePublicPortalWorkflow.testUtils'

describe('estimate public portal accept reconciliation contracts', () => {
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

  it('can repair ownership and event after event write fails following public accept', async () => {
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: createLoadedVersion('accepted'),
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
    mockWriteEstimatePublicEvent.mockResolvedValueOnce({
      ok: false,
      kind: 'server_error',
      message: 'Unable to write event',
    })

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

    const firstResult = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(firstResult).toEqual({
      ok: false,
      kind: 'server_error',
      message: 'Unable to write event',
    })
    expect(updateSpy).toHaveBeenCalledTimes(1)
    expect(estimateUpdateSpy).toHaveBeenCalledTimes(1)
    expect(jobUpdateSpy).toHaveBeenCalledTimes(1)

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
          ...createJobLookup({
            id: 'job-1',
            linked_estimate_id: null,
          }),
          update: jobUpdateSpy,
        }
      }
      if (table === 'estimate_public_events') {
        return createAcceptedEventLookup(null)
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const retryResult = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(retryResult).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'accepted',
      }),
    })
    expect(estimateUpdateSpy).toHaveBeenCalledTimes(2)
    expect(jobUpdateSpy).toHaveBeenCalledTimes(2)
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(2)
  })

  it.each(['estimate_sent', 'follow_up'])(
    'repairs accepted retry ownership and status when initial job update fails and job is %s',
    async (jobStatus) => {
      const updateSpy = vi.fn(() =>
        createMaybeSingleChain({
          data: createLoadedVersion('accepted'),
          error: null,
        })
      )
      const estimateUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
      const jobUpdateSpy = vi
        .fn()
        .mockImplementationOnce(() =>
          createUpdateOnlyChain({
            error: { message: 'Unable to update job' },
          })
        )
        .mockImplementation(() => createUpdateOnlyChain({ error: null }))

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

      const firstResult = await acceptPublicEstimate({
        token: 'token-1',
        legalName: 'Taylor Smith',
        acceptedTerms: true,
      })

      expect(firstResult).toEqual({
        ok: false,
        kind: 'server_error',
        message: 'Unable to update job',
      })

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
            ...createJobLookup({
              id: 'job-1',
              linked_estimate_id: null,
              status: jobStatus,
            }),
            update: jobUpdateSpy,
          }
        }
        if (table === 'estimate_public_events') {
          return createAcceptedEventLookup(null)
        }
        throw new Error(`Unexpected table ${table}`)
      })

      const retryResult = await acceptPublicEstimate({
        token: 'token-1',
        legalName: 'Taylor Smith',
        acceptedTerms: true,
      })

      expect(retryResult).toEqual({
        ok: true,
        data: expect.objectContaining({
          estimate_version_id: 'version-1',
          status: 'accepted',
        }),
      })
      expect(jobUpdateSpy).toHaveBeenLastCalledWith({
        linked_estimate_id: 'estimate-1',
        status: 'scheduled',
      })
      expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(1)
    }
  )

  it('reconciles ownership and writes missing event for repeated accept', async () => {
    const estimateUpdateSpy = vi.fn(() =>
      createUpdateOnlyChain({ error: null }, (filters) => {
        expect(filters).toEqual({
          org_id: 'org-1',
          id: 'estimate-1',
          accepted_public_version_id: null,
        })
      })
    )
    const jobUpdateSpy = vi.fn(() =>
      createUpdateOnlyChain({ error: null }, (filters) => {
        expect(filters).toEqual({ org_id: 'org-1', id: 'job-1' })
      })
    )

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
          ...createJobLookup({
            id: 'job-1',
            linked_estimate_id: null,
          }),
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
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'accepted',
      }),
    })
    expect(estimateUpdateSpy).toHaveBeenCalledWith({
      accepted_at: '2026-04-01T00:00:00.000Z',
      accepted_public_version_id: 'version-1',
      version_state: 'live',
    })
    expect(jobUpdateSpy).toHaveBeenCalledWith({
      linked_estimate_id: 'estimate-1',
    })
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(1)
  })

  it('writes missing accepted event without rescheduling an already linked completed job on repeated accept', async () => {
    const estimateUpdateSpy = vi.fn(() =>
      createUpdateOnlyChain({ error: null }, (filters) => {
        expect(filters).toEqual({
          org_id: 'org-1',
          id: 'estimate-1',
          accepted_public_version_id: null,
        })
      })
    )
    const jobUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))

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
          ...createJobLookup({
            id: 'job-1',
            linked_estimate_id: 'estimate-1',
            status: 'completed',
          }),
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
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'accepted',
      }),
    })
    expect(estimateUpdateSpy).toHaveBeenCalledWith({
      accepted_at: '2026-04-01T00:00:00.000Z',
      accepted_public_version_id: 'version-1',
      version_state: 'live',
    })
    expect(jobUpdateSpy).not.toHaveBeenCalled()
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(1)
  })

  it('treats duplicate terminal accepted event writes as idempotent success', async () => {
    const estimateUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    const jobUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    mockWriteEstimatePublicEvent.mockResolvedValueOnce({
      ok: false,
      kind: 'server_error',
      message:
        'duplicate key value violates unique constraint "estimate_public_events_terminal_once_idx"',
    })
    const eventLookup = createEventLookupSequence(null, {
      id: 'event-1',
      event_type: 'accepted',
    })

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
          ...createJobLookup({
            id: 'job-1',
            linked_estimate_id: null,
          }),
          update: jobUpdateSpy,
        }
      }
      if (table === 'estimate_public_events') {
        return eventLookup
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'accepted',
      }),
    })
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(1)
  })

  it('rejects duplicate terminal accept when the stored terminal event is declined', async () => {
    const estimateUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    const jobUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    mockWriteEstimatePublicEvent.mockResolvedValueOnce({
      ok: false,
      kind: 'server_error',
      message:
        'duplicate key value violates unique constraint "estimate_public_events_terminal_once_idx"',
    })
    const eventLookup = createEventLookupSequence(null, {
      id: 'event-1',
      event_type: 'declined',
    })

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
          ...createJobLookup({
            id: 'job-1',
            linked_estimate_id: null,
          }),
          update: jobUpdateSpy,
        }
      }
      if (table === 'estimate_public_events') {
        return eventLookup
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
      message: 'Public quote already has a different terminal event',
    })
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(1)
  })

  it('reconciles ownership without duplicating existing event for repeated accept', async () => {
    const estimateUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    const jobUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))

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
          ...createJobLookup({
            id: 'job-1',
            linked_estimate_id: null,
          }),
          update: jobUpdateSpy,
        }
      }
      if (table === 'estimate_public_events') {
        return createAcceptedEventLookup({ id: 'event-1' })
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'accepted',
      }),
    })
    expect(estimateUpdateSpy).toHaveBeenCalledTimes(1)
    expect(jobUpdateSpy).toHaveBeenCalledTimes(1)
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
  })
})
