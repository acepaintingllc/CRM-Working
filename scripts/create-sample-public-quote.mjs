import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'

const cwd = process.cwd()

function loadEnvFile(fileName) {
  const filePath = path.join(cwd, fileName)
  if (!existsSync(filePath)) return

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const equalsAt = trimmed.indexOf('=')
    if (equalsAt === -1) continue

    const key = trimmed.slice(0, equalsAt).trim()
    let value = trimmed.slice(equalsAt + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] ??= value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const args = new Set(process.argv.slice(2))
const getArgValue = (name) => {
  const prefix = `${name}=`
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix))
  return match ? match.slice(prefix.length) : null
}

if (args.has('--help') || args.has('-h')) {
  output(`
Create a sample sent public quote for testing the customer sign page.

Usage:
  npm run demo:quote
  npm run demo:quote -- --org-id=<uuid>
  npm run demo:quote -- --origin=http://localhost:3000
  npm run demo:quote -- --dry-run

  Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
`)
  process.exit(0)
}

const dryRun = args.has('--dry-run')
const requestedOrgId = getArgValue('--org-id')
const appOrigin = stripTrailingSlash(
  getArgValue('--origin') ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_ORIGIN ||
    'http://localhost:3000'
)

const now = new Date()
const sentAt = now.toISOString()
const todayLabel = sentAt.slice(0, 10)
const token = `demo_${randomBytes(18).toString('base64url')}`
const sampleStamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
const sampleSuffix = randomBytes(3).toString('hex')
const sampleDigits = String(randomBytes(4).readUInt32BE(0) % 10000000).padStart(7, '0')
const samplePhone = `555-${sampleDigits.slice(0, 3)}-${sampleDigits.slice(3)}`

const sampleCustomer = {
  name: `Jordan Sample ${sampleStamp}-${sampleSuffix}`,
  email: `jordan.sample+${sampleStamp}.${sampleSuffix}@example.com`,
  phone: samplePhone,
  street: '742 Maple Ridge Drive',
  city: 'Leland',
  state: 'IN',
  zip: '46052',
}
sampleCustomer.address = `${sampleCustomer.street}, ${sampleCustomer.city}, ${sampleCustomer.state} ${sampleCustomer.zip}`

const sampleTotal = 4860

if (dryRun) {
  const document = buildDocument({
    estimateId: 'dry-run-estimate-id',
    publicToken: token,
    sentAt,
    quoteDate: todayLabel,
    customer: sampleCustomer,
  })

  output('Dry run OK. Sample public quote document:')
  output(JSON.stringify(document, null, 2))
  process.exit(0)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  fail('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.')
}

if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
  fail('Refusing to create demo quote data while NODE_ENV or VERCEL_ENV is production.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const membership = await findMembership(supabase, requestedOrgId)
const orgId = membership.org_id
const createdBy = membership.user_id

const { data: customer, error: customerError } = await supabase
  .from('customers')
  .insert({
    org_id: orgId,
    name: sampleCustomer.name,
    email: sampleCustomer.email,
    phone: sampleCustomer.phone,
    address: sampleCustomer.address,
    street: sampleCustomer.street,
    city: sampleCustomer.city,
    state: sampleCustomer.state,
    zip: sampleCustomer.zip,
  })
  .select('id')
  .single()

throwIf(customerError, 'Could not create sample customer')

const { data: job, error: jobError } = await supabase
  .from('jobs')
  .insert({
    org_id: orgId,
    customer_id: customer.id,
    title: 'Demo interior repaint quote',
    description: 'Sample quote acceptance flow for the customer portal.',
    status: 'estimate_sent',
    estimate_date: sentAt,
    estimate_sent_at: sentAt,
  })
  .select('id')
  .single()

throwIf(jobError, 'Could not create sample job')

const { data: estimate, error: estimateError } = await supabase
  .from('estimates')
  .insert({
    org_id: orgId,
    job_id: job.id,
    customer_id: customer.id,
    status: 'ready',
    version_name: 'Demo Quote',
    version_state: 'live',
    version_kind: 'standard',
    version_sort_order: 0,
    latest_output_json: {
      finalTotal: sampleTotal,
      total: sampleTotal,
    },
    created_by: createdBy,
  })
  .select('id')
  .single()

throwIf(estimateError, 'Could not create sample estimate')

const document = buildDocument({
  estimateId: estimate.id,
  publicToken: token,
  sentAt,
  quoteDate: todayLabel,
  customer: sampleCustomer,
})

const draftJson = {
  to_email: sampleCustomer.email,
  subject: 'Your demo painting quote',
  body: 'Here is a demo quote for testing the customer acceptance flow.',
  template_key: 'demo_quote',
}

const { data: publicVersion, error: publicVersionError } = await supabase
  .from('estimate_public_versions')
  .insert({
    org_id: orgId,
    estimate_id: estimate.id,
    customer_id: customer.id,
    version_number: 1,
    status: 'sent',
    public_token: token,
    to_email: sampleCustomer.email,
    subject: draftJson.subject,
    body: draftJson.body,
    template_key: draftJson.template_key,
    snapshot_json: { document, draft: draftJson },
    draft_json: draftJson,
    sent_at: sentAt,
    created_by: createdBy,
  })
  .select('id')
  .single()

throwIf(publicVersionError, 'Could not create sample public quote')

const { error: eventError } = await supabase.from('estimate_public_events').insert({
  org_id: orgId,
  estimate_public_version_id: publicVersion.id,
  event_type: 'sent',
  actor_type: 'staff',
  metadata: {
    to_email: sampleCustomer.email,
    sample: true,
  },
  created_by: createdBy,
  created_at: sentAt,
})

throwIf(eventError, 'Could not create sample quote sent event')

output('Sample public quote created.')
output(`Customer quote: ${appOrigin}/quote/${token}`)
output(`CRM job:        ${appOrigin}/crm/jobs/${job.id}`)
output(`Customer:       ${sampleCustomer.name} <${sampleCustomer.email}>`)
output('')
output('Start the app with npm run dev, open the customer quote link, and accept it.')
output('After acceptance, refresh the CRM job page to see the accepted quote record and timeline event.')

function buildDocument({ estimateId, publicToken, sentAt, quoteDate, customer }) {
  const quoteRows = [
    {
      key: 'walls',
      label: 'Walls',
      description: 'Prep and repaint main living areas with two finish coats.',
      price: 2860,
    },
    {
      key: 'trim',
      label: 'Trim',
      description: 'Paint baseboards, door casing, and window casing in selected rooms.',
      price: 2000,
    },
  ]

  const scopes = [
    {
      key: 'walls',
      label: 'Walls',
      text: 'Includes patching minor nail holes, sanding, spot priming, and two finish coats on selected wall surfaces.',
      price: 2860,
    },
    {
      key: 'trim',
      label: 'Trim',
      text: 'Includes cleaning, scuff sanding, spot priming, and enamel finish on listed trim surfaces.',
      price: 2000,
    },
  ]

  return {
    meta: {
      estimate_id: estimateId,
      version_name: 'Demo Quote',
      version_state: 'live',
      flow_version: 'demo',
      title: 'Interior Painting Quote',
      quote_date: quoteDate,
      sent_at: sentAt,
      viewed_at: null,
      accepted_at: null,
      declined_at: null,
      status: 'sent',
      public_token: publicToken,
    },
    company: {
      business_name: 'ACE Painting',
      timezone: 'America/Chicago',
      main_phone: '555-0100',
      business_email: 'office@example.com',
      address: '100 Main Street, Leland, IN 46052',
      website: 'https://example.com',
      sender_signature: 'ACE Painting',
      logo_url: '',
    },
    customer,
    intro_paragraph:
      'Thank you for the opportunity to quote your painting project. This quote includes the scope, pricing, and terms below.',
    closing_paragraph:
      "If everything looks good, accept the quote online and we'll contact you to schedule the project.",
    quote_validity_days: 14,
    deposit_language: 'A 25% deposit is due after scheduling to reserve the project date.',
    card_fee_note: 'Card payments may include a processing fee where applicable.',
    quote_rows: quoteRows,
    scopes,
    total: sampleTotal,
    terms: [
      'Customer approval is required before work begins.',
      'Color selections must be confirmed before materials are ordered.',
      'Additional repairs or scope changes may require a written change order.',
    ],
    terms_sections: null,
    source_meta: {
      company: {
        business_name: true,
        main_phone: true,
        business_email: true,
        address: true,
        website: true,
        sender_signature: true,
        logo_url: false,
      },
      settings: {
        quote_validity_days: true,
        terms_text: true,
      },
      overrides: {
        title: true,
        intro_paragraph: true,
        closing_paragraph: true,
        deposit_language: true,
        card_fee_note: true,
      },
    },
    header: {
      company_name: 'ACE Painting',
      contact_lines: ['555-0100', 'office@example.com', '100 Main Street, Leland, IN 46052'],
      logo_url: '',
      document_label: 'QUOTE',
      quote_date_label: quoteDate,
    },
    customer_block: {
      lines: [
        customer.name,
        customer.email,
        customer.phone,
        customer.street,
        `${customer.city}, ${customer.state} ${customer.zip}`,
      ],
    },
    pricing_block: {
      rows: quoteRows,
      total: sampleTotal,
      footer_note: 'This quote is subject to the terms and conditions on page 2.',
    },
    terms_page: {
      title: 'QUOTE TERMS',
      sections: [
        {
          key: 'pricing_payment',
          title: 'Pricing & Payment Terms',
          paragraphs: [
            'A 25% deposit is due after scheduling to reserve the project date.',
            'Final payment is due after project completion unless otherwise agreed in writing.',
          ],
        },
        {
          key: 'scope_changes',
          title: 'Scope Changes',
          paragraphs: [
            'Additional repairs, colors, rooms, or surface conditions outside this quote may require a written change order.',
          ],
        },
      ],
    },
    assembly_meta: {
      missing_company_fields: [],
      missing_payment_fields: [],
      missing_legal_fields: [],
      used_placeholder_fallbacks: false,
      used_explicit_terms_text: true,
    },
  }
}

async function findMembership(client, orgId) {
  let query = client
    .from('org_members')
    .select('org_id, user_id')
    .order('created_at', { ascending: true })
    .limit(1)

  if (orgId) query = query.eq('org_id', orgId)

  const { data, error } = await query.maybeSingle()
  throwIf(error, 'Could not load an org membership')

  if (!data?.org_id || !data?.user_id) {
    fail(
      orgId
        ? `No org member found for org ${orgId}.`
        : 'No org membership found. Sign in and bootstrap an org before running this script.'
    )
  }

  return data
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

function throwIf(error, message) {
  if (!error) return
  fail(`${message}: ${error.message}`)
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function output(message = '') {
  process.stdout.write(`${message}\n`)
}
