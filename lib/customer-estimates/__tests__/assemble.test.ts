import assert from 'node:assert/strict'
import test from 'node:test'
import { assembleCustomerEstimateDocument } from '../assemble.ts'
import { buildCustomerEstimateDocument, type CustomerEstimateInput } from '../build.ts'

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

test('assembleCustomerEstimateDocument surfaces visible company placeholders when profile fields are missing', () => {
  const document = assembleCustomerEstimateDocument(
    buildCustomerEstimateDocument(
      createInput({
        company: {
          business_name: '',
          timezone: 'America/Chicago',
          main_phone: '',
          business_email: '',
          address: '',
          website: '',
          sender_signature: '',
          logo_url: '',
        },
      })
    )
  )

  assert.equal(document.header.company_name, '[Company name missing]')
  assert.deepEqual(document.header.contact_lines, [
    '[Company phone missing]',
    '[Company email missing]',
  ])
  assert.deepEqual(document.assembly_meta.missing_company_fields, [
    'business_name',
    'main_phone',
    'business_email',
  ])
  assert.equal(document.assembly_meta.used_placeholder_fallbacks, true)
})

test('assembleCustomerEstimateDocument surfaces payment placeholders when no explicit payment copy exists', () => {
  const document = assembleCustomerEstimateDocument(buildCustomerEstimateDocument(createInput()))

  const pricingSection = document.terms_page.sections.find(
    (section) => section.key === 'pricing_payment'
  )

  assert.ok(pricingSection)
  assert.match(pricingSection?.paragraphs.join('\n') ?? '', /\[Deposit terms missing\]/)
  assert.match(pricingSection?.paragraphs.join('\n') ?? '', /\[Card fee note missing\]/)
  assert.deepEqual(document.assembly_meta.missing_payment_fields, [
    '[Deposit terms missing]',
    '[Card fee note missing]',
  ])
})

test('assembleCustomerEstimateDocument uses explicit terms text as the customer terms page', () => {
  const document = assembleCustomerEstimateDocument(
    buildCustomerEstimateDocument(
      createInput({
        settings: {
          quote_validity_days: 45,
          terms_text: 'Line one.\n\nLine two.',
        },
      })
    )
  )

  const pricingSection = document.terms_page.sections.find(
    (section) => section.key === 'pricing_payment'
  )
  const insuranceSection = document.terms_page.sections.find(
    (section) => section.key === 'insurance'
  )
  const terms = document.terms_page.sections.find(
    (section) => section.key === 'terms_and_conditions'
  )

  assert.equal(pricingSection, undefined)
  assert.equal(insuranceSection, undefined)
  assert.deepEqual(document.assembly_meta.missing_payment_fields, [])
  assert.deepEqual(document.assembly_meta.missing_legal_fields, [])
  assert.equal(document.assembly_meta.used_placeholder_fallbacks, false)
  assert.equal(document.assembly_meta.used_explicit_terms_text, true)
  assert.deepEqual(terms?.paragraphs, ['Line one.', 'Line two.'])
})

test('assembleCustomerEstimateDocument preserves built scope and pricing rows without recomposing policy text', () => {
  const built = buildCustomerEstimateDocument(
    createInput({
      settings: {
        quote_validity_days: 45,
        terms_text: '',
      },
      overrides: {
        title: 'Custom Kitchen Quote',
        deposit_language: 'Half due on booking.',
        card_fee_note: 'Cards add 3%.',
        scope_text_edits: {
          walls: 'Customer-approved custom walls copy.',
          ceilings: '',
          trim: '',
          doors: '',
          cabinets: '',
          other: '',
        },
      },
      pricingSummary: {
        finalTotal: 1675,
      },
      inputs: {
        rooms: [{ room_id: 'R001', room_name: 'Kitchen' }],
        room_wall_scopes: [
          {
            id: 'wall-1',
            room_id: 'R001',
            include: 'Y',
            effective_total: 1675,
            paint_coats: 2,
            paint_product_id: 'wall-paint',
            paint_product_label: 'wall-paint',
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
        paint_products: [{ id: 'wall-paint', display_name: 'Gallery Series', display_id: 'wall-paint' }],
        trim_items: [],
      },
    })
  )

  const document = assembleCustomerEstimateDocument(built)
  const pricingSection = document.terms_page.sections.find(
    (section) => section.key === 'pricing_payment'
  )

  assert.equal(document.meta.title, 'Custom Kitchen Quote')
  assert.equal(document.quote_rows[0]?.description, 'Customer-approved custom walls copy.')
  assert.equal(document.pricing_block.rows[0]?.description, 'Customer-approved custom walls copy.')
  assert.equal(document.total, 1675)
  assert.equal(document.pricing_block.total, 1675)
  assert.deepEqual(document.scopes, built.scopes)
  assert.ok(pricingSection)
  assert.match(pricingSection?.paragraphs.join('\n') ?? '', /Half due on booking\./)
  assert.match(pricingSection?.paragraphs.join('\n') ?? '', /Cards add 3%\./)
  assert.deepEqual(document.assembly_meta.missing_payment_fields, [])
})
