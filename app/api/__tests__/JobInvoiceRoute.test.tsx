import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireSessionUserOrg,
  mockResolveParams,
  mockReadUuidParam,
  mockLoadJobInvoice,
  mockNormalizeInvoiceGenerateInput,
  mockNormalizeInvoicePatchInput,
  mockGenerateJobInvoice,
  mockPatchJobInvoice,
  mockSendJobInvoice,
  mockVoidJobInvoice,
} = vi.hoisted(() => ({
  mockRequireSessionUserOrg: vi.fn(),
  mockResolveParams: vi.fn(),
  mockReadUuidParam: vi.fn(),
  mockLoadJobInvoice: vi.fn(),
  mockNormalizeInvoiceGenerateInput: vi.fn(),
  mockNormalizeInvoicePatchInput: vi.fn(),
  mockGenerateJobInvoice: vi.fn(),
  mockPatchJobInvoice: vi.fn(),
  mockSendJobInvoice: vi.fn(),
  mockVoidJobInvoice: vi.fn(),
}))

vi.mock('@/lib/server/apiRoute', async () => ({
  requireSessionUserOrg: mockRequireSessionUserOrg,
  resolveParams: mockResolveParams,
  readUuidParam: mockReadUuidParam,
  jsonError: (error: string, status: number) =>
    new Response(JSON.stringify({ error }), { status }),
  readJsonBody: async (request: Request) => {
    try {
      const text = await request.text()
      return { ok: true as const, value: text ? JSON.parse(text) as Record<string, unknown> : null }
    } catch {
      return {
        ok: false as const,
        response: new Response(JSON.stringify({ error: 'Invalid JSON body.' }), { status: 400 }),
      }
    }
  },
}))

vi.mock('@/lib/server/job-operations/invoices', () => ({
  loadJobInvoice: mockLoadJobInvoice,
  normalizeInvoiceGenerateInput: mockNormalizeInvoiceGenerateInput,
  normalizeInvoicePatchInput: mockNormalizeInvoicePatchInput,
  generateJobInvoice: mockGenerateJobInvoice,
  patchJobInvoice: mockPatchJobInvoice,
  sendJobInvoice: mockSendJobInvoice,
  voidJobInvoice: mockVoidJobInvoice,
}))

import { GET, PATCH } from '../jobs/[id]/invoice/route'
import { POST as GENERATE } from '../jobs/[id]/invoice/generate/route'
import { POST as SEND } from '../jobs/[id]/invoice/send/route'
import { POST as VOID } from '../jobs/[id]/invoice/void/route'

const invoice = {
  id: 'invoice-1',
  job_id: 'job-1',
  revision_number: 1,
  status: 'draft',
  invoice_number: 'INV-1',
  balance_due: 1200,
}

describe('job invoice routes', () => {
  beforeEach(() => {
    mockRequireSessionUserOrg.mockReset()
    mockResolveParams.mockReset()
    mockReadUuidParam.mockReset()
    mockLoadJobInvoice.mockReset()
    mockNormalizeInvoiceGenerateInput.mockReset()
    mockNormalizeInvoicePatchInput.mockReset()
    mockGenerateJobInvoice.mockReset()
    mockPatchJobInvoice.mockReset()
    mockSendJobInvoice.mockReset()
    mockVoidJobInvoice.mockReset()

    mockRequireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
    mockResolveParams.mockResolvedValue({ id: 'job-1' })
    mockReadUuidParam.mockReturnValue({ ok: true, value: 'job-1' })
    mockNormalizeInvoiceGenerateInput.mockReturnValue({
      ok: true,
      data: {
        invoice_number: null,
        payment_terms: 'Due on receipt',
        due_date: '2026-05-30',
        memo: null,
        credit_total: 0,
        payment_total: 0,
        deposit_total: 0,
        tax_rate: 0,
        tax_total: null,
      },
    })
    mockNormalizeInvoicePatchInput.mockReturnValue({
      ok: true,
      data: {
        payment_total: 1200,
        status: 'paid',
      },
    })
  })

  it('GET returns the current invoice in a data envelope', async () => {
    mockLoadJobInvoice.mockResolvedValue({ ok: true, data: { current: invoice } })

    const response = await GET(new Request('http://localhost/api/jobs/job-1/invoice'), {
      params: { id: 'job-1' },
    })

    expect(mockLoadJobInvoice).toHaveBeenCalledWith('org-1', 'job-1')
    await expect(response.json()).resolves.toEqual({ data: { current: invoice } })
  })

  it('POST generate normalizes input and delegates generation', async () => {
    mockGenerateJobInvoice.mockResolvedValue({ ok: true, data: invoice })

    const response = await GENERATE(
      new Request('http://localhost/api/jobs/job-1/invoice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentTerms: 'Due on receipt' }),
      }),
      { params: { id: 'job-1' } }
    )

    expect(mockGenerateJobInvoice).toHaveBeenCalledWith({
      orgId: 'org-1',
      jobId: 'job-1',
      userId: 'user-1',
      input: mockNormalizeInvoiceGenerateInput.mock.results[0].value.data,
    })
    await expect(response.json()).resolves.toEqual({
      data: invoice,
      notice: 'Invoice generated.',
    })
  })

  it('PATCH normalizes input and delegates invoice updates', async () => {
    mockPatchJobInvoice.mockResolvedValue({ ok: true, data: { ...invoice, status: 'paid', balance_due: 0 } })

    const response = await PATCH(
      new Request('http://localhost/api/jobs/job-1/invoice', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentTotal: 1200, status: 'paid' }),
      }),
      { params: { id: 'job-1' } }
    )

    expect(mockPatchJobInvoice).toHaveBeenCalledWith({
      orgId: 'org-1',
      jobId: 'job-1',
      userId: 'user-1',
      input: mockNormalizeInvoicePatchInput.mock.results[0].value.data,
    })
    await expect(response.json()).resolves.toEqual({
      data: { ...invoice, status: 'paid', balance_due: 0 },
      notice: 'Invoice updated.',
    })
  })

  it('POST send delegates the lifecycle transition', async () => {
    mockSendJobInvoice.mockResolvedValue({ ok: true, data: { ...invoice, status: 'sent' } })

    const response = await SEND(
      new Request('http://localhost/api/jobs/job-1/invoice/send', { method: 'POST' }),
      { params: { id: 'job-1' } }
    )

    expect(mockSendJobInvoice).toHaveBeenCalledWith({
      orgId: 'org-1',
      jobId: 'job-1',
      userId: 'user-1',
    })
    await expect(response.json()).resolves.toEqual({
      data: { ...invoice, status: 'sent' },
      notice: 'Invoice sent.',
    })
  })

  it('POST void delegates the lifecycle transition', async () => {
    mockVoidJobInvoice.mockResolvedValue({ ok: true, data: { ...invoice, status: 'void' } })

    const response = await VOID(
      new Request('http://localhost/api/jobs/job-1/invoice/void', { method: 'POST' }),
      { params: { id: 'job-1' } }
    )

    expect(mockVoidJobInvoice).toHaveBeenCalledWith({
      orgId: 'org-1',
      jobId: 'job-1',
      userId: 'user-1',
    })
    await expect(response.json()).resolves.toEqual({
      data: { ...invoice, status: 'void' },
      notice: 'Invoice voided.',
    })
  })

  it('authenticates before reading params or body', async () => {
    mockRequireSessionUserOrg.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await GENERATE(
      new Request('http://localhost/api/jobs/job-1/invoice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentTerms: 'Due on receipt' }),
      }),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(401)
    expect(mockResolveParams).not.toHaveBeenCalled()
    expect(mockNormalizeInvoiceGenerateInput).not.toHaveBeenCalled()
    expect(mockGenerateJobInvoice).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('maps service conflicts through the standard error envelope', async () => {
    mockSendJobInvoice.mockResolvedValue({
      ok: false,
      kind: 'conflict',
      message: 'Only draft invoices can be sent.',
    })

    const response = await SEND(
      new Request('http://localhost/api/jobs/job-1/invoice/send', { method: 'POST' }),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Only draft invoices can be sent.',
    })
  })
})
