import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  hasUniqueConstraintConflict: vi.fn(),
  from: vi.fn(),
  supabaseRpc: vi.fn(),
}))

vi.mock('../../org.ts', () => ({
  supabaseAdmin: {
    from: mocks.from,
    rpc: mocks.supabaseRpc,
  },
}))

import {
  createEstimateCollectionVersionRecord,
  decodeQuoteHomeCursor,
  loadEstimateCollectionRelatedRows,
  loadEstimateCollectionJobsPage,
  loadEstimateCollectionJobVersionsPage,
  searchEstimateCollectionRows,
} from '../repository.ts'
import type { EstimateCollectionVersionRow } from '../types.ts'

type QueryResponse = {
  data?: unknown[] | null
  error?: { message: string } | null
  count?: number | null
}

function makeEstimateRow(
  id: string,
  updatedAt: string | null,
  overrides?: Partial<EstimateCollectionVersionRow>
): EstimateCollectionVersionRow {
  return {
    id,
    job_id: 'job-1',
    customer_id: 'customer-1',
    status: 'draft',
    version_name: 'Version',
    version_state: 'draft',
    version_kind: 'standard',
    version_sort_order: 1,
    created_at: '2026-04-20T10:00:00.000Z',
    updated_at: updatedAt,
    ...overrides,
  }
}

function makeQuery(response: QueryResponse) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const query = {
    calls,
    select: vi.fn((...args: unknown[]) => {
      calls.push({ method: 'select', args })
      return query
    }),
    eq: vi.fn((...args: unknown[]) => {
      calls.push({ method: 'eq', args })
      return query
    }),
    order: vi.fn((...args: unknown[]) => {
      calls.push({ method: 'order', args })
      return query
    }),
    in: vi.fn((...args: unknown[]) => {
      calls.push({ method: 'in', args })
      return query
    }),
    ilike: vi.fn((...args: unknown[]) => {
      calls.push({ method: 'ilike', args })
      return query
    }),
    limit: vi.fn((...args: unknown[]) => {
      calls.push({ method: 'limit', args })
      return query
    }),
    or: vi.fn((...args: unknown[]) => {
      calls.push({ method: 'or', args })
      return query
    }),
    then: (resolve: (value: QueryResponse) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(response).then(resolve, reject),
  }
  return query
}

describe('estimate collection repository', () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
    mocks.hasUniqueConstraintConflict.mockReset()
    mocks.hasUniqueConstraintConflict.mockReturnValue(false)
    mocks.from.mockReset()
    mocks.supabaseRpc.mockReset()
  })

  it('keeps cursor decoding stable and rejects malformed cursors', () => {
    const id = '33333333-3333-4333-8333-333333333333'

    expect(decodeQuoteHomeCursor(null)).toEqual({ ok: true, value: null })
    expect(decodeQuoteHomeCursor(`2026-04-24T12:00:00Z::${id}`)).toEqual({
      ok: true,
      value: {
        timestamp: '2026-04-24T12:00:00.000Z',
        id,
      },
    })
    expect(decodeQuoteHomeCursor(`null::${id}`)).toEqual({
      ok: true,
      value: {
        timestamp: null,
        id,
      },
    })
    expect(decodeQuoteHomeCursor(`bad-date::${id}`)).toEqual({
      ok: false,
      message: 'Invalid cursor.',
    })
    expect(decodeQuoteHomeCursor(`2026-04-24T12:00:00.000Z::${id}::extra`)).toEqual({
      ok: false,
      message: 'Invalid cursor.',
    })
    expect(decodeQuoteHomeCursor('2026-04-24T12:00:00.000Z::not-a-uuid')).toEqual({
      ok: false,
      message: 'Invalid cursor.',
    })
  })

  it('validates create-version input before hitting the rpc', async () => {
    await expect(
      createEstimateCollectionVersionRecord({
        orgId: 'org-1',
        userId: 'user-1',
        body: { job_id: 'bad-id' },
        copy: {
          createdNotice: 'Estimate version created.',
          defaultVersionLabel: 'Estimate Version',
        },
      })
    ).resolves.toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid job_id',
    })

    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('maps create-version input into the transactional rpc contract', async () => {
    const _deps = { rpc: mocks.rpc, hasUniqueConstraintConflict: mocks.hasUniqueConstraintConflict }
    mocks.rpc.mockResolvedValue({
      data: {
        ok: true,
        id: 'estimate-new',
        estimate: {
          id: 'estimate-new',
          job_id: '11111111-1111-4111-8111-111111111111',
          customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          status: 'draft',
          version_name: 'Kitchen Revision 2',
          version_state: 'draft',
          version_kind: 'revision',
          version_sort_order: 2,
          created_at: '2026-04-23T16:00:00.000Z',
          updated_at: '2026-04-23T16:00:00.000Z',
        },
      },
      error: null,
    })

    const result = await createEstimateCollectionVersionRecord({
      orgId: 'org-1',
      userId: 'user-1',
      body: {
        job_id: '11111111-1111-4111-8111-111111111111',
        customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        version_kind: 'revision',
        version_name: 'Kitchen Revision 2',
      },
      copy: {
        createdNotice: 'Estimate version created.',
        defaultVersionLabel: 'Estimate Version',
      },
      _deps,
    })

    expect(mocks.rpc).toHaveBeenCalledWith('create_estimate_version', {
      p_org_id: 'org-1',
      p_user_id: 'user-1',
      p_job_id: '11111111-1111-4111-8111-111111111111',
      p_customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      p_version_state: 'draft',
      p_version_kind: 'revision',
      p_version_name: 'Kitchen Revision 2',
      p_default_version_label: 'Estimate Version',
    })
    expect(result).toEqual({
      ok: true,
      data: {
        id: 'estimate-new',
        estimate: expect.objectContaining({
          id: 'estimate-new',
          version_sort_order: 2,
        }),
      },
    })
  })

  it('maps rpc error kinds and unique-constraint failures to service results', async () => {
    const _deps = { rpc: mocks.rpc, hasUniqueConstraintConflict: mocks.hasUniqueConstraintConflict }
    mocks.rpc.mockResolvedValueOnce({
      error: { message: 'duplicate key value violates unique constraint' },
      data: null,
    })
    mocks.hasUniqueConstraintConflict.mockReturnValueOnce(true)

    await expect(
      createEstimateCollectionVersionRecord({
        orgId: 'org-1',
        userId: 'user-1',
        body: { job_id: '11111111-1111-4111-8111-111111111111' },
        copy: {
          createdNotice: 'Estimate version created.',
          defaultVersionLabel: 'Estimate Version',
        },
        _deps,
      })
    ).resolves.toEqual({
      ok: false,
      kind: 'conflict',
      message: 'Another version was created at the same time. Please retry.',
    })

    mocks.rpc.mockResolvedValueOnce({
      data: {
        ok: false,
        error_kind: 'not_found',
        error_message: 'Job not found',
      },
      error: null,
    })

    await expect(
      createEstimateCollectionVersionRecord({
        orgId: 'org-1',
        userId: 'user-1',
        body: { job_id: '11111111-1111-4111-8111-111111111111' },
        copy: {
          createdNotice: 'Estimate version created.',
          defaultVersionLabel: 'Estimate Version',
        },
        _deps,
      })
    ).resolves.toEqual({
      ok: false,
      kind: 'not_found',
      message: 'Job not found',
    })
  })

  it('uses updated_at and id as the job-version cursor boundary', async () => {
    const duplicateTimestamp = '2026-04-24T12:00:00.000Z'
    const cursorId = '33333333-3333-4333-8333-333333333333'
    const countQuery = makeQuery({ data: null, error: null, count: 4 })
    const rowsQuery = makeQuery({
      data: [
        makeEstimateRow('22222222-2222-4222-8222-222222222222', duplicateTimestamp),
        makeEstimateRow('11111111-1111-4111-8111-111111111111', duplicateTimestamp),
      ],
      error: null,
    })
    mocks.from.mockReturnValueOnce(countQuery).mockReturnValueOnce(rowsQuery)

    const result = await loadEstimateCollectionJobVersionsPage('org-1', 'job-1', {
      limit: 2,
      cursor: `${duplicateTimestamp}::${cursorId}`,
    })

    expect(result).toEqual({
      ok: true,
      data: {
        jobId: 'job-1',
        totalVersions: 4,
        limit: 2,
        nextCursor: null,
        items: [
          expect.objectContaining({ id: '22222222-2222-4222-8222-222222222222' }),
          expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' }),
        ],
      },
    })
    expect(rowsQuery.or).toHaveBeenCalledWith(
      `updated_at.lt.${duplicateTimestamp},updated_at.is.null,and(updated_at.eq.${duplicateTimestamp},id.lt.${cursorId})`
    )
  })

  it('paginates across duplicate job-version timestamps without skipping rows', async () => {
    const duplicateTimestamp = '2026-04-24T12:00:00.000Z'
    const newestTimestamp = '2026-04-24T13:00:00.000Z'
    const olderTimestamp = '2026-04-23T12:00:00.000Z'
    const allRows = [
      makeEstimateRow('55555555-5555-4555-8555-555555555555', newestTimestamp),
      makeEstimateRow('44444444-4444-4444-8444-444444444444', duplicateTimestamp),
      makeEstimateRow('33333333-3333-4333-8333-333333333333', duplicateTimestamp),
      makeEstimateRow('22222222-2222-4222-8222-222222222222', duplicateTimestamp),
      makeEstimateRow('11111111-1111-4111-8111-111111111111', olderTimestamp),
    ]
    const firstCountQuery = makeQuery({ data: null, error: null, count: allRows.length })
    const firstRowsQuery = makeQuery({ data: allRows.slice(0, 3), error: null })
    mocks.from.mockReturnValueOnce(firstCountQuery).mockReturnValueOnce(firstRowsQuery)

    const firstPage = await loadEstimateCollectionJobVersionsPage('org-1', 'job-1', { limit: 2 })

    expect(firstPage).toEqual({
      ok: true,
      data: expect.objectContaining({
        nextCursor: `${duplicateTimestamp}::44444444-4444-4444-8444-444444444444`,
        items: [
          expect.objectContaining({ id: '55555555-5555-4555-8555-555555555555' }),
          expect.objectContaining({ id: '44444444-4444-4444-8444-444444444444' }),
        ],
      }),
    })

    const secondCountQuery = makeQuery({ data: null, error: null, count: allRows.length })
    const secondRowsQuery = makeQuery({ data: allRows.slice(2, 5), error: null })
    mocks.from.mockReturnValueOnce(secondCountQuery).mockReturnValueOnce(secondRowsQuery)

    const secondPage = await loadEstimateCollectionJobVersionsPage('org-1', 'job-1', {
      limit: 2,
      cursor: firstPage.ok ? firstPage.data.nextCursor : null,
    })

    expect(secondPage).toEqual({
      ok: true,
      data: expect.objectContaining({
        nextCursor: `${duplicateTimestamp}::22222222-2222-4222-8222-222222222222`,
        items: [
          expect.objectContaining({ id: '33333333-3333-4333-8333-333333333333' }),
          expect.objectContaining({ id: '22222222-2222-4222-8222-222222222222' }),
        ],
      }),
    })
  })

  it('paginates null job-version timestamps deterministically when they are returned by the database', async () => {
    const nonNullTimestamp = '2026-04-24T12:00:00.000Z'
    const firstCountQuery = makeQuery({ data: null, error: null, count: 4 })
    const firstRowsQuery = makeQuery({
      data: [
        makeEstimateRow('22222222-2222-4222-8222-222222222222', null),
        makeEstimateRow('44444444-4444-4444-8444-444444444444', nonNullTimestamp),
        makeEstimateRow('33333333-3333-4333-8333-333333333333', null),
      ],
      error: null,
    })
    mocks.from.mockReturnValueOnce(firstCountQuery).mockReturnValueOnce(firstRowsQuery)

    const firstPage = await loadEstimateCollectionJobVersionsPage('org-1', 'job-1', { limit: 2 })

    expect(firstPage).toEqual({
      ok: true,
      data: expect.objectContaining({
        nextCursor: 'null::33333333-3333-4333-8333-333333333333',
        items: [
          expect.objectContaining({ id: '44444444-4444-4444-8444-444444444444' }),
          expect.objectContaining({ id: '33333333-3333-4333-8333-333333333333' }),
        ],
      }),
    })

    const secondCountQuery = makeQuery({ data: null, error: null, count: 4 })
    const secondRowsQuery = makeQuery({
      data: [
        makeEstimateRow('11111111-1111-4111-8111-111111111111', null),
        makeEstimateRow('22222222-2222-4222-8222-222222222222', null),
      ],
      error: null,
    })
    mocks.from.mockReturnValueOnce(secondCountQuery).mockReturnValueOnce(secondRowsQuery)

    const secondPage = await loadEstimateCollectionJobVersionsPage('org-1', 'job-1', {
      limit: 2,
      cursor: firstPage.ok ? firstPage.data.nextCursor : null,
    })

    expect(secondRowsQuery.or).toHaveBeenCalledWith(
      'and(updated_at.is.null,id.lt.33333333-3333-4333-8333-333333333333)'
    )
    expect(secondPage).toEqual({
      ok: true,
      data: expect.objectContaining({
        nextCursor: null,
        items: [
          expect.objectContaining({ id: '22222222-2222-4222-8222-222222222222' }),
          expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' }),
        ],
      }),
    })
  })

  it('preserves invalid job-version cursor behavior', async () => {
    const result = await loadEstimateCollectionJobVersionsPage('org-1', 'job-1', {
      cursor: 'not-a-valid-cursor',
    })

    expect(result).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid cursor.',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects invalid job cursors before calling the jobs-page rpc', async () => {
    const result = await loadEstimateCollectionJobsPage('org-1', {
      cursor: 'not-a-valid-cursor',
    })

    expect(result).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid cursor.',
    })
    expect(mocks.supabaseRpc).not.toHaveBeenCalled()
  })

  it('rejects null-timestamp job cursors because the jobs rpc requires created_at boundaries', async () => {
    const result = await loadEstimateCollectionJobsPage('org-1', {
      cursor: 'null::33333333-3333-4333-8333-333333333333',
    })

    expect(result).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid cursor.',
    })
    expect(mocks.supabaseRpc).not.toHaveBeenCalled()
  })

  it('returns sorted DB-shaped job page rows with duplicate timestamps', async () => {
    const duplicateTimestamp = '2026-04-24T12:00:00.000Z'
    mocks.supabaseRpc.mockResolvedValue({
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          customer_id: 'customer-1',
          customer_name: 'Taylor Smith',
          customer_address: '12 Main',
          title: 'Old tie',
          description: null,
          status: 'estimate_scheduled',
          created_at: duplicateTimestamp,
          estimate_date: null,
          estimate_sent_at: null,
          scheduled_date: null,
          scheduled_end_date: null,
          scheduled_email_sent_at: null,
          completed_at: null,
          completed_email_sent_at: null,
          closeout_notes: null,
          linked_estimate_id: null,
          version_count: 2,
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          customer_id: 'customer-1',
          customer_name: 'Taylor Smith',
          customer_address: '12 Main',
          title: 'Newest tie',
          description: null,
          status: 'estimate_scheduled',
          created_at: duplicateTimestamp,
          estimate_date: null,
          estimate_sent_at: null,
          scheduled_date: null,
          scheduled_end_date: null,
          scheduled_email_sent_at: null,
          completed_at: null,
          completed_email_sent_at: null,
          closeout_notes: null,
          linked_estimate_id: null,
          version_count: 2,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          customer_id: 'customer-1',
          customer_name: 'Taylor Smith',
          customer_address: '12 Main',
          title: 'Middle tie',
          description: null,
          status: 'estimate_scheduled',
          created_at: duplicateTimestamp,
          estimate_date: null,
          estimate_sent_at: null,
          scheduled_date: null,
          scheduled_end_date: null,
          scheduled_email_sent_at: null,
          completed_at: null,
          completed_email_sent_at: null,
          closeout_notes: null,
          linked_estimate_id: null,
          version_count: 2,
        },
      ],
      error: null,
    })

    const result = await loadEstimateCollectionJobsPage('org-1', { limit: 2 })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        rows: [
          expect.objectContaining({ id: '33333333-3333-4333-8333-333333333333' }),
          expect.objectContaining({ id: '22222222-2222-4222-8222-222222222222' }),
          expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' }),
        ],
      }),
    })
  })

  it('clamps job page limits and forwards cursor tie-break boundaries to the rpc', async () => {
    const cursorTimestamp = '2026-04-24T12:00:00.000Z'
    const cursorId = '33333333-3333-4333-8333-333333333333'
    mocks.supabaseRpc.mockResolvedValue({
      data: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          customer_id: 'customer-1',
          customer_name: 'Taylor Smith',
          customer_address: '12 Main',
          title: 'Kitchen',
          description: null,
          status: 'estimate_scheduled',
          created_at: cursorTimestamp,
          estimate_date: null,
          estimate_sent_at: null,
          scheduled_date: null,
          scheduled_end_date: null,
          scheduled_email_sent_at: null,
          completed_at: null,
          completed_email_sent_at: null,
          closeout_notes: null,
          linked_estimate_id: null,
          version_count: 2,
        },
      ],
      error: null,
    })

    const result = await loadEstimateCollectionJobsPage('org-1', {
      query: ' kitchen ',
      limit: 999,
      cursor: `${cursorTimestamp}::${cursorId}`,
    })

    expect(mocks.supabaseRpc).toHaveBeenCalledWith('quote_home_jobs_page', {
      p_org_id: 'org-1',
      p_search: 'kitchen',
      p_limit: 101,
      p_cursor_created_at: cursorTimestamp,
      p_cursor_id: cursorId,
    })
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        query: 'kitchen',
        limit: 100,
        rows: [expect.objectContaining({ id: '22222222-2222-4222-8222-222222222222' })],
      }),
    })
  })

  it('clamps low job page limits consistently', async () => {
    mocks.supabaseRpc.mockResolvedValue({
      data: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          customer_id: 'customer-1',
          customer_name: 'Taylor Smith',
          customer_address: '12 Main',
          title: 'Kitchen',
          description: null,
          status: 'estimate_scheduled',
          created_at: '2026-04-24T12:00:00.000Z',
          estimate_date: null,
          estimate_sent_at: null,
          scheduled_date: null,
          scheduled_end_date: null,
          scheduled_email_sent_at: null,
          completed_at: null,
          completed_email_sent_at: null,
          closeout_notes: null,
          linked_estimate_id: null,
          version_count: 2,
        },
        {
          id: '11111111-1111-4111-8111-111111111111',
          customer_id: 'customer-1',
          customer_name: 'Taylor Smith',
          customer_address: '12 Main',
          title: 'Kitchen',
          description: null,
          status: 'estimate_scheduled',
          created_at: '2026-04-23T12:00:00.000Z',
          estimate_date: null,
          estimate_sent_at: null,
          scheduled_date: null,
          scheduled_end_date: null,
          scheduled_email_sent_at: null,
          completed_at: null,
          completed_email_sent_at: null,
          closeout_notes: null,
          linked_estimate_id: null,
          version_count: 1,
        },
      ],
      error: null,
    })

    const result = await loadEstimateCollectionJobsPage('org-1', { limit: 0 })

    expect(mocks.supabaseRpc).toHaveBeenCalledWith(
      'quote_home_jobs_page',
      expect.objectContaining({ p_limit: 2 })
    )
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        limit: 1,
        rows: [
          expect.objectContaining({ id: '22222222-2222-4222-8222-222222222222' }),
          expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' }),
        ],
      }),
    })
  })

  it('clamps job-version page limits', async () => {
    const countQuery = makeQuery({ data: null, error: null, count: 1 })
    const rowsQuery = makeQuery({
      data: [makeEstimateRow('11111111-1111-4111-8111-111111111111', '2026-04-24T12:00:00.000Z')],
      error: null,
    })
    mocks.from.mockReturnValueOnce(countQuery).mockReturnValueOnce(rowsQuery)

    const result = await loadEstimateCollectionJobVersionsPage('org-1', 'job-1', {
      limit: 999,
    })

    expect(rowsQuery.limit).toHaveBeenCalledWith(101)
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        limit: 100,
        items: [expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' })],
      }),
    })
  })

  it('clamps low job-version page limits consistently', async () => {
    const countQuery = makeQuery({ data: null, error: null, count: 2 })
    const rowsQuery = makeQuery({
      data: [
        makeEstimateRow('22222222-2222-4222-8222-222222222222', '2026-04-24T12:00:00.000Z'),
        makeEstimateRow('11111111-1111-4111-8111-111111111111', '2026-04-23T12:00:00.000Z'),
      ],
      error: null,
    })
    mocks.from.mockReturnValueOnce(countQuery).mockReturnValueOnce(rowsQuery)

    const result = await loadEstimateCollectionJobVersionsPage('org-1', 'job-1', {
      limit: 0,
    })

    expect(rowsQuery.limit).toHaveBeenCalledWith(2)
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        limit: 1,
        nextCursor: '2026-04-24T12:00:00.000Z::22222222-2222-4222-8222-222222222222',
        items: [expect.objectContaining({ id: '22222222-2222-4222-8222-222222222222' })],
      }),
    })
  })

  it('escapes wildcard search characters and returns DB-shaped search buckets', async () => {
    const newest = makeEstimateRow('33333333-3333-4333-8333-333333333333', '2026-04-24T13:00:00.000Z')
    const tieHigh = makeEstimateRow('22222222-2222-4222-8222-222222222222', '2026-04-24T12:00:00.000Z')
    const tieLow = makeEstimateRow('11111111-1111-4111-8111-111111111111', '2026-04-24T12:00:00.000Z')
    const versionMatchesQuery = makeQuery({ data: [tieLow, newest], error: null })
    const jobsQuery = makeQuery({ data: [{ id: 'job-1' }], error: null })
    const customersQuery = makeQuery({ data: [{ id: 'customer-1' }], error: null })
    const jobLookupQuery = makeQuery({ data: [tieHigh, tieLow], error: null })
    const customerLookupQuery = makeQuery({ data: [newest], error: null })
    mocks.from
      .mockReturnValueOnce(versionMatchesQuery)
      .mockReturnValueOnce(jobsQuery)
      .mockReturnValueOnce(customersQuery)
      .mockReturnValueOnce(jobLookupQuery)
      .mockReturnValueOnce(customerLookupQuery)

    const result = await searchEstimateCollectionRows('org-1', '100%_ready\\now', 10)

    expect(versionMatchesQuery.or).toHaveBeenCalledWith(
      'version_name.ilike.%100\\%\\_ready\\\\now%,version_kind.ilike.%100\\%\\_ready\\\\now%,version_state.ilike.%100\\%\\_ready\\\\now%'
    )
    expect(jobsQuery.ilike).toHaveBeenCalledWith('title', '%100\\%\\_ready\\\\now%')
    expect(customersQuery.ilike).toHaveBeenCalledWith('name', '%100\\%\\_ready\\\\now%')
    expect(result).toEqual({
      ok: true,
      data: {
        query: '100%_ready\\now',
        limit: 10,
        versionRows: [
          expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' }),
          expect.objectContaining({ id: '33333333-3333-4333-8333-333333333333' }),
        ],
        jobRows: [
          expect.objectContaining({ id: '22222222-2222-4222-8222-222222222222' }),
          expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' }),
        ],
        customerRows: [
          expect.objectContaining({ id: '33333333-3333-4333-8333-333333333333' }),
        ],
      },
    })
  })

  it('decorates empty data and missing rollup rows without failing', async () => {
    await expect(
      loadEstimateCollectionRelatedRows('org-1', [], { includeRollups: true })
    ).resolves.toEqual({ ok: true, data: { jobs: [], customers: [], rollups: [] } })
    expect(mocks.from).not.toHaveBeenCalled()

    const jobQuery = makeQuery({
      data: [{ id: 'job-1', title: 'Kitchen', status: 'estimate_sent', estimate_sent_at: null }],
      error: null,
    })
    const customerQuery = makeQuery({ data: [{ id: 'customer-1', name: 'Taylor Smith' }], error: null })
    const rollupQuery = makeQuery({ data: [], error: null })
    mocks.from.mockReturnValueOnce(jobQuery).mockReturnValueOnce(customerQuery).mockReturnValueOnce(rollupQuery)

    await expect(
      loadEstimateCollectionRelatedRows(
        'org-1',
        [makeEstimateRow('11111111-1111-4111-8111-111111111111', '2026-04-24T12:00:00.000Z')],
        { includeRollups: true }
      )
    ).resolves.toEqual({
      ok: true,
      data: {
        jobs: [{ id: 'job-1', title: 'Kitchen', status: 'estimate_sent', estimate_sent_at: null }],
        customers: [{ id: 'customer-1', name: 'Taylor Smith' }],
        rollups: [],
      },
    })
  })
})
