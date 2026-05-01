import { vi } from 'vitest'

export function createMaybeSingleChain(
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

export function createUpdateOnlyChain(
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
    is: vi.fn((column: string, value: unknown) => {
      filters[column] = value
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

export function createLoadedVersion(status: string) {
  return {
    id: 'version-1',
    org_id: 'org-1',
    estimate_id: 'estimate-1',
    created_by: 'staff-user-1',
    version_number: 2,
    status,
    public_token: 'token-1',
    snapshot_json: {
      document: {
        meta: {
          title: 'Kitchen Quote',
          version_name: 'Option A',
        },
        company: {
          business_name: 'ACE Painting',
          business_email: 'office@example.com',
        },
        customer: {
          name: 'Taylor Smith',
          email: 'taylor@example.com',
          address: '123 Main St',
        },
        total: 4250,
      },
    },
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
  }
}

export function createAcceptedEventLookup(data: unknown) {
  return {
    select: vi.fn(() =>
      createMaybeSingleChain({
        data,
        error: null,
      })
    ),
  }
}

export function createEventLookupSequence(...results: unknown[]) {
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

export function createJobLookup(data: unknown) {
  return {
    select: vi.fn(() =>
      createMaybeSingleChain({
        data,
        error: null,
      })
    ),
  }
}
