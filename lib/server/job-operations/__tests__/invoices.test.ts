import assert from 'node:assert/strict'
import { test } from 'vitest'
import {
  buildInvoiceDocument,
  normalizeInvoiceGenerateInput,
  normalizeInvoicePatchInput,
} from '../invoices.ts'
import type { AcceptedEstimateOperationalSource } from '@/types/job-operations/acceptedEstimateSource'

function source(): AcceptedEstimateOperationalSource {
  return {
    job: {
      id: 'job-1',
      title: 'Interior repaint',
      status: 'completed',
      customer_id: 'customer-1',
      linked_estimate_id: 'estimate-1',
    },
    customer: {
      id: 'customer-1',
      name: 'Taylor Homeowner',
      email: 'taylor@example.test',
      phone: '555-0100',
      address: '123 Main St',
    },
    acceptance: {
      accepted_at: '2026-05-01T10:00:00.000Z',
      accepted_by_legal_name: 'Taylor Homeowner',
      signature_type: 'typed',
      user_agent: null,
      ip: null,
      public_version_id: 'public-version-1',
      public_version_number: 2,
      public_token: 'token-1',
    },
    estimate: {
      id: 'estimate-1',
      version_name: 'Accepted quote',
      version_state: 'live',
      estimate_snapshot_id: 'snapshot-1',
    },
    publicDocumentSnapshot: {} as AcceptedEstimateOperationalSource['publicDocumentSnapshot'],
    internalEstimateSnapshot: {} as AcceptedEstimateOperationalSource['internalEstimateSnapshot'],
    rooms: [],
    scopes: {
      walls: [],
      ceilings: [],
      trim: [],
      doors: [],
      drywall: [],
      accessFees: [],
      prejob: [],
    },
    products: [],
    materials: {
      estimated_paint_gallons: 0,
      estimated_supplies_cost: 0,
      estimated_access_cost: 0,
      estimated_other_cost: 0,
      pricing_summary: {},
      wall_calculations: { scopes: [] },
      ceiling_calculations: { scopes: [] },
      trim_calculations: { scopes: [] },
      door_calculations: { scopes: [] },
      drywall_calculations: { scopes: [] },
    },
    totals: {
      accepted_total: 1000,
      final_total: 1000,
      pricing_summary: {},
      estimated_labor_hours: 24,
      estimated_paint_gallons: 6,
      estimated_supplies_cost: 80,
      estimated_access_cost: 0,
      estimated_other_cost: 0,
    },
    notes: [],
    source: {
      org_id: 'org-1',
      job_id: 'job-1',
      customer_id: 'customer-1',
      estimate_id: 'estimate-1',
      accepted_public_version_id: 'public-version-1',
      estimate_snapshot_id: 'snapshot-1',
    },
  }
}

test('normalizeInvoiceGenerateInput accepts camel and snake invoice fields', () => {
  const result = normalizeInvoiceGenerateInput({
    invoiceNumber: 'INV-100',
    payment_terms: 'Net 15',
    dueDate: '2026-05-30',
    creditTotal: 25,
    payment_total: 100,
    depositTotal: 50,
    taxRate: 0.0825,
  })

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.data.invoice_number, 'INV-100')
    assert.equal(result.data.payment_terms, 'Net 15')
    assert.equal(result.data.due_date, '2026-05-30')
    assert.equal(result.data.credit_total, 25)
    assert.equal(result.data.payment_total, 100)
    assert.equal(result.data.deposit_total, 50)
    assert.equal(result.data.tax_rate, 0.0825)
  }
})

test('normalizeInvoicePatchInput rejects invalid lifecycle values', () => {
  const result = normalizeInvoicePatchInput({ status: 'sent' })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.kind, 'invalid_input')
})

test('buildInvoiceDocument snapshots accepted estimate totals and accepted change orders', () => {
  const document = buildInvoiceDocument({
    source: source(),
    changeOrders: [
      {
        id: 'change-order-1',
        change_order_number: 'CO-1',
        title: 'Extra room',
        description: null,
        delta_total: 200,
        accepted_at: '2026-05-05T10:00:00.000Z',
      },
    ],
    input: {
      invoice_number: 'INV-100',
      payment_terms: 'Due on receipt',
      due_date: '2026-05-30',
      memo: 'Thank you.',
      credit_total: 25,
      payment_total: 100,
      deposit_total: 50,
      tax_rate: 0.1,
      tax_total: null,
    },
    revisionNumber: 1,
    status: 'draft',
    generatedAt: '2026-05-10T12:00:00.000Z',
  })

  assert.equal(document.kind, 'job_invoice')
  assert.equal(document.source.source_kind, 'accepted_estimate_invoice')
  assert.deepEqual(document.source.accepted_change_order_ids, ['change-order-1'])
  assert.equal(document.totals.accepted_quote_total, 1000)
  assert.equal(document.totals.accepted_change_order_total, 200)
  assert.equal(document.totals.taxable_subtotal, 1200)
  assert.equal(document.totals.tax_total, 120)
  assert.equal(document.totals.invoice_total, 1320)
  assert.equal(document.totals.balance_due, 1145)
  assert.equal(document.notes.memo, 'Thank you.')
})
