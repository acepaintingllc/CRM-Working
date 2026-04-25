import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockServerGetSessionUserOrg,
  mockListCustomers,
  mockGetCustomerDetail,
  mockCreateCustomer,
  mockUpdateCustomer,
  mockDeleteCustomer,
  mockListCustomerTimeline,
  mockCreateCustomerTimelineNote,
} = vi.hoisted(() => ({
  mockServerGetSessionUserOrg: vi.fn(),
  mockListCustomers: vi.fn(),
  mockGetCustomerDetail: vi.fn(),
  mockCreateCustomer: vi.fn(),
  mockUpdateCustomer: vi.fn(),
  mockDeleteCustomer: vi.fn(),
  mockListCustomerTimeline: vi.fn(),
  mockCreateCustomerTimelineNote: vi.fn(),
}))

vi.mock('@/lib/server/org', () => ({
  getSessionUserOrg: mockServerGetSessionUserOrg,
}))

vi.mock('@/lib/customers/service', () => ({
  listCustomers: (...args: unknown[]) => mockListCustomers(...args),
  getCustomerDetail: (...args: unknown[]) => mockGetCustomerDetail(...args),
  createCustomer: (...args: unknown[]) => mockCreateCustomer(...args),
  updateCustomer: (...args: unknown[]) => mockUpdateCustomer(...args),
  deleteCustomer: (...args: unknown[]) => mockDeleteCustomer(...args),
  listCustomerTimeline: (...args: unknown[]) => mockListCustomerTimeline(...args),
  createCustomerTimelineNote: (...args: unknown[]) => mockCreateCustomerTimelineNote(...args),
}))

import { GET as listCustomersRoute, POST as createCustomerRoute } from '../route'
import { DELETE as deleteCustomerRoute, GET as getCustomerRoute, PATCH as updateCustomerRoute } from '../[id]/route'
import { GET as getTimelineRoute, POST as createTimelineRoute } from '../[id]/timeline/route'

function jsonRequest(method: string, body: unknown) {
  return new Request(`http://localhost/${method.toLowerCase()}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('customer route adapters', () => {
  beforeEach(() => {
    mockServerGetSessionUserOrg.mockReset()
    mockListCustomers.mockReset()
    mockGetCustomerDetail.mockReset()
    mockCreateCustomer.mockReset()
    mockUpdateCustomer.mockReset()
    mockDeleteCustomer.mockReset()
    mockListCustomerTimeline.mockReset()
    mockCreateCustomerTimelineNote.mockReset()
    mockServerGetSessionUserOrg.mockResolvedValue({ orgId: 'org-1', userId: 'user-1' })
  })

  it('returns the first paginated customer page by default', async () => {
    mockListCustomers.mockResolvedValue({
      ok: true,
      data: {
        data: [{ id: 'customer-1', name: 'Taylor Jones', email: null, phone: null, address: null }],
        total: 73,
        page: 1,
        pageSize: 50,
      },
    })

    const response = await listCustomersRoute(new Request('http://localhost/api/customers'))

    await expect(response.json()).resolves.toEqual({
      data: {
        data: [{ id: 'customer-1', name: 'Taylor Jones', email: null, phone: null, address: null }],
        total: 73,
        page: 1,
        pageSize: 50,
      },
    })
    expect(mockListCustomers).toHaveBeenCalledWith('org-1', {
      search: '',
      page: 1,
      pageSize: 50,
    })
  })

  it('passes search and page params to the list service', async () => {
    mockListCustomers.mockResolvedValue({
      ok: true,
      data: {
        data: [{ id: 'customer-2', name: 'Bob Owner', email: null, phone: null, address: null }],
        total: 3,
        page: 2,
        pageSize: 25,
      },
    })

    const response = await listCustomersRoute(
      new Request('http://localhost/api/customers?search=bob&page=2&pageSize=25')
    )

    await expect(response.json()).resolves.toEqual({
      data: {
        data: [{ id: 'customer-2', name: 'Bob Owner', email: null, phone: null, address: null }],
        total: 3,
        page: 2,
        pageSize: 25,
      },
    })
    expect(mockListCustomers).toHaveBeenCalledWith('org-1', {
      search: 'bob',
      page: 2,
      pageSize: 25,
    })
  })

  it('normalizes invalid pagination params before reaching the service', async () => {
    mockListCustomers.mockResolvedValue({
      ok: true,
      data: { data: [], total: 0, page: 1, pageSize: 50 },
    })

    await listCustomersRoute(new Request('http://localhost/api/customers?page=0&pageSize=999'))

    expect(mockListCustomers).toHaveBeenCalledWith('org-1', {
      search: '',
      page: 1,
      pageSize: 50,
    })
  })

  it('keeps the detail success envelope stable', async () => {
    mockGetCustomerDetail.mockResolvedValue({
      ok: true,
      data: {
        id: 'customer-1',
        name: 'Taylor Jones',
        email: null,
        phone: null,
        address: null,
        street: null,
        city: null,
        state: null,
        zip: null,
        notes: null,
        created_at: null,
      },
    })

    const detailResponse = await getCustomerRoute(new Request('http://localhost/customer'), {
      params: { id: 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d' },
    })

    await expect(detailResponse.json()).resolves.toEqual({
      data: {
        id: 'customer-1',
        name: 'Taylor Jones',
        email: null,
        phone: null,
        address: null,
        street: null,
        city: null,
        state: null,
        zip: null,
        notes: null,
        created_at: null,
      },
    })
  })

  it('keeps mutation and timeline envelopes stable', async () => {
    mockCreateCustomer.mockResolvedValue({
      ok: true,
      data: {
        id: 'customer-1',
        name: 'Taylor Jones',
        email: null,
        phone: null,
        address: null,
        street: null,
        city: null,
        state: null,
        zip: null,
        notes: null,
        created_at: null,
      },
    })
    mockUpdateCustomer.mockResolvedValue({
      ok: true,
      data: {
        id: 'customer-1',
        name: 'Taylor Jones',
        email: null,
        phone: null,
        address: null,
        street: null,
        city: null,
        state: null,
        zip: null,
        notes: null,
        created_at: null,
      },
    })
    mockDeleteCustomer.mockResolvedValue({ ok: true, data: null })
    mockListCustomerTimeline.mockResolvedValue({
      ok: true,
      data: [{ id: 'event-1', type: 'note', title: null, body: 'Hello', created_at: null, created_by: null, link_path: null, link_label: null }],
    })
    mockCreateCustomerTimelineNote.mockResolvedValue({
      ok: true,
      data: { id: 'event-1', type: 'note', title: null, body: 'Hello', created_at: null, created_by: null, link_path: null, link_label: null },
    })

    const createResponse = await createCustomerRoute(jsonRequest('POST', { name: 'Taylor Jones' }))
    const updateResponse = await updateCustomerRoute(jsonRequest('PATCH', { name: 'Taylor Jones' }), {
      params: { id: 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d' },
    })
    const deleteResponse = await deleteCustomerRoute(new Request('http://localhost/customer', { method: 'DELETE' }), {
      params: { id: 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d' },
    })
    const timelineResponse = await getTimelineRoute(new Request('http://localhost/customer/timeline'), {
      params: { id: 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d' },
    })
    const addNoteResponse = await createTimelineRoute(jsonRequest('POST', { body: 'Hello' }), {
      params: { id: 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d' },
    })

    await expect(createResponse.json()).resolves.toEqual({
      data: expect.objectContaining({ id: 'customer-1' }),
      notice: 'Customer created.',
    })
    await expect(updateResponse.json()).resolves.toEqual({
      data: expect.objectContaining({ id: 'customer-1' }),
      notice: 'Customer updated.',
    })
    await expect(deleteResponse.json()).resolves.toEqual({
      data: true,
      notice: 'Customer deleted.',
    })
    await expect(timelineResponse.json()).resolves.toEqual({
      data: [expect.objectContaining({ id: 'event-1' })],
    })
    await expect(addNoteResponse.json()).resolves.toEqual({
      data: expect.objectContaining({ id: 'event-1' }),
      notice: 'Timeline note saved.',
    })
  })

  it('maps service conflict and not-found errors to stable statuses and messages', async () => {
    mockCreateCustomer.mockResolvedValue({
      ok: false,
      kind: 'conflict',
      message: 'A customer with the same name, email, or phone already exists.',
    })
    mockDeleteCustomer.mockResolvedValue({
      ok: false,
      kind: 'not_found',
      message: 'Customer not found',
    })

    const createResponse = await createCustomerRoute(jsonRequest('POST', { name: 'Taylor Jones' }))
    const deleteResponse = await deleteCustomerRoute(new Request('http://localhost/customer', { method: 'DELETE' }), {
      params: { id: 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d' },
    })

    expect(createResponse.status).toBe(409)
    expect(deleteResponse.status).toBe(404)
    await expect(createResponse.json()).resolves.toEqual({
      error: 'A customer with the same name, email, or phone already exists.',
    })
    await expect(deleteResponse.json()).resolves.toEqual({ error: 'Customer not found' })
  })

  it('maps update conflicts and dev/prod delete errors to stable statuses and messages', async () => {
    mockUpdateCustomer.mockResolvedValue({
      ok: false,
      kind: 'conflict',
      message: 'A customer with the same name, email, or phone already exists.',
    })
    mockDeleteCustomer
      .mockResolvedValueOnce({
        ok: false,
        kind: 'server_error',
        message: 'fk violation on jobs_customer_id_fkey',
      })
      .mockResolvedValueOnce({
        ok: false,
        kind: 'server_error',
        message: 'Unable to delete customer',
      })

    const updateResponse = await updateCustomerRoute(jsonRequest('PATCH', { name: 'Taylor Jones' }), {
      params: { id: 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d' },
    })

    vi.stubEnv('NODE_ENV', 'development')
    const deleteDevResponse = await deleteCustomerRoute(
      new Request('http://localhost/customer', { method: 'DELETE' }),
      { params: { id: 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d' } }
    )
    vi.stubEnv('NODE_ENV', 'production')
    const deleteProdResponse = await deleteCustomerRoute(
      new Request('http://localhost/customer', { method: 'DELETE' }),
      { params: { id: 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d' } }
    )
    vi.unstubAllEnvs()

    expect(updateResponse.status).toBe(409)
    expect(deleteDevResponse.status).toBe(500)
    expect(deleteProdResponse.status).toBe(500)
    await expect(updateResponse.json()).resolves.toEqual({
      error: 'A customer with the same name, email, or phone already exists.',
    })
    await expect(deleteDevResponse.json()).resolves.toEqual({
      error: 'fk violation on jobs_customer_id_fkey',
    })
    await expect(deleteProdResponse.json()).resolves.toEqual({
      error: 'Unable to delete customer',
    })
  })

  it('rejects invalid customer ids across CRUD and timeline routes before reaching the service layer', async () => {
    const context = { params: { id: 'not-a-uuid' } }

    const getResponse = await getCustomerRoute(new Request('http://localhost/customer'), context)
    const patchResponse = await updateCustomerRoute(jsonRequest('PATCH', { name: 'Taylor Jones' }), context)
    const deleteResponse = await deleteCustomerRoute(new Request('http://localhost/customer', { method: 'DELETE' }), context)
    const timelineResponse = await getTimelineRoute(new Request('http://localhost/customer/timeline'), context)

    expect(getResponse.status).toBe(400)
    expect(patchResponse.status).toBe(400)
    expect(deleteResponse.status).toBe(400)
    expect(timelineResponse.status).toBe(400)
    expect(mockGetCustomerDetail).not.toHaveBeenCalled()
    expect(mockUpdateCustomer).not.toHaveBeenCalled()
    expect(mockDeleteCustomer).not.toHaveBeenCalled()
    expect(mockListCustomerTimeline).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed timeline note bodies before reaching the service layer', async () => {
    const response = await createTimelineRoute(
      new Request('http://localhost/customer/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{bad json',
      }),
      { params: { id: 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d' } }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body.' })
    expect(mockCreateCustomerTimelineNote).not.toHaveBeenCalled()
  })

  it('returns body parser errors for malformed create and update payloads', async () => {
    const createResponse = await createCustomerRoute(
      new Request('http://localhost/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{bad json',
      })
    )
    const updateResponse = await updateCustomerRoute(
      new Request('http://localhost/customer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: '{bad json',
      }),
      { params: { id: 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d' } }
    )

    expect(createResponse.status).toBe(400)
    expect(updateResponse.status).toBe(400)
    await expect(createResponse.json()).resolves.toEqual({ error: 'Invalid JSON body.' })
    await expect(updateResponse.json()).resolves.toEqual({ error: 'Invalid JSON body.' })
    expect(mockCreateCustomer).not.toHaveBeenCalled()
    expect(mockUpdateCustomer).not.toHaveBeenCalled()
  })

  it('returns 415 for wrong content type and 413 for oversized bodies', async () => {
    const wrongTypeResponse = await createCustomerRoute(
      new Request('http://localhost/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ name: 'Taylor Jones' }),
      })
    )

    const oversizedResponse = await createCustomerRoute(
      new Request('http://localhost/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(70 * 1024),
        },
        body: JSON.stringify({ name: 'Taylor Jones' }),
      })
    )

    expect(wrongTypeResponse.status).toBe(415)
    expect(oversizedResponse.status).toBe(413)
    await expect(wrongTypeResponse.json()).resolves.toEqual({
      error: 'Expected application/json body.',
    })
    await expect(oversizedResponse.json()).resolves.toEqual({
      error: 'Request body too large.',
    })
  })

  it('returns auth failures from the shared session guard', async () => {
    mockServerGetSessionUserOrg.mockResolvedValue({ error: 'Not authenticated' })

    const response = await listCustomersRoute(new Request('http://localhost/api/customers'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Not authenticated' })
    expect(mockListCustomers).not.toHaveBeenCalled()
  })

  it('returns forbidden session failures from the shared session guard', async () => {
    mockServerGetSessionUserOrg.mockResolvedValue({ error: 'Org access denied' })

    const response = await listCustomersRoute(new Request('http://localhost/api/customers'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Org access denied' })
    expect(mockListCustomers).not.toHaveBeenCalled()
  })
})
