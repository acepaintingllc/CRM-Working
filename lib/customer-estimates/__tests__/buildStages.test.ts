import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCustomerEstimateDocument } from '../build.ts'
import { assembleCustomerEstimateBuild } from '../documentAssembly.ts'
import { normalizeCustomerEstimateInput, paintNameMap, roomNameMap } from '../inputNormalization.ts'
import { extractScopeBuckets, trimCategory } from '../scopeExtraction.ts'
import { buildCustomerEstimateSections, finalizeScopeBuckets } from '../textGeneration.ts'

test('input normalization keeps the public builder contract while flattening stage inputs', () => {
  const normalized = normalizeCustomerEstimateInput({
    estimate: { id: 'EST-1' },
    job: { customer_name: 'Taylor Jones' },
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
      room_wall_scopes: [{ id: 'wall-1' }],
      room_ceiling_scopes: [{ id: 'ceiling-1' }],
      room_trim_scopes: [{ id: 'trim-1' }],
      trim_items: [{ id: 'trim-item-1' }],
      other: [{ id: 'other-1' }],
      jobsettings: { walls_paint_id: 'P-WALL' },
    },
    catalogs: {
      paint_products: [{ id: 'P-WALL', display_name: 'SW Wall Paint' }],
      trim_items: [{ id: 'TRIM-1', label: 'Baseboard', family: 'baseboard' }],
    },
    settings: { quote_validity_days: 30 },
    pricingSummary: { finalTotal: 1200 },
    overrides: { title: 'Kitchen Quote' },
    publicMeta: { status: 'sent' },
  })

  assert.equal(normalized.rooms[0]?.roomLabel, 'Kitchen')
  assert.equal(normalized.roomWallScopes[0]?.price, 0)
  assert.equal(normalized.jobsettings.wallPaintProductId, 'P-WALL')
  assert.equal(normalized.paintCatalogRows[0]?.label, 'SW Wall Paint')
  assert.equal(normalized.trimCatalogRows[0]?.label, 'Baseboard')
  assert.equal(normalized.overrides?.title, 'Kitchen Quote')
  assert.equal(normalized.publicMeta?.status, 'sent')
})

test('normalization lookup helpers resolve room and paint labels cleanly', () => {
  const rooms = roomNameMap([
    { roomId: 'R001', roomLabel: 'Living Room' },
    { roomId: 'R002', roomLabel: 'Room 2' },
  ])
  const paints = paintNameMap([
    { id: 'P-1', label: 'SW Emerald', displayId: 'AA459213' },
    { id: 'P-2', label: 'SW Ceiling White', displayId: 'CEIL-1' },
  ])

  assert.equal(rooms.get('R001'), 'Living Room')
  assert.equal(rooms.get('R002'), 'Room 2')
  assert.equal(paints.get('P-1'), 'SW Emerald')
  assert.equal(paints.get('AA459213'), 'SW Emerald')
  assert.equal(paints.get('CEIL-1'), 'SW Ceiling White')
})

test('scope extraction classifies mixed trim rows and preserves customer-safe other rows', () => {
  const buckets = finalizeScopeBuckets(
    extractScopeBuckets({
      rooms: [
        { roomId: 'R001', roomLabel: 'Kitchen' },
        { roomId: 'R002', roomLabel: 'Hallway' },
      ],
      roomWallScopes: [
        {
          roomId: 'R001',
          included: true,
          price: 400,
          coatCount: 2,
          paintProductId: 'P-WALL',
          paintProductLabel: '',
          primeMode: 'FULL',
          notes: [],
        },
      ],
      roomCeilingScopes: [],
      roomTrimScopes: [],
      trimItems: [
        {
          roomId: 'R001',
          trimId: 'TRIM-BASE',
          trimLabel: 'Baseboards',
          family: 'baseboard',
          price: 150,
          paintProductId: 'P-TRIM',
          paintProductLabel: '',
          notes: [],
          coats: 2,
          primeMode: 'SPOT',
        },
        {
          roomId: 'R002',
          trimId: 'TRIM-DOOR',
          trimLabel: 'Door and Frame',
          family: 'door casing',
          price: 125,
          paintProductId: 'P-TRIM',
          paintProductLabel: '',
          notes: [],
          coats: 2,
          primeMode: 'FULL',
        },
        {
          roomId: 'R001',
          trimId: 'TRIM-CAB',
          trimLabel: 'Cabinets',
          family: 'cabinet',
          price: 375,
          paintProductId: 'P-TRIM',
          paintProductLabel: '',
          notes: [],
          coats: 2,
          primeMode: 'FULL',
        },
      ],
      otherRows: [
        {
          description: 'Wallpaper removal 1f4e7e9b-8d2d-4fb6-9df1-bcaed26de123',
          location: 'Kitchen',
          qty: 2,
          uom: 'walls',
          price: 210,
        },
      ],
      paintCatalogRows: [
        { id: 'P-WALL', label: 'SW Emerald', displayId: 'AA459213' },
        { id: 'P-TRIM', label: 'SW Trim Enamel', displayId: 'TRIM-PAINT' },
      ],
      trimCatalogRows: [
        { id: 'TRIM-BASE', label: 'Baseboards', family: 'baseboard', category: 'baseboard' },
        { id: 'TRIM-DOOR', label: 'Door and Frame', family: 'door casing', category: 'door casing' },
        { id: 'TRIM-CAB', label: 'Cabinets', family: 'cabinet', category: 'cabinet' },
      ],
      jobsettings: {
        wallPaintProductId: '',
        ceilingPaintProductId: '',
        trimPaintProductId: '',
      },
    })
  )

  assert.equal(trimCategory('Door and Frame', 'door casing'), 'door_casing')
  assert.equal(buckets.walls.price, 400)
  assert.equal(buckets.trim.price, 150)
  assert.equal(buckets.doors.price, 125)
  assert.equal(buckets.cabinets.price, 375)
  assert.match(buckets.walls.texts[0] ?? '', /Kitchen/)
  assert.doesNotMatch(buckets.trim.texts[0] ?? '', /Baseboards|Crown|Chair Rail/i)
  assert.match(buckets.doors.texts[0] ?? '', /Door and Frame/)
  assert.match(buckets.cabinets.texts[0] ?? '', /Cabinets/)
  assert.equal(buckets.other.texts[0], 'Wallpaper removal in Kitchen 2 walls')
})

test('input normalization degrades malformed rows into predictable typed fallbacks', () => {
  const normalized = normalizeCustomerEstimateInput({
    estimate: { id: 42, version_name: null },
    job: { customer_name: 'Taylor Jones' },
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
      rooms: [{ room_id: 'R007', room_name: '5d70f6cc-89aa-4c36-8f1f-77de9b5dcf35' }, null as never],
      room_wall_scopes: [
        {
          room_id: 'R007',
          include: 'N',
          effective_total: 'bad',
          paint_product_id: null,
          notes: 12,
        },
      ],
      room_ceiling_scopes: [],
      room_trim_scopes: [],
      trim_items: [
        {
          room_id: 'R007',
          trim_menu_id: 'TRIM-MISSING',
          trim_menu_label: '7cb8bbab-78d3-4cc0-87c5-1e2fa6bc8098',
          raw_total: 'oops',
        },
      ],
      other: [{ client_description: null, location: 'R007', qty: 'bad', raw_total: null }],
      jobsettings: { walls_paint_id: 999 },
    },
    catalogs: {
      paint_products: [{ id: 'P-1', display_name: 'SW Emerald', display_id: 'AA459213' }],
      trim_items: [],
    },
  })

  assert.equal(normalized.estimate.id, '42')
  assert.equal(normalized.rooms[0]?.roomLabel, 'Room 7')
  assert.equal(normalized.roomWallScopes[0]?.included, false)
  assert.equal(normalized.roomWallScopes[0]?.price, 0)
  assert.deepEqual(normalized.roomWallScopes[0]?.notes, ['12'])
  assert.equal(normalized.trimItems[0]?.trimLabel, 'TRIM MISSING')
  assert.equal(normalized.trimItems[0]?.price, 0)
  assert.equal(normalized.otherRows[0]?.qty, 1)
  assert.equal(normalized.jobsettings.wallPaintProductId, '999')
})

test('section generation keeps manual copy overrides isolated to the text stage', () => {
  const sections = buildCustomerEstimateSections({
    scoped: {
      walls: { texts: ['Generated walls copy'], price: 500, rooms: [], paintProducts: [], subjectLabels: [], notes: [], coats: [], primeModes: [] },
      ceilings: { texts: [], price: 0, rooms: [], paintProducts: [], subjectLabels: [], notes: [], coats: [], primeModes: [] },
      trim: { texts: [], price: 0, rooms: [], paintProducts: [], subjectLabels: [], notes: [], coats: [], primeModes: [] },
      doors: { texts: [], price: 0, rooms: [], paintProducts: [], subjectLabels: [], notes: [], coats: [], primeModes: [] },
      cabinets: { texts: [], price: 0, rooms: [], paintProducts: [], subjectLabels: [], notes: [], coats: [], primeModes: [] },
      other: { texts: ['Generated other copy'], price: 75, rooms: [], paintProducts: [], subjectLabels: [], notes: [], coats: [], primeModes: [] },
    },
    overrides: {
      scope_text_edits: {
        walls: 'Customer-approved wall wording',
      },
    },
  })

  assert.equal(sections.find((section) => section.key === 'walls')?.text, 'Customer-approved wall wording')
  assert.equal(sections.find((section) => section.key === 'other')?.text, 'Generated other copy')
})

test('staged customer estimate build preserves parity with the public document builder', () => {
  const input = {
    estimate: {
      id: 'EST-PARITY',
      version_name: 'Whole House Quote',
      version_state: 'sent',
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
          room_id: 'R001',
          include: 'Y',
          effective_total: 850,
          paint_coats: 2,
          paint_product_id: 'P-WALL',
          prime_mode: 'FULL',
          notes: 'special prep',
        },
      ],
      room_ceiling_scopes: [
        {
          room_id: 'R002',
          include: 'Y',
          effective_total: 225,
          paint_coats: 1,
          paint_product_id: 'P-CEIL',
          prime_mode: 'SPOT',
          ceiling_prep_override: 'minor stain blocking',
        },
      ],
      room_trim_scopes: [],
      trim_items: [
        {
          room_id: 'R001',
          trim_menu_id: 'TRIM-BASE',
          paint_product_id: 'P-TRIM',
          coats: 2,
          raw_total: 175,
          prime_mode: 'FULL',
        },
        {
          room_id: 'R002',
          trim_menu_id: 'TRIM-DOOR',
          paint_product_id: 'P-TRIM',
          coats: 2,
          raw_total: 130,
          prime_mode: 'FULL',
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
    overrides: {
      scope_text_edits: {
        trim: 'Custom trim wording',
      },
    },
    pricingSummary: {
      finalTotal: 1500,
    },
    publicMeta: {
      status: 'viewed',
      viewed_at: '2026-04-22T10:00:00.000Z',
      public_token: 'token-1',
    },
  }

  const normalized = normalizeCustomerEstimateInput(input)
  const scoped = finalizeScopeBuckets(
    extractScopeBuckets({
      rooms: normalized.rooms,
      roomWallScopes: normalized.roomWallScopes,
      roomCeilingScopes: normalized.roomCeilingScopes,
      roomTrimScopes: normalized.roomTrimScopes,
      trimItems: normalized.trimItems,
      otherRows: normalized.otherRows,
      paintCatalogRows: normalized.paintCatalogRows,
      trimCatalogRows: normalized.trimCatalogRows,
      jobsettings: normalized.jobsettings,
    })
  )

  assert.deepEqual(
    assembleCustomerEstimateBuild({ normalized, scoped }),
    buildCustomerEstimateDocument(input)
  )
})

test('staged document assembly falls back to the safe default when quote validity overrides are malformed', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-GUARDRAIL',
      version_name: 'Guardrail Quote',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-20T12:00:00Z',
    },
    job: {
      customer_name: 'Casey Customer',
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
      rooms: [],
      room_wall_scopes: [],
      room_ceiling_scopes: [],
      room_trim_scopes: [],
      trim_items: [],
      other: [],
    },
    settings: {
      quote_validity_days: 45,
      terms_text: '',
    },
    overrides: {
      quote_validity_days: 'not-a-number',
    },
    pricingSummary: {
      finalTotal: 0,
    },
  })

  assert.equal(document.quote_validity_days, 45)
  assert.match(document.terms.join(' '), /valid for 45 days/i)
})
