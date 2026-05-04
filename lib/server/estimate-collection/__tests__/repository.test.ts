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
  loadEstimateCollectionJobContext,
  loadEstimateCollectionRelatedRows,
  loadEstimateCollectionJobsPage,
  loadEstimateCollectionJobVersionsPage,
  searchEstimateCollectionRows,
} from '../repository.ts'
import { decodeQuoteHomeCursor } from '@/lib/quotes/quoteHomeCursors'
import type { EstimateCollectionJobPageDbRow, EstimateCollectionVersionRow } from '../types.ts'

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
    setting_set_id_used: 'setting-set-1',
    created_at: '2026-04-20T10:00:00.000Z',
    updated_at: updatedAt,
    ...overrides,
  }
}

function makeJobPageRow(
  id: string,
  createdAt: string,
  customerId: string | null = 'customer-1'
): EstimateCollectionJobPageDbRow {
  return {
    id,
    customer_id: customerId,
    customer_name: customerId ? 'Taylor Smith' : null,
    customer_address: customerId ? '12 Main' : null,
    title: `Job ${id}`,
    description: null,
    status: 'estimate_scheduled',
    created_at: createdAt,
    estimate_date: null,
    estimate_sent_at: null,
    scheduled_date: null,
    scheduled_end_date: null,
    scheduled_email_sent_at: null,
    completed_at: null,
    completed_email_sent_at: null,
    closeout_notes: null,
    linked_estimate_id: null,
    version_count: customerId ? 2 : 0,
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

function makeMaybeSingleQuery(response: { data?: unknown | null; error?: { message: string } | null }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({
      data: response.data ?? null,
      error: response.error ?? null,
    })),
  }
  return query
}

function makeRowsQuery(response: { data?: unknown[] | null; error?: { message: string } | null }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    then: (resolve: (value: { data: unknown[] | null; error: { message: string } | null }) => unknown) =>
      Promise.resolve({
        data: response.data ?? null,
        error: response.error ?? null,
      }).then(resolve),
  }
  return query
}

function makeInsertMutation(
  response:
    | { data?: unknown | null; error?: { message: string } | null; withSelect: true }
    | { error?: { message: string } | null; withSelect?: false }
) {
  const afterInsert = {
    select: vi.fn(() => afterInsert),
    single: vi.fn(async () => ({
      data: 'data' in response ? response.data ?? null : null,
      error: response.error ?? null,
    })),
    then: (resolve: (value: { error: { message: string } | null }) => unknown) =>
      Promise.resolve({ error: response.error ?? null }).then(resolve),
  }
  const query = {
    insert: vi.fn(() => afterInsert),
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
          setting_set_id_used: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
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
          setting_set_id_used: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
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

  it('falls back to direct inserts when the rpc hits the uuid/text coalesce bug', async () => {
    const _deps = {
      rpc: mocks.rpc,
      from: mocks.from,
      hasUniqueConstraintConflict: mocks.hasUniqueConstraintConflict,
    }
    mocks.rpc.mockResolvedValue({
      error: { message: 'COALESCE types uuid and text cannot be matched' },
      data: null,
    })
    mocks.from.mockImplementation((relation: string) => {
      if (relation === 'jobs') {
        return makeMaybeSingleQuery({
          data: {
            id: '11111111-1111-4111-8111-111111111111',
            customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          },
        })
      }
      if (relation === 'customers') {
        return makeMaybeSingleQuery({
          data: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        })
      }
      if (relation === 'estimate_template_settings') {
        return makeMaybeSingleQuery({
          data: {
            walls_paint_id: 'template-wall-paint',
            walls_primer_id: 'template-wall-primer',
            ceiling_paint_id: 'template-ceiling-paint',
            ceiling_primer_id: 'template-ceiling-primer',
            trim_paint_id: 'template-trim-paint',
            trim_primer_id: 'template-trim-primer',
            labor_day_policy_enabled: true,
            dayhours: 8,
            rounding_increment_hours: 4,
            override_labor_rate: 40,
            job_minimum_enabled: false,
            job_minimum_amount: 0,
          },
        })
      }
      if (relation === 'estimator_setting_set') {
        return makeMaybeSingleQuery({
          data: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
        })
      }
      if (relation === 'estimator_setting_value') {
        return makeRowsQuery({
          data: [
            {
              scalar_key: 'walls_paint_id',
              value_json: { value: 'setting-wall-paint' },
            },
            {
              scalar_key: 'rounding_increment_hours',
              value_json: { value: 6 },
            },
            {
              scalar_key: 'override_labor_rate',
              value_json: { value: 55 },
            },
          ],
        })
      }
      if (relation === 'estimates') {
        return {
          ...makeMaybeSingleQuery({
            data: { version_sort_order: 1 },
          }),
          ...makeInsertMutation({
            withSelect: true,
            data: {
              id: 'estimate-fallback',
              org_id: 'org-1',
              job_id: '11111111-1111-4111-8111-111111111111',
              customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              status: 'draft',
              version_name: 'Fallback Revision',
              version_state: 'draft',
              version_kind: 'revision',
              version_sort_order: 2,
              setting_set_id_used: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              created_at: '2026-05-03T22:00:00.000Z',
              updated_at: '2026-05-03T22:00:00.000Z',
            },
          }),
        }
      }
      if (relation === 'estimate_jobsettings') {
        return makeInsertMutation({ error: null })
      }
      if (relation === 'estimate_pricing_policies') {
        return makeInsertMutation({ error: null })
      }
      throw new Error(`Unexpected relation ${relation}`)
    })

    const result = await createEstimateCollectionVersionRecord({
      orgId: 'org-1',
      userId: 'user-1',
      body: {
        job_id: '11111111-1111-4111-8111-111111111111',
        customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        version_kind: 'revision',
        version_name: 'Fallback Revision',
      },
      copy: {
        createdNotice: 'Estimate version created.',
        defaultVersionLabel: 'Estimate Version',
      },
      _deps,
    })

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'estimate-fallback',
        estimate: expect.objectContaining({
          id: 'estimate-fallback',
          version_sort_order: 2,
          setting_set_id_used: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        }),
      },
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
      cursor: { timestamp: duplicateTimestamp, id: cursorId },
    })

    expect(result).toEqual({
      ok: true,
      data: {
        jobId: 'job-1',
        totalVersions: 4,
        limit: 2,
        rows: [
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
        rows: [
          expect.objectContaining({ id: '55555555-5555-4555-8555-555555555555' }),
          expect.objectContaining({ id: '44444444-4444-4444-8444-444444444444' }),
          expect.objectContaining({ id: '33333333-3333-4333-8333-333333333333' }),
        ],
      }),
    })

    const secondCountQuery = makeQuery({ data: null, error: null, count: allRows.length })
    const secondRowsQuery = makeQuery({ data: allRows.slice(2, 5), error: null })
    mocks.from.mockReturnValueOnce(secondCountQuery).mockReturnValueOnce(secondRowsQuery)

    const secondPage = await loadEstimateCollectionJobVersionsPage('org-1', 'job-1', {
      limit: 2,
      cursor: {
        timestamp: duplicateTimestamp,
        id: '44444444-4444-4444-8444-444444444444',
      },
    })

    expect(secondPage).toEqual({
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
        rows: [
          expect.objectContaining({ id: '44444444-4444-4444-8444-444444444444' }),
          expect.objectContaining({ id: '33333333-3333-4333-8333-333333333333' }),
          expect.objectContaining({ id: '22222222-2222-4222-8222-222222222222' }),
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
      cursor: {
        timestamp: null,
        id: '33333333-3333-4333-8333-333333333333',
      },
    })

    expect(secondRowsQuery.or).toHaveBeenCalledWith(
      'and(updated_at.is.null,id.lt.33333333-3333-4333-8333-333333333333)'
    )
    expect(secondPage).toEqual({
      ok: true,
      data: expect.objectContaining({
        rows: [
          expect.objectContaining({ id: '22222222-2222-4222-8222-222222222222' }),
          expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' }),
        ],
      }),
    })
  })

  it('rejects null-timestamp job cursors because the jobs rpc requires created_at boundaries', async () => {
    const result = await loadEstimateCollectionJobsPage('org-1', {
      cursor: {
        timestamp: null,
        id: '33333333-3333-4333-8333-333333333333',
      },
    })

    expect(result).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid cursor.',
    })
    expect(mocks.supabaseRpc).not.toHaveBeenCalled()
  })

  it('returns only eligible job rows when ineligible rows appear before eligible rows', async () => {
    mocks.supabaseRpc.mockResolvedValue({
      data: [
        makeJobPageRow('44444444-4444-4444-8444-444444444444', '2026-04-24T14:00:00.000Z', null),
        makeJobPageRow(
          '33333333-3333-4333-8333-333333333333',
          '2026-04-24T13:00:00.000Z',
          'customer-3'
        ),
        makeJobPageRow(
          '22222222-2222-4222-8222-222222222222',
          '2026-04-24T12:00:00.000Z',
          'customer-2'
        ),
      ],
      error: null,
    })

    const result = await loadEstimateCollectionJobsPage('org-1', { limit: 2 })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        limit: 2,
        rows: [
          expect.objectContaining({ id: '33333333-3333-4333-8333-333333333333' }),
          expect.objectContaining({ id: '22222222-2222-4222-8222-222222222222' }),
        ],
      }),
    })
    expect(mocks.supabaseRpc).toHaveBeenCalledTimes(1)
  })

  it('returns an empty eligible job page when no returned rows are eligible', async () => {
    mocks.supabaseRpc.mockResolvedValue({
      data: [
        makeJobPageRow('33333333-3333-4333-8333-333333333333', '2026-04-24T13:00:00.000Z', null),
        makeJobPageRow('22222222-2222-4222-8222-222222222222', '2026-04-24T12:00:00.000Z', null),
      ],
      error: null,
    })

    await expect(loadEstimateCollectionJobsPage('org-1', { limit: 2 })).resolves.toEqual({
      ok: true,
      data: {
        query: '',
        limit: 2,
        rows: [],
      },
    })
  })

  it('filters many ineligible job rows without issuing extra RPC calls', async () => {
    mocks.supabaseRpc.mockResolvedValue({
      data: [
        makeJobPageRow('99999999-9999-4999-8999-999999999999', '2026-04-24T19:00:00.000Z', null),
        makeJobPageRow('88888888-8888-4888-8888-888888888888', '2026-04-24T18:00:00.000Z', null),
        makeJobPageRow('77777777-7777-4777-8777-777777777777', '2026-04-24T17:00:00.000Z', null),
        makeJobPageRow(
          '66666666-6666-4666-8666-666666666666',
          '2026-04-24T16:00:00.000Z',
          'customer-6'
        ),
      ],
      error: null,
    })

    const result = await loadEstimateCollectionJobsPage('org-1', { limit: 2 })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        rows: [expect.objectContaining({ id: '66666666-6666-4666-8666-666666666666' })],
      }),
    })
    expect(mocks.supabaseRpc).toHaveBeenCalledTimes(1)
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

  it('forwards normalized job page inputs and cursor tie-break boundaries to the rpc', async () => {
    const cursorTimestamp = '2026-04-24T12:00:00.000Z'
    const cursorId = '33333333-3333-4333-8333-333333333333'
    mocks.supabaseRpc.mockResolvedValue({
      data: [
        makeJobPageRow('44444444-4444-4444-8444-444444444444', cursorTimestamp, null),
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
      query: 'kitchen',
      limit: 100,
      cursor: { timestamp: cursorTimestamp, id: cursorId },
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

  it('forwards a bounded max job page over-fetch value that the rpc can honor', async () => {
    mocks.supabaseRpc.mockResolvedValue({
      data: [],
      error: null,
    })

    const result = await loadEstimateCollectionJobsPage('org-1', { limit: 100 })

    expect(mocks.supabaseRpc).toHaveBeenCalledWith(
      'quote_home_jobs_page',
      expect.objectContaining({ p_limit: 101 })
    )
    expect(result).toEqual({
      ok: true,
      data: {
        query: '',
        limit: 100,
        rows: [],
      },
    })
  })

  it('forwards job page limits without presentation clamping', async () => {
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
      expect.objectContaining({ p_limit: 1 })
    )
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        limit: 0,
        rows: [
          expect.objectContaining({ id: '22222222-2222-4222-8222-222222222222' }),
          expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' }),
        ],
      }),
    })
  })

  it('loads quote-create job context with customer display data', async () => {
    const jobQuery = makeQuery({
      data: [{ id: 'job-1', customer_id: 'customer-1', title: 'Kitchen' }],
      error: null,
    })
    const customerQuery = makeQuery({
      data: [{ name: 'Alice', address: '123 Main' }],
      error: null,
    })
    mocks.from.mockReturnValueOnce(jobQuery).mockReturnValueOnce(customerQuery)

    const result = await loadEstimateCollectionJobContext('org-1', 'job-1')

    expect(mocks.from).toHaveBeenNthCalledWith(1, 'jobs')
    expect(jobQuery.select).toHaveBeenCalledWith('id, customer_id, title')
    expect(jobQuery.eq).toHaveBeenCalledWith('org_id', 'org-1')
    expect(jobQuery.eq).toHaveBeenCalledWith('id', 'job-1')
    expect(mocks.from).toHaveBeenNthCalledWith(2, 'customers')
    expect(customerQuery.select).toHaveBeenCalledWith('name, address')
    expect(customerQuery.eq).toHaveBeenCalledWith('id', 'customer-1')
    expect(result).toEqual({
      ok: true,
      data: {
        id: 'job-1',
        customer_id: 'customer-1',
        customer_name: 'Alice',
        customer_address: '123 Main',
        title: 'Kitchen',
      },
    })
  })

  it('returns quote-create job context for existing customer-less jobs', async () => {
    const jobQuery = makeQuery({
      data: [{ id: 'job-1', customer_id: null, title: 'Kitchen' }],
      error: null,
    })
    mocks.from.mockReturnValueOnce(jobQuery)

    await expect(loadEstimateCollectionJobContext('org-1', 'job-1')).resolves.toEqual({
      ok: true,
      data: {
        id: 'job-1',
        customer_id: null,
        customer_name: null,
        customer_address: null,
        title: 'Kitchen',
      },
    })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('returns null quote-create job context for missing jobs', async () => {
    const jobQuery = makeQuery({ data: [], error: null })
    mocks.from.mockReturnValueOnce(jobQuery)

    await expect(loadEstimateCollectionJobContext('org-1', 'missing-job')).resolves.toEqual({
      ok: true,
      data: null,
    })
  })

  it('forwards job-version page limits without presentation clamping', async () => {
    const countQuery = makeQuery({ data: null, error: null, count: 1 })
    const rowsQuery = makeQuery({
      data: [makeEstimateRow('11111111-1111-4111-8111-111111111111', '2026-04-24T12:00:00.000Z')],
      error: null,
    })
    mocks.from.mockReturnValueOnce(countQuery).mockReturnValueOnce(rowsQuery)

    const result = await loadEstimateCollectionJobVersionsPage('org-1', 'job-1', {
      limit: 100,
    })

    expect(rowsQuery.limit).toHaveBeenCalledWith(101)
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        limit: 100,
        rows: [expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' })],
      }),
    })
  })

  it('forwards low job-version page limits without building cursors', async () => {
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

    expect(rowsQuery.limit).toHaveBeenCalledWith(1)
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        limit: 0,
        rows: [
          expect.objectContaining({ id: '22222222-2222-4222-8222-222222222222' }),
          expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' }),
        ],
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
        candidateLimit: 10,
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

  it('returns a server error when a quote home search DB query fails', async () => {
    const versionMatchesQuery = makeQuery({
      data: null,
      error: { message: 'search query failed' },
    })
    const jobsQuery = makeQuery({ data: [], error: null })
    const customersQuery = makeQuery({ data: [], error: null })
    mocks.from
      .mockReturnValueOnce(versionMatchesQuery)
      .mockReturnValueOnce(jobsQuery)
      .mockReturnValueOnce(customersQuery)

    await expect(searchEstimateCollectionRows('org-1', 'kitchen', 10)).resolves.toEqual({
      ok: false,
      kind: 'server_error',
      message: 'search query failed',
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
