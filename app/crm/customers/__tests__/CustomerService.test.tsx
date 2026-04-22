import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { supabaseAdmin } from '@/lib/customers/api'
const serverLogWarn = vi.fn()
const serverLogError = vi.fn()

vi.mock('@/lib/customers/api', () => ({
  supabaseAdmin: {
    from() {
      throw new Error('Test should inject a customer db dependency')
    },
  },
}))
vi.mock('@/lib/server/log', () => ({
  serverLog: {
    warn: (...args: unknown[]) => serverLogWarn(...args),
    error: (...args: unknown[]) => serverLogError(...args),
  },
}))
import {
  createCustomer,
  createCustomerTimelineNote,
  deleteCustomer,
  getCustomerDetail,
  listCustomerTimeline,
  listCustomers,
  updateCustomer,
} from '@/lib/customers/service'

type QueryState = {
  table: string
  action: 'select' | 'insert' | 'update' | 'delete'
  payload: unknown
  select: string | null
  selectOptions?: unknown
  filters: Array<{ type: 'eq' | 'in' | 'or'; column: string; value: unknown }>
  order: Array<{ column: string; options?: unknown }>
  range: { from: number; to: number } | null
}

type QueryResult = {
  data: unknown
  error: { code?: string | null; message: string } | null
  count?: number | null
}

function createMockDb(handler: (state: QueryState) => QueryResult | Promise<QueryResult>) {
  function buildQuery(table: string) {
    const state: QueryState = {
      table,
      action: 'select',
      payload: null,
      select: null,
      selectOptions: null,
      filters: [],
      order: [],
      range: null,
    }

    const query = {
      select(value: string, options?: unknown) {
        state.select = value
        state.selectOptions = options
        return query
      },
      insert(value: unknown) {
        state.action = 'insert'
        state.payload = value
        return query
      },
      update(value: unknown) {
        state.action = 'update'
        state.payload = value
        return query
      },
      delete() {
        state.action = 'delete'
        return query
      },
      eq(column: string, value: unknown) {
        state.filters.push({ type: 'eq', column, value })
        return query
      },
      in(column: string, value: unknown) {
        state.filters.push({ type: 'in', column, value })
        return query
      },
      or(value: string) {
        state.filters.push({ type: 'or', column: 'or', value })
        return query
      },
      order(column: string, options?: unknown) {
        state.order.push({ column, options })
        return query
      },
      range(from: number, to: number) {
        state.range = { from, to }
        return query
      },
      maybeSingle() {
        return Promise.resolve(handler(state))
      },
      single() {
        return Promise.resolve(handler(state))
      },
      then(
        onFulfilled: (value: QueryResult) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) {
        return Promise.resolve(handler(state)).then(onFulfilled, onRejected)
      },
    }

    return query
  }

  return {
    from(table: string) {
      return buildQuery(table)
    },
  } as unknown as typeof supabaseAdmin
}

describe('customer service layer', () => {
  beforeEach(() => {
    serverLogWarn.mockReset()
    serverLogError.mockReset()
  })

  it('lists mapped customer summaries', async () => {
    const db = createMockDb((state) => {
      expect(state.table).toBe('customers')
      expect(state.action).toBe('select')
      expect(state.range).toEqual({ from: 0, to: 49 })
      expect(state.selectOptions).toEqual({ count: 'exact' })
      return {
        data: [{ id: 'customer-1', name: 'Taylor Jones', email: 'taylor@example.com', phone: null, address: '123 Main St' }],
        count: 1,
        error: null,
      }
    })

    const result = await listCustomers('org-1', {}, { db })
    expect(result).toEqual({
      ok: true,
      data: {
        data: [{ id: 'customer-1', name: 'Taylor Jones', email: 'taylor@example.com', phone: null, address: '123 Main St' }],
        total: 1,
        page: 1,
        pageSize: 50,
      },
    })
  })

  it('applies page offsets and server-side search filters', async () => {
    const db = createMockDb((state) => {
      expect(state.range).toEqual({ from: 25, to: 49 })
      expect(state.filters).toContainEqual({
        type: 'or',
        column: 'or',
        value: 'name.ilike.%bob%,email.ilike.%bob%,phone.ilike.%bob%',
      })
      return {
        data: [{ id: 'customer-2', name: 'Bob Owner', email: null, phone: null, address: null }],
        count: 60,
        error: null,
      }
    })

    const result = await listCustomers('org-1', { search: 'bob', page: 2, pageSize: 25 }, { db })
    expect(result).toEqual({
      ok: true,
      data: {
        data: [{ id: 'customer-2', name: 'Bob Owner', email: null, phone: null, address: null }],
        total: 60,
        page: 2,
        pageSize: 25,
      },
    })
  })

  it('normalizes create writes and maps duplicate conflicts', async () => {
    let insertPayload: unknown = null
    const db = createMockDb((state) => {
      if (state.table !== 'customers') throw new Error(`Unexpected table ${state.table}`)
      if (state.action === 'select') {
        return { data: [], error: null }
      }
      if (state.action === 'insert') {
        insertPayload = state.payload
        return {
          data: null,
          error: { code: '23505', message: 'duplicate key value violates unique constraint "customers_org_name_uniq"' },
        }
      }
      throw new Error(`Unexpected action ${state.action}`)
    })

    const result = await createCustomer(
      'org-1',
      {
        name: ' Taylor Jones ',
        email: ' TAYLOR@EXAMPLE.COM ',
        phone: ' 812-555-0100 ',
        street: ' 123 Main St ',
        city: ' Newburgh ',
        state: ' IN ',
        zip: ' 47630 ',
        notes: ' VIP ',
      },
      { db }
    )

    expect(insertPayload).toEqual({
      org_id: 'org-1',
      name: 'Taylor Jones',
      email: 'taylor@example.com',
      phone: '812-555-0100',
      street: '123 Main St',
      city: 'Newburgh',
      state: 'IN',
      zip: '47630',
      notes: 'VIP',
      address: '123 Main St, Newburgh, IN 47630',
    })
    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'A customer with the same name, email, or phone already exists.',
    })
    expect(serverLogWarn).toHaveBeenCalledWith(
      '[customers]',
      expect.objectContaining({
        event: 'customers.duplicate_conflict',
        operation: 'create',
        orgId: 'org-1',
      })
    )
  })

  it('blocks duplicate creates before insert when a matching customer already exists', async () => {
    const db = createMockDb((state) => {
      if (state.table !== 'customers') throw new Error(`Unexpected table ${state.table}`)
      if (state.action === 'select') {
        return {
          data: [{ id: 'customer-existing', name: 'Taylor Jones', email: 'taylor@example.com', phone: null }],
          error: null,
        }
      }
      if (state.action === 'insert') {
        throw new Error('createCustomer should not insert when an app-level duplicate is found')
      }
      throw new Error(`Unexpected action ${state.action}`)
    })

    const result = await createCustomer(
      'org-1',
      {
        name: ' Taylor Jones ',
        email: ' TAYLOR@example.com ',
        phone: null,
        street: null,
        city: null,
        state: null,
        zip: null,
        notes: null,
      },
      { db }
    )

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'A customer with the same name, email, or phone already exists.',
    })
    expect(serverLogWarn).toHaveBeenCalledWith(
      '[customers]',
      expect.objectContaining({
        event: 'customers.duplicate_blocked',
        operation: 'create',
        orgId: 'org-1',
        duplicateCustomerId: 'customer-existing',
      })
    )
  })

  it('returns not_found when a customer detail row is missing', async () => {
    const db = createMockDb(() => ({ data: null, error: null }))
    await expect(getCustomerDetail('org-1', 'customer-1', { db })).resolves.toEqual({
      ok: false,
      kind: 'not_found',
      message: 'Customer not found',
    })
  })

  it('warns when detail contains a malformed legacy address', async () => {
    const db = createMockDb(() => ({
      data: {
        id: 'customer-1',
        name: 'Taylor Jones',
        email: null,
        phone: null,
        address: '123 Main St Newburgh IN',
        street: null,
        city: null,
        state: null,
        zip: null,
        notes: null,
        created_at: null,
      },
      error: null,
    }))

    const result = await getCustomerDetail('org-1', 'customer-1', { db })
    expect(result.ok).toBe(true)
    expect(serverLogWarn).toHaveBeenCalledWith(
      '[customers]',
      expect.objectContaining({
        event: 'customers.legacy_address_cleanup_required',
        orgId: 'org-1',
        customerId: 'customer-1',
      })
    )
  })

  it('preserves legacy address fallback on update without clobbering notes', async () => {
    let updatePayload: unknown = null
    const db = createMockDb((state) => {
      if (state.table !== 'customers') throw new Error(`Unexpected table ${state.table}`)
      if (state.action === 'select') {
        return { data: [], error: null }
      }
      if (state.action === 'update') {
        updatePayload = state.payload
        return {
          data: {
            id: 'customer-1',
            name: 'Taylor Jones',
            email: null,
            phone: null,
            address: 'Legacy Address',
            street: null,
            city: null,
            state: null,
            zip: null,
            notes: 'Existing note',
            created_at: null,
          },
          error: null,
        }
      }
      throw new Error(`Unexpected action ${state.action}`)
    })

    const result = await updateCustomer(
      'org-1',
      'customer-1',
      {
        name: 'Taylor Jones',
        email: null,
        phone: null,
        street: null,
        city: null,
        state: null,
        zip: null,
        notes: null,
        notesProvided: false,
        legacyAddress: 'Legacy Address',
      },
      { db }
    )

    expect(updatePayload).toEqual({
      name: 'Taylor Jones',
      email: null,
      phone: null,
      street: null,
      city: null,
      state: null,
      zip: null,
      address: 'Legacy Address',
    })
    expect(result.ok).toBe(true)
  })

  it('blocks duplicate updates when another customer already uses the same identity', async () => {
    const db = createMockDb((state) => {
      if (state.table !== 'customers') throw new Error(`Unexpected table ${state.table}`)
      if (state.action === 'select') {
        return {
          data: [
            { id: 'customer-1', name: 'Original Name', email: 'original@example.com', phone: null },
            { id: 'customer-2', name: 'Taylor Jones', email: 'taylor@example.com', phone: null },
          ],
          error: null,
        }
      }
      if (state.action === 'update') {
        throw new Error('updateCustomer should not update when an app-level duplicate is found')
      }
      throw new Error(`Unexpected action ${state.action}`)
    })

    const result = await updateCustomer(
      'org-1',
      'customer-1',
      {
        name: 'Taylor Jones',
        email: 'taylor@example.com',
        phone: null,
        street: null,
        city: null,
        state: null,
        zip: null,
        notes: null,
        notesProvided: true,
        legacyAddress: null,
      },
      { db }
    )

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'A customer with the same name, email, or phone already exists.',
    })
    expect(serverLogWarn).toHaveBeenCalledWith(
      '[customers]',
      expect.objectContaining({
        event: 'customers.duplicate_blocked',
        operation: 'update',
        orgId: 'org-1',
        customerId: 'customer-1',
        duplicateCustomerId: 'customer-2',
      })
    )
  })

  it('applies production-safe delete error messages', async () => {
    const db = createMockDb(() => ({
      data: null,
      error: { message: 'fk violation on jobs_customer_id_fkey' },
    }))

    await expect(deleteCustomer('org-1', 'customer-1', { db, isProduction: false })).resolves.toEqual({
      ok: false,
      kind: 'server_error',
      message: 'fk violation on jobs_customer_id_fkey',
    })
    await expect(deleteCustomer('org-1', 'customer-1', { db, isProduction: true })).resolves.toEqual({
      ok: false,
      kind: 'server_error',
      message: 'Unable to delete customer',
    })
  })

  it('merges note and job timeline events', async () => {
    const db = createMockDb((state) => {
      if (state.table === 'customers') {
        return { data: { id: 'customer-1' }, error: null }
      }
      if (state.table === 'customer_timeline') {
        return {
          data: [{ id: 'note-1', type: 'note', title: 'Manual note', body: 'Called customer', created_at: '2026-04-21T08:00:00.000Z', created_by: 'user-1' }],
          error: null,
        }
      }
      if (state.table === 'jobs') {
        return {
          data: [{ id: 'job-1', title: 'Exterior repaint', status: 'scheduled', created_at: '2026-04-20T08:00:00.000Z', estimate_date: null, scheduled_date: '2026-04-22T09:00:00.000Z', completed_at: null }],
          error: null,
        }
      }
      if (state.table === 'job_schedules') {
        return {
          data: [{ job_id: 'job-1', start_at: '2026-04-22T09:00:00.000Z', end_at: '2026-04-22T17:00:00.000Z' }],
          error: null,
        }
      }
      throw new Error(`Unexpected table ${state.table}`)
    })

    const result = await listCustomerTimeline('org-1', 'customer-1', { db })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(3)
      expect(result.data[0]?.id).toBe('job-job-1-job_scheduled-2026-04-22T09:00:00.000Z')
      expect(result.data[1]?.id).toBe('note-1')
      expect(result.data[2]?.id).toBe('job-job-1-job_created-2026-04-20T08:00:00.000Z')
    }
  })

  it('logs timeline merge failures from job schedules', async () => {
    const db = createMockDb((state) => {
      if (state.table === 'customers') return { data: { id: 'customer-1' }, error: null }
      if (state.table === 'customer_timeline') return { data: [], error: null }
      if (state.table === 'jobs') {
        return {
          data: [{ id: 'job-1', title: 'Exterior repaint', status: 'scheduled', created_at: '2026-04-20T08:00:00.000Z', estimate_date: null, scheduled_date: '2026-04-22T09:00:00.000Z', completed_at: null }],
          error: null,
        }
      }
      if (state.table === 'job_schedules') {
        return { data: null, error: { message: 'schedule failure' } }
      }
      throw new Error(`Unexpected table ${state.table}`)
    })

    const result = await listCustomerTimeline('org-1', 'customer-1', { db })
    expect(result).toEqual({
      ok: false,
      kind: 'server_error',
      message: 'schedule failure',
    })
    expect(serverLogError).toHaveBeenCalledWith(
      '[customers]',
      expect.objectContaining({
        event: 'customers.timeline_job_schedules_failed',
        orgId: 'org-1',
        customerId: 'customer-1',
      })
    )
  })

  it('returns not_found when creating a note for a missing customer', async () => {
    const db = createMockDb(() => ({ data: null, error: null }))
    await expect(
      createCustomerTimelineNote(
        'org-1',
        'user-1',
        'customer-1',
        { body: 'Hello', type: 'note', title: null },
        { db }
      )
    ).resolves.toEqual({
      ok: false,
      kind: 'not_found',
      message: 'Customer not found',
    })
  })
})
