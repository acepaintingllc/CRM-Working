import assert from 'node:assert/strict'
import test from 'node:test'
import { assembleCustomerEstimateDocument } from '../../customer-estimates/assemble'
import {
  buildCustomerEstimateDocument,
  type CustomerEstimateInput,
} from '../../customer-estimates/build'
import { validateCustomerSendReadiness } from '../readiness'

function createInput(overrides: Partial<CustomerEstimateInput> = {}): CustomerEstimateInput {
  return {
    estimate: {
      id: 'EST-1',
      version_name: 'Kitchen Quote',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-20T12:00:00Z',
      ...(overrides.estimate ?? {}),
    },
    job: {
      customer_name: 'Taylor Jones',
      customer_email: 'taylor@example.com',
      customer_address: '123 Main St',
      estimate_date: '2026-04-20',
      ...(overrides.job ?? {}),
    },
    customer: {
      name: 'Taylor Jones',
      email: 'taylor@example.com',
      phone: '812-555-0100',
      address: '123 Main St\nNewburgh, IN 47630',
      street: '123 Main St',
      city: 'Newburgh',
      state: 'IN',
      zip: '47630',
      ...((overrides.customer as Record<string, unknown>) ?? {}),
    },
    company: {
      business_name: 'ACE Painting',
      timezone: 'America/Chicago',
      main_phone: '812-228-8803',
      business_email: 'hello@acepainting.test',
      address: '',
      website: '',
      sender_signature: '',
      logo_url: '',
      ...(overrides.company ?? {}),
    },
    inputs: {
      rooms: [],
      room_wall_scopes: [],
      room_ceiling_scopes: [],
      room_trim_scopes: [],
      room_door_scopes: [],
      drywall_repairs: [],
      trim_items: [],
      other: [],
      ...(overrides.inputs ?? {}),
    },
    settings: {
      quote_validity_days: 30,
      terms_text: '',
      ...(overrides.settings ?? {}),
    },
    pricingSummary: {
      finalTotal: 1200,
      ...(overrides.pricingSummary ?? {}),
    },
    overrides: overrides.overrides,
    publicMeta: overrides.publicMeta,
    catalogs: overrides.catalogs,
  }
}

function createReadinessResult(overrides: Partial<CustomerEstimateInput> = {}) {
  const input = createInput(overrides)
  const document = assembleCustomerEstimateDocument(buildCustomerEstimateDocument(input))
  return validateCustomerSendReadiness({
    estimate: input.estimate,
    job: input.job,
    customer: input.customer ?? null,
    company: input.company,
    inputs: input.inputs,
    catalogs: input.catalogs ?? null,
    settings: input.settings,
    pricingSummary: input.pricingSummary ?? null,
    document,
  })
}

test('validateCustomerSendReadiness reuses assembled placeholder warnings', () => {
  const readiness = createReadinessResult({
    company: {
      business_name: '',
      timezone: 'America/Chicago',
      main_phone: '812-228-8803',
      business_email: 'hello@acepainting.test',
      address: '',
      website: '',
      sender_signature: '',
      logo_url: '',
    },
    settings: {
      quote_validity_days: 30,
      terms_text: '',
    },
  })

  assert.equal(readiness.readyToSend, true)
  assert.deepEqual(
    readiness.warnings.map((issue) => issue.code),
    [
      'document_company_placeholders',
      'document_payment_placeholders',
      'document_legal_placeholders',
    ]
  )
})

test('validateCustomerSendReadiness warns when company name is missing', () => {
  const readiness = createReadinessResult({
    company: {
      business_name: '',
      timezone: 'America/Chicago',
      main_phone: '812-228-8803',
      business_email: 'hello@acepainting.test',
      address: '',
      website: '',
      sender_signature: '',
      logo_url: '',
    },
    settings: {
      quote_validity_days: 30,
      terms_text: 'Configured terms.',
    },
  })

  assert.equal(readiness.readyToSend, true)
  assert.deepEqual(readiness.blockers, [])
  assert.deepEqual(
    readiness.warnings.map((issue) => issue.message),
    ['Company name is missing.']
  )
})

test('validateCustomerSendReadiness blocks when both company contact methods are missing', () => {
  const readiness = createReadinessResult({
    company: {
      business_name: 'ACE Painting',
      timezone: 'America/Chicago',
      main_phone: '',
      business_email: '',
      address: '',
      website: '',
      sender_signature: '',
      logo_url: '',
    },
    settings: {
      quote_validity_days: 30,
      terms_text: 'Configured terms.',
    },
  })

  assert.equal(readiness.readyToSend, false)
  assert.ok(
    readiness.blockers.some(
      (issue) => issue.code === 'missing_company_contact_methods'
    )
  )
})

test('validateCustomerSendReadiness warns when one company contact method is missing', () => {
  const readiness = createReadinessResult({
    company: {
      business_name: 'ACE Painting',
      timezone: 'America/Chicago',
      main_phone: '',
      business_email: 'hello@acepainting.test',
      address: '',
      website: '',
      sender_signature: '',
      logo_url: '',
    },
    settings: {
      quote_validity_days: 30,
      terms_text: 'Configured terms.',
    },
  })

  assert.equal(readiness.readyToSend, true)
  assert.deepEqual(readiness.blockers, [])
  assert.ok(
    readiness.warnings.some(
      (issue) => issue.code === 'document_company_placeholders'
    )
  )
})

test('validateCustomerSendReadiness blocks when customer name is missing', () => {
  const readiness = createReadinessResult({
    customer: {
      name: '',
      email: 'taylor@example.com',
      phone: '812-555-0100',
      address: '123 Main St\nNewburgh, IN 47630',
      street: '123 Main St',
      city: 'Newburgh',
      state: 'IN',
      zip: '47630',
    },
    job: {
      customer_name: '',
      customer_email: 'taylor@example.com',
      customer_address: '123 Main St',
      estimate_date: '2026-04-20',
    },
    settings: {
      quote_validity_days: 30,
      terms_text: 'Configured terms.',
    },
  })

  assert.ok(
    readiness.blockers.some((issue) => issue.code === 'missing_customer_name')
  )
})

test('validateCustomerSendReadiness blocks when customer email is missing', () => {
  const readiness = createReadinessResult({
    customer: {
      name: 'Taylor Jones',
      email: '',
      phone: '812-555-0100',
      address: '123 Main St\nNewburgh, IN 47630',
      street: '123 Main St',
      city: 'Newburgh',
      state: 'IN',
      zip: '47630',
    },
    job: {
      customer_name: 'Taylor Jones',
      customer_email: '',
      customer_address: '123 Main St',
      estimate_date: '2026-04-20',
    },
    settings: {
      quote_validity_days: 30,
      terms_text: 'Configured terms.',
    },
  })

  assert.ok(
    readiness.blockers.some((issue) => issue.code === 'missing_customer_email')
  )
})

test('validateCustomerSendReadiness warns when payment terms still use placeholders', () => {
  const readiness = createReadinessResult({
    settings: {
      quote_validity_days: 30,
      terms_text: '',
    },
  })

  assert.ok(
    readiness.warnings.some((issue) => issue.code === 'document_payment_placeholders')
  )
})

test('validateCustomerSendReadiness warns when legal terms still use placeholders', () => {
  const readiness = createReadinessResult({
    settings: {
      quote_validity_days: 30,
      terms_text: '',
    },
  })

  assert.ok(
    readiness.warnings.some((issue) => issue.code === 'document_legal_placeholders')
  )
})

test('validateCustomerSendReadiness blocks zero-total documents without included scope', () => {
  const readiness = createReadinessResult({
    pricingSummary: {
      finalTotal: 0,
    },
    settings: {
      quote_validity_days: 30,
      terms_text: 'Configured terms.',
    },
  })

  assert.equal(readiness.readyToSend, false)
  assert.deepEqual(
    readiness.blockers.map((issue) => issue.code),
    ['document_total_non_positive']
  )
})

test('validateCustomerSendReadiness blocks zero-total documents with included work', () => {
  const readiness = createReadinessResult({
    inputs: {
      rooms: [{ room_id: 'R001', room_name: 'Kitchen' }],
      room_wall_scopes: [
        {
          room_id: 'R001',
          include: 'Y',
          effective_total: 0,
          paint_coats: 2,
          paint_product_id: 'wall-paint',
          paint_product_label: 'Gallery Series',
          notes: '',
          walls_prep_override: '',
          scope_notes: '',
        },
      ],
      room_ceiling_scopes: [],
      room_trim_scopes: [],
      room_door_scopes: [],
      drywall_repairs: [],
      trim_items: [],
      other: [],
    },
    pricingSummary: {
      finalTotal: 0,
    },
  })

  assert.equal(readiness.readyToSend, false)
  assert.deepEqual(
    readiness.blockers.map((issue) => issue.code),
    ['document_total_non_positive', 'pricing_incomplete_zero_total']
  )
})
