import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCustomerEstimateDocument, type CustomerEstimateInput } from '../build.ts'
import { buildDefaultTermsText, splitTermsText } from '../presets.ts'

test('splitTermsText keeps paragraph breaks and drops empties', () => {
  assert.deepEqual(splitTermsText('One\n\nTwo\n\n\nThree'), ['One', 'Two', 'Three'])
})

test('buildDefaultTermsText produces a fixed terms structure', () => {
  const text = buildDefaultTermsText({
    quoteValidityDays: 14,
    estimateDate: 'April 20, 2026',
    depositLanguage: 'A deposit may be required.',
    cardFeeNote: 'Credit card payments are subject to a processing fee.',
  })
  assert.match(text, /valid for 14 days/i)
  assert.match(text, /A deposit may be required\./)
  assert.match(text, /processing fee/i)
})

test('buildCustomerEstimateDocument cleans scope copy and keeps only included sections', () => {
  const input: CustomerEstimateInput = {
    estimate: {
      id: 'EST-1',
      version_name: 'V2 Internal',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-20T12:00:00Z',
    },
    job: {
      customer_name: 'Taylor Jones',
      customer_address: '123 Main St',
      estimate_date: 'April 20, 2026',
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
    },
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
    inputs: {
      rooms: [{ room_id: 'R001', room_name: 'Living Room' }],
      room_wall_scopes: [],
      room_ceiling_scopes: [],
      room_trim_scopes: [],
      trim_items: [
        {
          id: 'TRIM-1',
          room_id: 'R001',
          trim_menu_id: 'TRIM-WHITE',
          trim_menu_label: '',
          paint_product_id: 'P-TRIM',
          qty: 1,
          prime_mode: 'FULL',
          raw_total: 125,
        },
      ],
      other: [],
    },
    catalogs: {
      paint_products: [{ id: 'P-TRIM', display_name: 'SW Trim Paint', display_id: 'TRIM-PAINT' }],
      trim_items: [{ id: 'TRIM-WHITE', label: 'Trim White', family: 'baseboard' }],
    },
    settings: {
      quote_validity_days: 30,
      terms_text: 'Terms line one.\n\nTerms line two.',
    },
    pricingSummary: {
      finalTotal: 1190.9,
    },
  }
  const document = buildCustomerEstimateDocument(input)

  assert.equal(document.meta.quote_date, '4/20/2026')
  assert.equal(document.meta.flow_version, 'v2')
  assert.equal(document.customer.name, 'Taylor Jones')
  assert.match(document.customer.address, /Newburgh, IN 47630/)
  assert.equal(document.total, 1191)
  assert.equal(document.scopes.length, 1)
  assert.equal(document.scopes[0]?.key, 'trim')
  assert.match(document.scopes.find((section) => section.key === 'trim')?.text ?? '', /Trim White/)
  assert.match(document.scopes.find((section) => section.key === 'trim')?.text ?? '', /, using SW Trim Paint/i)
  assert.match(document.scopes.find((section) => section.key === 'trim')?.text ?? '', /full prime/i)
  assert.doesNotMatch(document.scopes.find((section) => section.key === 'trim')?.text ?? '', /TRIM-WHITE|TRIM-1|R001|[0-9a-f]{8}-[0-9a-f-]{27,}/i)
  assert.equal(document.quote_rows.length, 1)
  assert.equal(document.quote_rows[0]?.label, 'Trim')
  assert.match(document.quote_rows[0]?.description ?? '', /Trim White/)
  assert.match(document.quote_rows[0]?.description ?? '', /, using SW Trim Paint/i)
  assert.match(document.quote_rows[0]?.description ?? '', /full prime/i)
  assert.doesNotMatch(document.quote_rows[0]?.description ?? '', /\$\d|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/i)
  assert.equal(document.quote_rows[0]?.price, 1191)
  assert.deepEqual(document.terms, ['Terms line one.', 'Terms line two.'])
  assert.equal(document.source_meta.company.business_name, true)
  assert.equal(document.source_meta.company.main_phone, false)
  assert.equal(document.source_meta.settings.quote_validity_days, true)
  assert.equal(document.source_meta.settings.terms_text, true)
  assert.equal(document.source_meta.overrides.deposit_language, false)
  assert.equal(document.source_meta.overrides.card_fee_note, false)
})

test('buildCustomerEstimateDocument reconciles visible rows to the internal final total', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-2',
      version_name: 'V2 Internal',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-20T12:00:00Z',
    },
    job: {
      customer_name: 'Rob & Kelley Gustafson',
      customer_address: '1101 Suwannee dr\nEvansville, IN 47725',
      estimate_date: '2026-04-14',
    },
    customer: {
      name: 'Rob & Kelley Gustafson',
      email: 'rob@example.com',
      phone: '812-555-0100',
      address: '1101 Suwannee dr\nEvansville, IN 47725',
      street: '1101 Suwannee dr',
      city: 'Evansville',
      state: 'IN',
      zip: '47725',
    },
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
    inputs: {
      rooms: [
        { room_id: 'R001', room_name: 'Master Bedroom' },
        { room_id: 'R002', room_name: 'Spare Bedroom' },
      ],
      room_wall_scopes: [
        {
          id: 'W-1',
          room_id: 'R001',
          include: 'Y',
          scope_name: 'Walls',
          effective_total: 929.8,
          paint_coats: 2,
          paint_product_id: 'P-WALL',
          paint_product_label: 'AA459213',
          prime_mode: 'FULL',
          notes: '',
          walls_prep_override: '',
          scope_notes: '',
        },
        {
          id: 'W-2',
          room_id: 'R002',
          include: 'Y',
          scope_name: 'Walls',
          effective_total: 120.25,
          paint_coats: 2,
          paint_product_id: 'P-WALL',
          paint_product_label: 'AA459213',
          prime_mode: 'FULL',
          notes: '',
          walls_prep_override: '',
          scope_notes: '',
        },
      ],
      room_ceiling_scopes: [
        {
          id: 'C-1',
          room_id: 'R002',
          include: 'Y',
          scope_name: 'Ceilings',
          effective_total: 168,
          paint_coats: 2,
          paint_product_id: 'P-CEIL',
          paint_product_label: 'CEIL-202',
          prime_mode: 'SPOT',
          notes: '',
          ceiling_prep_override: '',
          scope_notes: '',
        },
      ],
      room_trim_scopes: [],
      trim_items: [],
      other: [],
    },
    catalogs: {
      paint_products: [
        { id: 'P-WALL', display_name: 'SW Emerald Urethane', display_id: 'AA459213' },
        { id: 'P-CEIL', display_name: 'SW Ceiling Paint', display_id: 'CEIL-202' },
      ],
      trim_items: [],
    },
    settings: {
      quote_validity_days: 30,
      terms_text: '',
    },
    pricingSummary: {
      finalTotal: 4361.26,
    },
  })

  assert.equal(document.total, 4361)
  assert.equal(document.quote_rows.length, 2)
  assert.match(document.quote_rows[0]?.description ?? '', /in Master Bedroom and Spare Bedroom, using SW Emerald Urethane/i)
  assert.match(document.quote_rows[0]?.description ?? '', /full prime/i)
  assert.match(document.quote_rows[1]?.description ?? '', /, using SW Ceiling Paint/i)
  assert.match(document.quote_rows[1]?.description ?? '', /spot prime/i)
  assert.doesNotMatch(document.quote_rows[0]?.description ?? '', /\$\d|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/i)
  assert.doesNotMatch(document.quote_rows[1]?.description ?? '', /\$\d|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/i)
  const quoteRowTotal = document.quote_rows.reduce((sum, row) => sum + row.price, 0)
  assert.equal(quoteRowTotal, 4361)
})

test('buildCustomerEstimateDocument falls back to jobsettings paint products for walls and ceilings', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-3',
      version_name: 'V2 Internal',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-20T12:00:00Z',
    },
    job: {
      customer_name: 'Taylor Jones',
      customer_address: '123 Main St',
      estimate_date: '2026-04-20',
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
    },
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
    inputs: {
      rooms: [{ room_id: 'R001', room_name: 'Living Room' }],
      room_wall_scopes: [
        {
          id: 'W-1',
          room_id: 'R001',
          include: 'Y',
          scope_name: 'Walls',
          effective_total: 300,
          paint_coats: 2,
          prime_mode: 'FULL',
          notes: '',
        },
      ],
      room_ceiling_scopes: [
        {
          id: 'C-1',
          room_id: 'R001',
          include: 'Y',
          scope_name: 'Ceilings',
          effective_total: 255,
          paint_coats: 2,
          prime_mode: 'SPOT',
          notes: '',
        },
      ],
      room_trim_scopes: [],
      trim_items: [],
      other: [],
      jobsettings: {
        walls_paint_id: 'WALL-PAINT',
        ceiling_paint_id: 'CEIL-PAINT',
      },
    },
    catalogs: {
      paint_products: [
        { id: 'WALL-PAINT', display_name: 'SW Superpaint Interior', display_id: 'WALL-1' },
        { id: 'CEIL-PAINT', display_name: 'SW ProMar Ceiling White', display_id: 'CEIL-1' },
      ],
      trim_items: [],
    },
    settings: {
      quote_validity_days: 30,
      terms_text: '',
    },
    pricingSummary: {
      finalTotal: 555,
    },
  })

  assert.equal(document.quote_rows.length, 2)
  assert.match(document.quote_rows[0]?.description ?? '', /using SW Superpaint Interior/)
  assert.match(document.quote_rows[0]?.description ?? '', /full prime/i)
  assert.match(document.quote_rows[1]?.description ?? '', /using SW ProMar Ceiling White/)
  assert.match(document.quote_rows[1]?.description ?? '', /spot prime/i)
})

test('buildCustomerEstimateDocument resolves paint labels from display ids when necessary', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-3B',
      version_name: 'V2 Internal',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-20T12:00:00Z',
    },
    job: {
      customer_name: 'Taylor Jones',
      customer_address: '123 Main St',
      estimate_date: '2026-04-20',
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
    },
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
    inputs: {
      rooms: [{ room_id: 'R001', room_name: 'Living Room' }],
      room_wall_scopes: [
        {
          id: 'W-1',
          room_id: 'R001',
          include: 'Y',
          scope_name: 'Walls',
          effective_total: 555,
          paint_coats: 2,
          paint_product_id: 'PAINT-DISPLAY-ID',
          prime_mode: 'FULL',
          notes: '',
          walls_prep_override: '',
          scope_notes: '',
        },
      ],
      room_ceiling_scopes: [],
      room_trim_scopes: [],
      trim_items: [],
      other: [],
    },
    catalogs: {
      paint_products: [
        {
          id: 'PAINT-INTERNAL-ID',
          display_name: 'SW Superpaint',
          display_id: 'PAINT-DISPLAY-ID',
        },
      ],
      trim_items: [],
    },
    settings: {
      quote_validity_days: 30,
      terms_text: '',
    },
    pricingSummary: {
      finalTotal: 555,
    },
  })

  assert.match(document.quote_rows[0]?.description ?? '', /using SW Superpaint/i)
  assert.match(document.scopes[0]?.text ?? '', /using SW Superpaint/i)
})

test('buildCustomerEstimateDocument preserves manual scope wording overrides exactly', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-4',
      version_name: 'V2 Internal',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-20T12:00:00Z',
    },
    job: {
      customer_name: 'Taylor Jones',
      customer_address: '123 Main St',
      estimate_date: '2026-04-20',
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
    },
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
    inputs: {
      rooms: [{ room_id: 'R001', room_name: 'Living Room' }],
      room_wall_scopes: [
        {
          id: 'W-1',
          room_id: 'R001',
          include: 'Y',
          scope_name: 'Walls',
          effective_total: 250,
          paint_coats: 2,
          paint_product_id: 'P-WALL',
          paint_product_label: 'AA459213',
          prime_mode: 'FULL',
          notes: '',
          walls_prep_override: '',
          scope_notes: '',
        },
      ],
      room_ceiling_scopes: [],
      room_trim_scopes: [],
      trim_items: [],
      other: [],
    },
    catalogs: {
      paint_products: [{ id: 'P-WALL', display_name: 'SW Emerald Urethane', display_id: 'AA459213' }],
      trim_items: [],
    },
    settings: {
      quote_validity_days: 30,
      terms_text: '',
    },
    overrides: {
      scope_text_edits: {
        walls: 'Paint walls in Living Room, prep included',
        ceilings: '',
        trim: '',
        doors: '',
        cabinets: '',
        other: '',
      },
    },
    pricingSummary: {
      finalTotal: 250,
    },
  })

  assert.equal(document.quote_rows.length, 1)
  assert.equal(document.quote_rows[0]?.description, 'Paint walls in Living Room, prep included')
  assert.equal(document.scopes[0]?.text, 'Paint walls in Living Room, prep included')
  assert.equal(document.source_meta.overrides.deposit_language, false)
  assert.equal(document.source_meta.overrides.card_fee_note, false)
})

test('buildCustomerEstimateDocument tracks explicit payment overrides in source metadata', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-5',
      version_name: 'Kitchen Quote',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-20T12:00:00Z',
    },
    job: {
      customer_name: 'Taylor Jones',
      customer_address: '123 Main St',
      estimate_date: '2026-04-20',
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
    },
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
    inputs: {
      rooms: [],
      room_wall_scopes: [],
      room_ceiling_scopes: [],
      room_trim_scopes: [],
      trim_items: [],
      other: [],
    },
    settings: {
      quote_validity_days: 30,
      terms_text: '',
    },
    overrides: {
      deposit_language: 'Half down to schedule.',
      card_fee_note: 'Cards add a 3% fee.',
    },
    pricingSummary: {
      finalTotal: 0,
    },
  })

  assert.equal(document.source_meta.overrides.deposit_language, true)
  assert.equal(document.source_meta.overrides.card_fee_note, true)
})
