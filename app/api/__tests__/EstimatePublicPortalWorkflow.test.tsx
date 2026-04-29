import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockFrom,
  mockWriteEstimatePublicEvent,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockWriteEstimatePublicEvent: vi.fn(),
}))

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/server/customer-send/repository', () => ({
  writeEstimatePublicEvent: mockWriteEstimatePublicEvent,
}))

import {
  acceptPublicEstimate,
  declinePublicEstimate,
  loadPublicEstimateSnapshot,
  markPublicEstimateViewed,
} from '@/lib/server/estimatePublicPortal'

function createMaybeSingleChain(
  result: unknown,
  hooks?: {
    eq?: (column: string, value: unknown) => void
    in?: (column: string, values: unknown[]) => void
    is?: (column: string, value: unknown) => void
    select?: (columns?: string) => void
    maybeSingle?: () => void
  }
) {
  const chain = {
    eq: vi.fn((column: string, value: unknown) => {
      hooks?.eq?.(column, value)
      return chain
    }),
    in: vi.fn((column: string, values: unknown[]) => {
      hooks?.in?.(column, values)
      return chain
    }),
    is: vi.fn((column: string, value: unknown) => {
      hooks?.is?.(column, value)
      return chain
    }),
    select: vi.fn((columns?: string) => {
      hooks?.select?.(columns)
      return chain
    }),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  chain.maybeSingle.mockImplementation(() => {
    hooks?.maybeSingle?.()
    return Promise.resolve(result)
  })
  return chain
}

function createUpdateOnlyChain(
  result: { data?: unknown; error: { message?: string } | null },
  onUpdate?: (filters: Record<string, unknown>, orFilter: string | null) => void
) {
  const filters: Record<string, unknown> = {}
  let orFilter: string | null = null
  const chain = {
    eq: vi.fn((column: string, value: unknown) => {
      filters[column] = value
      return chain
    }),
    or: vi.fn((filter: string) => {
      orFilter = filter
      return chain
    }),
    select: vi.fn(() => chain),
    maybeSingle: vi.fn(() => {
      onUpdate?.({ ...filters }, orFilter)
      return Promise.resolve({
        data: result.data === undefined ? { id: 'updated-row' } : result.data,
        error: result.error,
      })
    }),
  }
  return chain
}

function createLoadedVersion(status: string) {
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
    locked_at: status === 'accepted' || status === 'declined' ? '2026-04-01T00:00:00.000Z' : null,
    acceptance_json:
      status === 'accepted'
        ? {
            legal_name: 'Taylor Smith',
            signature_type: 'typed',
          }
        : null,
  }
}

function createAcceptedEventLookup(data: unknown) {
  return {
    select: vi.fn(() =>
      createMaybeSingleChain({
        data,
        error: null,
      })
    ),
  }
}

function createEventLookupSequence(...results: unknown[]) {
  let index = 0
  return {
    select: vi.fn(() => {
      const result = results[Math.min(index, results.length - 1)]
      index += 1
      return createMaybeSingleChain({
        data: result,
        error: null,
      })
    }),
  }
}

function createJobLookup(data: unknown) {
  return {
    select: vi.fn(() =>
      createMaybeSingleChain({
        data,
        error: null,
      })
    ),
  }
}

describe('estimate public portal transitions', () => {
  beforeEach(() => {
    vi.useRealTimers()
    mockFrom.mockReset()
    mockWriteEstimatePublicEvent.mockReset()
    mockWriteEstimatePublicEvent.mockResolvedValue({ ok: true, data: null })
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
        expect(filters).toEqual({ org_id: 'org-1', id: 'estimate-1' })
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
        expect(filters).toEqual({ org_id: 'org-1', id: 'estimate-1' })
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
        expect(filters).toEqual({ org_id: 'org-1', id: 'estimate-1' })
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
