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
  assert.equal(document.total, 1190.9)
  assert.equal(document.scopes.length, 1)
  assert.equal(document.scopes[0]?.key, 'trim')
  assert.doesNotMatch(document.scopes.find((section) => section.key === 'trim')?.text ?? '', /Trim White/)
  assert.match(document.scopes.find((section) => section.key === 'trim')?.text ?? '', /, using SW Trim Paint/i)
  assert.match(document.scopes.find((section) => section.key === 'trim')?.text ?? '', /full prime/i)
  assert.doesNotMatch(document.scopes.find((section) => section.key === 'trim')?.text ?? '', /TRIM-WHITE|TRIM-1|R001|[0-9a-f]{8}-[0-9a-f-]{27,}/i)
  assert.equal(document.quote_rows.length, 1)
  assert.equal(document.quote_rows[0]?.label, 'Trim')
  assert.doesNotMatch(document.quote_rows[0]?.description ?? '', /Trim White/)
  assert.match(document.quote_rows[0]?.description ?? '', /, using SW Trim Paint/i)
  assert.match(document.quote_rows[0]?.description ?? '', /full prime/i)
  assert.doesNotMatch(document.quote_rows[0]?.description ?? '', /\$\d|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/i)
  assert.equal(document.quote_rows[0]?.price, 1190.9)
  assert.deepEqual(document.terms, ['Terms line one.', 'Terms line two.'])
  assert.equal(document.source_meta.company.business_name, true)
  assert.equal(document.source_meta.company.main_phone, false)
  assert.equal(document.source_meta.settings.quote_validity_days, true)
  assert.equal(document.source_meta.settings.terms_text, true)
  assert.equal(document.source_meta.overrides.deposit_language, false)
  assert.equal(document.source_meta.overrides.card_fee_note, false)
})

test('buildCustomerEstimateDocument pulls V2 room trim scopes into customer quote copy', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-TRIM-SCOPE',
      version_name: 'Trim Scope Quote',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-20T12:00:00Z',
    },
    job: {
      customer_name: 'Taylor Jones',
      customer_address: '123 Main St',
      estimate_date: 'April 20, 2026',
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
      room_trim_scopes: [
        {
          id: 'scope-1',
          room_id: 'R001',
          scope_name: 'Baseboards',
          trim_type_id: 'TRIM-BASE',
          trim_family: 'baseboard',
          paint_product_id: 'P-TRIM',
          effective_total: 180,
          paint_coats: 2,
          prime_mode: 'FULL',
        },
      ],
      trim_items: [],
      other: [],
      jobsettings: { trim_paint_id: 'P-TRIM' },
    },
    catalogs: {
      paint_products: [{ id: 'P-TRIM', display_name: 'SW Emerald Urethane', display_id: 'TRIM-PAINT' }],
      trim_items: [{ id: 'TRIM-BASE', label: 'Baseboards', family: 'baseboard' }],
    },
    pricingSummary: {
      finalTotal: 180,
    },
  })

  assert.equal(document.scopes.length, 1)
  assert.equal(document.scopes[0]?.key, 'trim')
  assert.match(document.scopes[0]?.text ?? '', /Living Room/)
  assert.match(document.scopes[0]?.text ?? '', /SW Emerald Urethane/)
  assert.doesNotMatch(document.scopes[0]?.text ?? '', /Baseboards|Crown|Chair Rail/i)
  assert.equal(document.quote_rows[0]?.label, 'Trim')
  assert.equal(document.quote_rows[0]?.price, 180)
})

test('buildCustomerEstimateDocument pulls V2 room door scopes into customer quote copy', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-DOOR-SCOPE',
      version_name: 'Door Scope Quote',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-20T12:00:00Z',
    },
    job: {
      customer_name: 'Taylor Jones',
      customer_address: '123 Main St',
      estimate_date: 'April 20, 2026',
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
      room_door_scopes: [
        {
          id: 'door-scope-1',
          room_id: 'R001',
          include: 'Y',
          scope_name: 'Hall Door',
          door_type_id: 'DOOR_PANEL',
          paint_product_id: 'P-TRIM',
          effective_total: 240,
          paint_coats: 2,
          prime_mode: 'SPOT',
          notes: 'sand chipped edge',
        },
        {
          id: 'door-scope-excluded',
          room_id: 'R001',
          include: 'N',
          scope_name: 'Closet Door',
          door_type_id: 'DOOR_PANEL',
          paint_product_id: 'P-TRIM',
          effective_total: 999,
        },
      ],
      trim_items: [],
      other: [],
      jobsettings: { trim_paint_id: 'P-TRIM' },
    },
    catalogs: {
      paint_products: [{ id: 'P-TRIM', display_name: 'SW Emerald Urethane', display_id: 'TRIM-PAINT' }],
      trim_items: [],
      door_types: [{ id: 'DOOR_PANEL', label: 'Panel Door' }],
    },
    pricingSummary: {
      finalTotal: 240,
    },
  })

  assert.equal(document.scopes.length, 1)
  assert.equal(document.scopes[0]?.key, 'doors')
  assert.match(document.scopes[0]?.text ?? '', /Living Room/)
  assert.match(document.scopes[0]?.text ?? '', /Panel Door/)
  assert.match(document.scopes[0]?.text ?? '', /SW Emerald Urethane/)
  assert.match(document.scopes[0]?.text ?? '', /spot prime/i)
  assert.match(document.scopes[0]?.text ?? '', /sand chipped edge/i)
  assert.doesNotMatch(document.scopes[0]?.text ?? '', /Closet Door|door-scope-1|R001/i)
  assert.equal(document.quote_rows[0]?.label, 'Doors')
  assert.equal(document.quote_rows[0]?.price, 240)
})

test('buildCustomerEstimateDocument degrades unknown V2 door rates into safe customer copy', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-DOOR-MISSING-RATE',
      version_name: 'Door Missing Rate Quote',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-20T12:00:00Z',
    },
    job: {
      customer_name: 'Taylor Jones',
      customer_address: '123 Main St',
      estimate_date: 'April 20, 2026',
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
      rooms: [{ room_id: 'R002', room_name: 'Hallway' }],
      room_wall_scopes: [],
      room_ceiling_scopes: [],
      room_trim_scopes: [],
      room_door_scopes: [
        {
          id: 'door-scope-unknown',
          room_id: 'R002',
          include: 'Y',
          door_type_id: 'DOOR_ARCHIVED',
          paint_product_id: 'P-TRIM',
          effective_total: 180,
          paint_coats: 2,
        },
      ],
      trim_items: [],
      other: [],
    },
    catalogs: {
      paint_products: [{ id: 'P-TRIM', display_name: 'SW Emerald Urethane', display_id: 'TRIM-PAINT' }],
      trim_items: [],
      door_types: [],
    },
    pricingSummary: {
      finalTotal: 180,
    },
  })

  assert.equal(document.scopes[0]?.key, 'doors')
  assert.match(document.scopes[0]?.text ?? '', /Hallway/)
  assert.match(document.scopes[0]?.text ?? '', /Door Archived/)
  assert.doesNotMatch(document.scopes[0]?.text ?? '', /DOOR_ARCHIVED|door-scope-unknown|R002/)
  assert.equal(document.quote_rows[0]?.price, 180)
})

test('buildCustomerEstimateDocument keeps unclassified V2 trim scopes in the trim quote section', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-TRIM-RAIL',
      version_name: 'Trim Scope Quote',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-20T12:00:00Z',
    },
    job: {
      customer_name: 'Taylor Jones',
      customer_address: '123 Main St',
      estimate_date: 'April 20, 2026',
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
      room_trim_scopes: [
        {
          id: 'scope-rail',
          room_id: 'R001',
          scope_name: 'Chair Rail',
          trim_type_id: 'TRIM-RAIL',
          trim_family: 'rail',
          paint_product_id: 'P-TRIM',
          effective_total: 95,
          paint_coats: 2,
        },
      ],
      trim_items: [],
      other: [],
      jobsettings: { trim_paint_id: 'P-TRIM' },
    },
    catalogs: {
      paint_products: [{ id: 'P-TRIM', display_name: 'SW Emerald Urethane', display_id: 'TRIM-PAINT' }],
      trim_items: [{ id: 'TRIM-RAIL', label: 'Chair Rail', family: 'rail' }],
    },
    pricingSummary: {
      finalTotal: 95,
    },
  })

  assert.equal(document.scopes.length, 1)
  assert.equal(document.scopes[0]?.key, 'trim')
  assert.doesNotMatch(document.scopes[0]?.text ?? '', /Chair Rail|Baseboards|Crown/i)
  assert.equal(document.quote_rows[0]?.label, 'Trim')
  assert.equal(document.quote_rows[0]?.price, 95)
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

  assert.equal(document.total, 4361.26)
  assert.equal(document.quote_rows.length, 2)
  assert.match(document.quote_rows[0]?.description ?? '', /in Master Bedroom and Spare Bedroom, using SW Emerald Urethane/i)
  assert.match(document.quote_rows[0]?.description ?? '', /full prime/i)
  assert.match(document.quote_rows[1]?.description ?? '', /, using SW Ceiling Paint/i)
  assert.match(document.quote_rows[1]?.description ?? '', /Prep, spot prime as needed, and paint/i)
  assert.doesNotMatch(document.quote_rows[1]?.description ?? '', /with spot prime/i)
  assert.doesNotMatch(document.quote_rows[0]?.description ?? '', /\$\d|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/i)
  assert.doesNotMatch(document.quote_rows[1]?.description ?? '', /\$\d|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/i)
  const quoteRowTotal = document.quote_rows.reduce((sum, row) => sum + row.price, 0)
  assert.equal(quoteRowTotal, 4361.26)
})

test('buildCustomerEstimateDocument rolls hidden prejob cost into visible rows without a separate row', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-PREJOB',
      version_name: 'Prejob Hidden Quote',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-20T12:00:00Z',
    },
    job: {
      customer_name: 'Taylor Jones',
      customer_address: '123 Main St',
      estimate_date: '2026-04-20',
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
          id: 'W-PREJOB',
          room_id: 'R001',
          include: 'Y',
          scope_name: 'Walls',
          effective_total: 1000,
          paint_coats: 2,
          paint_product_id: 'P-WALL',
          prime_mode: 'NONE',
        },
      ],
      room_ceiling_scopes: [],
      room_trim_scopes: [],
      trim_items: [],
      prejob: [
        {
          id: 'PREJOB-1',
          room_id: 'R001',
          trip_name: 'Wallpaper removal prep',
          trip_num: 2,
          trip_rate: 75,
          manual_adjustment: 25,
          effective_total: 175,
          notes: 'Complete before paint start',
        },
      ],
      other: [],
    },
    catalogs: {
      paint_products: [{ id: 'P-WALL', display_name: 'SW Emerald', display_id: 'WALL-PAINT' }],
      trim_items: [],
    },
    pricingSummary: {
      finalTotal: 1175,
      prepTripCost: 175,
    },
  })

  assert.equal(document.total, 1175)
  assert.equal(document.scopes.find((section) => section.key === 'walls')?.price, 1175)
  assert.equal(document.quote_rows.length, 1)
  assert.equal(document.quote_rows[0]?.label, 'Walls')
  assert.equal(document.quote_rows[0]?.price, 1175)
  assert.equal(
    Math.round(document.quote_rows.reduce((sum, row) => sum + row.price, 0) * 100) / 100,
    document.total
  )
  const visibleText = [
    ...document.quote_rows.map((row) => `${row.label} ${row.description}`),
    ...document.scopes.map((section) => `${section.key} ${section.text}`),
  ].join('\n')
  assert.doesNotMatch(visibleText, /prejob|prep trip|wallpaper removal prep/i)
})

test('buildCustomerEstimateDocument allocates room prejob cost to drywall repairs first', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-PREJOB-DRYWALL',
      version_name: 'Prejob Drywall Quote',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-20T12:00:00Z',
    },
    job: {
      customer_name: 'Taylor Jones',
      customer_address: '123 Main St',
      estimate_date: '2026-04-20',
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
          id: 'W-PREJOB-DRYWALL',
          room_id: 'R001',
          include: 'Y',
          scope_name: 'Walls',
          effective_total: 1000,
          paint_coats: 2,
          paint_product_id: 'P-WALL',
        },
      ],
      room_ceiling_scopes: [],
      room_trim_scopes: [],
      drywall_repairs: [
        {
          id: 'D-PREJOB',
          room_id: 'R001',
          include: 'Y',
          repair_type: 'patch',
          surface: 'ceiling',
          unit: 'EA',
          quantity: 2,
          effective_total: 200,
        },
      ],
      trim_items: [],
      prejob: [
        {
          id: 'PREJOB-DRYWALL',
          room_id: 'R001',
          trip_name: 'Drywall prep trip',
          trip_num: 1,
          trip_rate: 150,
          effective_total: 150,
        },
      ],
      other: [],
    },
    catalogs: {
      paint_products: [{ id: 'P-WALL', display_name: 'SW Emerald', display_id: 'WALL-PAINT' }],
      trim_items: [],
    },
    pricingSummary: {
      finalTotal: 1350,
      prepTripCost: 150,
    },
  })

  assert.equal(document.total, 1350)
  assert.equal(document.scopes.find((section) => section.key === 'walls')?.price, 1000)
  assert.equal(document.scopes.find((section) => section.key === 'drywall')?.price, 350)
  assert.equal(document.quote_rows.find((row) => row.key === 'walls')?.price, 1000)
  assert.equal(document.quote_rows.find((row) => row.key === 'drywall')?.price, 350)
  assert.equal(
    Math.round(document.quote_rows.reduce((sum, row) => sum + row.price, 0) * 100) / 100,
    document.total
  )
  assert.doesNotMatch(
    document.quote_rows.map((row) => `${row.label} ${row.description}`).join('\n'),
    /prejob|prep trip|drywall prep trip/i
  )
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
  assert.match(document.quote_rows[1]?.description ?? '', /Prep, spot prime as needed, and paint/i)
  assert.doesNotMatch(document.quote_rows[1]?.description ?? '', /with spot prime/i)
})

test('buildCustomerEstimateDocument falls back to org default paint products for walls and ceilings', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-3A',
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
        },
      ],
      room_trim_scopes: [],
      trim_items: [],
      other: [],
      jobsettings: {},
      org_defaults: {
        walls_paint_id: 'WALL-DEFAULT',
        ceiling_paint_id: 'CEIL-DEFAULT',
      },
    },
    catalogs: {
      paint_products: [
        { id: 'WALL-DEFAULT', display_name: 'SW Cashmere Low Lustre', display_id: 'WALL-D' },
        { id: 'CEIL-DEFAULT', display_name: 'SW Premium Ceiling Paint', display_id: 'CEIL-D' },
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
  assert.match(document.quote_rows[0]?.description ?? '', /using SW Cashmere Low Lustre/)
  assert.match(document.quote_rows[1]?.description ?? '', /using SW Premium Ceiling Paint/)
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

test('buildCustomerEstimateDocument owns business composition and emits only built document fields', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-6',
      version_name: 'Exterior Quote',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-20T12:00:00Z',
    },
    job: {
      customer_name: 'Jordan Customer',
      customer_address: '456 Customer Ave',
      estimate_date: '2026-04-20',
    },
    customer: {
      name: 'Jordan Customer',
      email: 'jordan@example.com',
      phone: '555-0100',
      address: '456 Customer Ave\nLeland, IN 46052',
      street: '456 Customer Ave',
      city: 'Leland',
      state: 'IN',
      zip: '46052',
    },
    company: {
      business_name: 'ACE Painting',
      timezone: 'America/Chicago',
      main_phone: '111-111-1111',
      business_email: 'hello@ace.com',
      address: '',
      website: '',
      sender_signature: '',
      logo_url: '',
    },
    inputs: {
      rooms: [{ room_id: 'R001', room_name: 'Exterior' }],
      room_wall_scopes: [
        {
          id: 'W-1',
          room_id: 'R001',
          include: 'Y',
          effective_total: 900,
          paint_coats: 2,
          paint_product_id: 'P-WALL',
          prime_mode: 'FULL',
          notes: 'special prep',
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
      paint_products: [{ id: 'P-WALL', display_name: 'Duration Exterior', display_id: 'EXT-1' }],
      trim_items: [],
    },
    settings: {
      quote_validity_days: 45,
      terms_text: '',
    },
    overrides: {
      title: 'Exterior Quote',
      deposit_language: 'Half down to schedule.',
      card_fee_note: 'Cards add 3%.',
    },
    pricingSummary: {
      finalTotal: 900,
    },
  })

  assert.equal('header' in document, false)
  assert.equal('pricing_block' in document, false)
  assert.equal('terms_page' in document, false)
  assert.equal('assembly_meta' in document, false)
  assert.equal(document.meta.title, 'Exterior Quote')
  assert.equal(document.quote_validity_days, 45)
  assert.equal(document.deposit_language, 'Half down to schedule.')
  assert.equal(document.card_fee_note, 'Cards add 3%.')
  assert.equal(document.source_meta.overrides.title, true)
  assert.equal(document.source_meta.overrides.deposit_language, true)
  assert.equal(document.source_meta.overrides.card_fee_note, true)
  assert.match(document.quote_rows[0]?.description ?? '', /Duration Exterior/i)
})

test('buildCustomerEstimateDocument preserves mixed-scope output parity across decomposed stages', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-7',
      version_name: 'Whole House Quote',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-21T12:00:00Z',
    },
    job: {
      customer_name: 'Morgan Customer',
      customer_address: '987 Market St',
      estimate_date: '2026-04-21',
    },
    customer: {
      name: 'Morgan Customer',
      email: 'morgan@example.com',
      phone: '555-0123',
      address: '987 Market St\nEvansville, IN 47715',
      street: '987 Market St',
      city: 'Evansville',
      state: 'IN',
      zip: '47715',
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
        { room_id: 'R001', room_name: 'Kitchen' },
        { room_id: 'R002', room_name: 'Hall Bath' },
      ],
      room_wall_scopes: [
        {
          id: 'W-1',
          room_id: 'R001',
          include: 'Y',
          effective_total: 850,
          paint_coats: 2,
          paint_product_id: 'P-WALL',
          prime_mode: 'FULL',
          notes: 'special prep',
          walls_prep_override: '',
          scope_notes: '',
        },
      ],
      room_ceiling_scopes: [
        {
          id: 'C-1',
          room_id: 'R002',
          include: 'Y',
          effective_total: 225,
          paint_coats: 1,
          paint_product_id: 'P-CEIL',
          prime_mode: 'SPOT',
          notes: '',
          ceiling_prep_override: 'minor stain blocking',
          scope_notes: '',
        },
      ],
      room_trim_scopes: [],
      trim_items: [
        {
          id: 'T-1',
          room_id: 'R001',
          trim_menu_id: 'TRIM-BASE',
          paint_product_id: 'P-TRIM',
          coats: 2,
          raw_total: 175,
          prime_mode: 'FULL',
        },
        {
          id: 'T-2',
          room_id: 'R002',
          trim_menu_id: 'TRIM-DOOR',
          paint_product_id: 'P-TRIM',
          coats: 2,
          raw_total: 130,
          prime_mode: 'FULL',
        },
      ],
      access_fees: [
        {
          label: 'Ladder setup',
          access_fee_id: 'LADDER',
          qty: 2,
          catalog_amount: 75,
        },
      ],
      other: [
        {
          client_description: 'Wallpaper removal in upstairs hall',
          location: 'Hall Bath',
          qty: 1,
          uom: 'area',
          raw_total: 120,
        },
      ],
    },
    catalogs: {
      paint_products: [
        { id: 'P-WALL', display_name: 'SW Duration Home', display_id: 'WALL-1' },
        { id: 'P-CEIL', display_name: 'SW Ceiling Bright White', display_id: 'CEIL-1' },
        { id: 'P-TRIM', display_name: 'SW Emerald Urethane Trim', display_id: 'TRIM-1' },
      ],
      trim_items: [
        { id: 'TRIM-BASE', label: 'Baseboards', family: 'baseboard' },
        { id: 'TRIM-DOOR', label: 'Door and Frame', family: 'door casing' },
      ],
    },
    settings: {
      quote_validity_days: 30,
      terms_text: '',
    },
    pricingSummary: {
      finalTotal: 1650,
    },
  })

  assert.deepEqual(
    document.scopes.map((section) => section.key),
    ['walls', 'ceilings', 'trim', 'doors', 'other']
  )
  assert.match(document.scopes.find((section) => section.key === 'walls')?.text ?? '', /special prep/i)
  assert.match(document.scopes.find((section) => section.key === 'ceilings')?.text ?? '', /stain/i)
  assert.doesNotMatch(document.scopes.find((section) => section.key === 'trim')?.text ?? '', /Baseboards|Crown|Chair Rail/i)
  assert.match(document.scopes.find((section) => section.key === 'doors')?.text ?? '', /Door and Frame/i)
  assert.doesNotMatch(document.scopes.find((section) => section.key === 'other')?.text ?? '', /Ladder setup/i)
  assert.match(document.scopes.find((section) => section.key === 'other')?.text ?? '', /Wallpaper removal in upstairs hall in Hall Bath 1 area/)
  assert.equal(document.quote_rows.length, 5)
  assert.equal(document.quote_rows.reduce((sum, row) => sum + row.price, 0), 1650)
})

test('buildCustomerEstimateDocument allocates hidden access fees into visible rows', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-7-FIXED-ACCESS',
      version_name: 'Policy Adjusted Quote',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-21T12:00:00Z',
    },
    job: {
      customer_name: 'Morgan Customer',
      customer_address: '987 Market St',
      estimate_date: '2026-04-21',
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
      rooms: [{ room_id: 'R001', room_name: 'Kitchen' }],
      room_wall_scopes: [
        {
          room_id: 'R001',
          include: 'Y',
          effective_total: 100,
          paint_coats: 2,
          paint_product_id: 'P-WALL',
        },
      ],
      room_ceiling_scopes: [],
      room_trim_scopes: [],
      trim_items: [],
      access_fees: [
        {
          label: 'Ladder setup',
          access_fee_id: 'LADDER',
          qty: 1,
          catalog_amount: 75,
        },
      ],
      other: [],
    },
    catalogs: {
      paint_products: [{ id: 'P-WALL', display_name: 'SW Duration Home', display_id: 'WALL-1' }],
      trim_items: [],
    },
    pricingSummary: {
      finalTotal: 200,
    },
  })

  assert.equal(document.total, 200)
  assert.equal(document.scopes.find((section) => section.key === 'walls')?.price, 200)
  assert.equal(document.quote_rows.length, 1)
  assert.equal(document.quote_rows.find((row) => row.key === 'walls')?.price, 200)
  assert.equal(document.quote_rows.find((row) => row.key === 'other'), undefined)
  assert.equal(document.quote_rows.reduce((sum, row) => sum + row.price, 0), document.total)
  assert.doesNotMatch(
    document.quote_rows.map((row) => `${row.label} ${row.description}`).join('\n'),
    /Ladder setup|access fee/i
  )
})

test('buildCustomerEstimateDocument hides mixed access and prejob rows while reconciling scope totals', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-MIXED-HIDDEN-OPS',
      version_name: 'Mixed Hidden Ops Quote',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-21T12:00:00Z',
    },
    job: {
      customer_name: 'Morgan Customer',
      customer_address: '987 Market St',
      estimate_date: '2026-04-21',
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
      rooms: [{ room_id: 'R001', room_name: 'Kitchen' }],
      room_wall_scopes: [
        {
          id: 'W-MIXED-HIDDEN',
          room_id: 'R001',
          include: 'Y',
          scope_name: 'Walls',
          effective_total: 100,
          paint_coats: 2,
          paint_product_id: 'P-WALL',
        },
      ],
      room_ceiling_scopes: [],
      room_trim_scopes: [],
      trim_items: [],
      access_fees: [
        {
          id: 'ACCESS-HIDDEN',
          room_id: 'R001',
          label: 'Ladder setup',
          access_fee_id: 'LADDER',
          qty: 1,
          catalog_amount: 75,
          effective_total: 75,
        },
      ],
      prejob: [
        {
          id: 'PREJOB-HIDDEN',
          room_id: 'R001',
          trip_name: 'Wallpaper removal prep',
          trip_num: 1,
          trip_rate: 25,
          effective_total: 25,
        },
      ],
      other: [],
    },
    catalogs: {
      paint_products: [{ id: 'P-WALL', display_name: 'SW Duration Home', display_id: 'WALL-1' }],
      trim_items: [],
    },
    pricingSummary: {
      finalTotal: 200,
      sharedAccessCost: 75,
      prepTripCost: 25,
    },
  })

  assert.equal(document.total, 200)
  assert.deepEqual(
    document.quote_rows.map((row) => row.key),
    ['walls']
  )
  assert.equal(document.quote_rows[0]?.price, 200)
  assert.equal(document.quote_rows.reduce((sum, row) => sum + row.price, 0), document.total)
  assert.doesNotMatch(
    document.quote_rows.map((row) => `${row.label} ${row.description}`).join('\n'),
    /Ladder setup|access fee|Wallpaper removal prep|prejob|prep trip/i
  )
})

test('buildCustomerEstimateDocument allocates pricing policy adjustments into visible rows only', () => {
  const pricingSummary = {
    finalTotal: 600,
    prePolicyTotal: 400,
    postLaborPolicyTotal: 450,
    minimumAdjustmentAmount: 100,
  }
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-POLICY-HIDDEN',
      version_name: 'Policy Hidden Quote',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-21T12:00:00Z',
    },
    job: {
      customer_name: 'Morgan Customer',
      customer_address: '987 Market St',
      estimate_date: '2026-04-21',
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
        { room_id: 'R001', room_name: 'Kitchen' },
        { room_id: 'R002', room_name: 'Dining Room' },
      ],
      room_wall_scopes: [
        {
          room_id: 'R001',
          include: 'Y',
          effective_total: 100,
          paint_coats: 2,
          paint_product_id: 'P-WALL',
        },
      ],
      room_ceiling_scopes: [
        {
          room_id: 'R002',
          include: 'Y',
          effective_total: 300,
          paint_coats: 1,
          paint_product_id: 'P-CEIL',
        },
      ],
      room_trim_scopes: [],
      trim_items: [],
      other: [],
    },
    catalogs: {
      paint_products: [
        { id: 'P-WALL', display_name: 'SW Duration Home', display_id: 'WALL-1' },
        { id: 'P-CEIL', display_name: 'SW Ceiling Bright White', display_id: 'CEIL-1' },
      ],
      trim_items: [],
    },
    pricingSummary,
  })

  assert.equal(document.total, 600)
  assert.equal(document.scopes.find((section) => section.key === 'walls')?.price, 150)
  assert.equal(document.scopes.find((section) => section.key === 'ceilings')?.price, 450)
  assert.equal(document.quote_rows.length, 2)
  assert.equal(document.quote_rows.reduce((sum, row) => sum + row.price, 0), document.total)
  assert.deepEqual(pricingSummary, {
    finalTotal: 600,
    prePolicyTotal: 400,
    postLaborPolicyTotal: 450,
    minimumAdjustmentAmount: 100,
  })
  assert.doesNotMatch(
    document.quote_rows.map((row) => `${row.label} ${row.description}`).join('\n'),
    /minimum|rounding|manual adjustment|policy/i
  )
})

test('buildCustomerEstimateDocument keeps fractional mixed-scope rows reconciled to the exact quote total', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-7A',
      version_name: 'Fractional Whole House Quote',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-21T12:00:00Z',
    },
    job: {
      customer_name: 'Morgan Customer',
      customer_address: '987 Market St',
      estimate_date: '2026-04-21',
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
        { room_id: 'R001', room_name: 'Kitchen' },
        { room_id: 'R002', room_name: 'Hall Bath' },
      ],
      room_wall_scopes: [
        {
          room_id: 'R001',
          include: 'Y',
          effective_total: 929.8,
          paint_coats: 2,
          paint_product_id: 'P-WALL',
        },
      ],
      room_ceiling_scopes: [
        {
          room_id: 'R002',
          include: 'Y',
          effective_total: 168.1,
          paint_coats: 2,
          paint_product_id: 'P-CEIL',
        },
      ],
      room_trim_scopes: [],
      trim_items: [
        {
          room_id: 'R001',
          trim_menu_id: 'TRIM-BASE',
          paint_product_id: 'P-TRIM',
          coats: 2,
          raw_total: 60.35,
        },
      ],
      other: [
        {
          client_description: 'Wallpaper removal',
          location: 'Hall Bath',
          qty: 1,
          raw_total: 41,
        },
      ],
    },
    catalogs: {
      paint_products: [
        { id: 'P-WALL', display_name: 'SW Duration Home', display_id: 'WALL-1' },
        { id: 'P-CEIL', display_name: 'SW Ceiling Bright White', display_id: 'CEIL-1' },
        { id: 'P-TRIM', display_name: 'SW Emerald Urethane Trim', display_id: 'TRIM-1' },
      ],
      trim_items: [{ id: 'TRIM-BASE', label: 'Baseboards', family: 'baseboard' }],
    },
    pricingSummary: {
      finalTotal: 1199.25,
    },
  })

  assert.equal(document.total, 1199.25)
  assert.equal(document.quote_rows.length, 4)
  assert.equal(
    Math.round(document.quote_rows.reduce((sum, row) => sum + row.price, 0) * 100) / 100,
    document.total
  )
})

test('buildCustomerEstimateDocument degrades missing settings and empty sections without broken output', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-8',
      version_name: 'Sparse Quote',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-20T12:00:00Z',
    },
    job: {
      customer_name: 'Casey Customer',
      customer_address: '123 Main St',
      estimate_date: '',
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
      rooms: [{ room_id: 'R001', room_name: 'Kitchen' }],
      room_wall_scopes: [
        {
          room_id: 'R001',
          include: 'N',
          effective_total: 900,
          paint_coats: 2,
          paint_product_id: 'P-WALL',
        },
      ],
      room_ceiling_scopes: [],
      room_trim_scopes: [],
      trim_items: [],
      other: [],
    },
    pricingSummary: {
      finalTotal: null,
    },
  })

  assert.equal(document.quote_validity_days, 90)
  assert.equal(document.scopes.length, 0)
  assert.equal(document.quote_rows.length, 0)
  assert.equal(document.total, 0)
  assert.equal(document.terms.length > 0, true)
  assert.equal(document.source_meta.settings.quote_validity_days, false)
  assert.equal(document.source_meta.settings.terms_text, false)
})

test('buildCustomerEstimateDocument normalizes malformed room and product labels into safe customer copy', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-9',
      version_name: 'Fallback Labels',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-20T12:00:00Z',
    },
    job: {
      customer_name: 'Taylor Jones',
      customer_address: '123 Main St',
      estimate_date: '2026-04-20',
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
      rooms: [{ room_id: 'R002', room_name: '0123456789abcdef0123' }],
      room_wall_scopes: [
        {
          room_id: 'R002',
          include: 'Y',
          effective_total: 320,
          paint_coats: 2,
          paint_product_label: '4fab71cc-37d5-4570-a432-aa0bcc0eb2c6',
          prime_mode: 'FULL',
        },
      ],
      room_ceiling_scopes: [],
      room_trim_scopes: [],
      trim_items: [],
      other: [],
      jobsettings: {
        walls_paint_id: 'P-WALL',
      },
    },
    catalogs: {
      paint_products: [{ id: 'P-WALL', display_name: 'SW SuperPaint', display_id: 'SP-1' }],
      trim_items: [],
    },
    pricingSummary: {
      finalTotal: 320,
    },
  })

  assert.match(document.scopes[0]?.text ?? '', /Room 2/)
  assert.match(document.scopes[0]?.text ?? '', /SW SuperPaint/)
  assert.doesNotMatch(document.scopes[0]?.text ?? '', /0123456789abcdef0123|4fab71cc-37d5-4570-a432-aa0bcc0eb2c6/i)
})

test('buildCustomerEstimateDocument skips malformed zero-priced mixed scope rows while preserving valid sections', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-10',
      version_name: 'Mixed Scope',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-20T12:00:00Z',
    },
    job: {
      customer_name: 'Morgan Customer',
      customer_address: '987 Market St',
      estimate_date: '2026-04-21',
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
        { room_id: 'R001', room_name: 'Kitchen' },
        { room_id: 'R002', room_name: 'Hall Bath' },
      ],
      room_wall_scopes: [
        {
          room_id: 'R001',
          include: 'Y',
          effective_total: 850,
          paint_coats: 2,
          paint_product_id: 'P-WALL',
          prime_mode: 'FULL',
        },
        {
          room_id: 'R002',
          include: 'Y',
          effective_total: 'bad',
          paint_product_id: 'P-WALL',
        },
      ],
      room_ceiling_scopes: [],
      room_trim_scopes: [],
      trim_items: [
        {
          room_id: 'R002',
          trim_menu_id: 'TRIM-DOOR',
          paint_product_id: 'P-TRIM',
          coats: 2,
          raw_total: 130,
          prime_mode: 'FULL',
        },
        {
          room_id: 'R002',
          trim_menu_id: 'TRIM-BASE',
          paint_product_id: 'P-TRIM',
          coats: 2,
          raw_total: 'oops',
          prime_mode: 'FULL',
        },
      ],
      other: [{ client_description: '', location: '', qty: '', raw_total: 40 }],
    },
    catalogs: {
      paint_products: [
        { id: 'P-WALL', display_name: 'SW Duration Home', display_id: 'WALL-1' },
        { id: 'P-TRIM', display_name: 'SW Emerald Urethane Trim', display_id: 'TRIM-1' },
      ],
      trim_items: [
        { id: 'TRIM-BASE', label: 'Baseboards', family: 'baseboard' },
        { id: 'TRIM-DOOR', label: 'Door and Frame', family: 'door casing' },
      ],
    },
    pricingSummary: {
      finalTotal: 1020,
    },
  })

  assert.deepEqual(
    document.scopes.map((section) => section.key),
    ['walls', 'doors', 'other']
  )
  assert.equal(document.quote_rows.reduce((sum, row) => sum + row.price, 0), 1020)
  assert.equal(document.scopes.find((section) => section.key === 'other')?.text, 'Additional work 1')
})
