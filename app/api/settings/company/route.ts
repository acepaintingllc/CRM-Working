import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { readJsonBody } from '@/lib/server/apiRoute'

type Unsafe = Record<string, unknown>

function asText(value: unknown) {
  return value == null ? '' : String(value)
}

function pickFirst(row: Unsafe, candidates: string[]) {
  for (const key of candidates) {
    if (key in row) return { key, value: asText(row[key]) }
  }
  return { key: null, value: '' as string }
}

function assignFirstExisting(params: {
  row: Unsafe
  patch: Unsafe
  candidates: string[]
  value: string
}) {
  for (const key of params.candidates) {
    if (!(key in params.row)) continue
    params.patch[key] = params.value.trim() || null
    return key
  }
  return null
}

export async function GET() {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const orgRes = await supabaseAdmin
    .from('orgs')
    .select('*')
    .eq('id', session.orgId)
    .maybeSingle()

  if (orgRes.error) {
    return NextResponse.json({ error: orgRes.error.message }, { status: 500 })
  }

  const row = ((orgRes.data ?? {}) as Unsafe) ?? {}

  const phone = pickFirst(row, ['main_phone', 'phone', 'company_phone'])
  const email = pickFirst(row, ['business_email', 'email', 'company_email', 'from_email'])
  const address = pickFirst(row, ['address', 'company_address'])
  const website = pickFirst(row, ['website', 'company_website'])
  const signature = pickFirst(row, [
    'sender_signature',
    'default_sender_signature',
    'email_signature',
    'signature',
  ])
  const logoUrl = pickFirst(row, ['logo_url', 'logo', 'brand_logo_url'])

  return NextResponse.json({
    profile: {
      business_name: asText(row.name),
      timezone: asText(row.timezone),
      main_phone: phone.value,
      business_email: email.value,
      address: address.value,
      website: website.value,
      sender_signature: signature.value,
      logo_url: logoUrl.value,
    },
    supported: {
      business_name: 'name' in row,
      timezone: 'timezone' in row,
      main_phone: Boolean(phone.key),
      business_email: Boolean(email.key),
      address: Boolean(address.key),
      website: Boolean(website.key),
      sender_signature: Boolean(signature.key),
      logo_url: Boolean(logoUrl.key),
    },
  })
}

export async function PUT(request: Request) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const parsed = await readJsonBody<Unsafe>(request, { maxBytes: 64 * 1024 })
  if (!parsed.ok) return parsed.response
  const body = parsed.value
  const profile = ((body?.profile ?? body) as Unsafe | null) ?? null
  if (!profile) {
    return NextResponse.json({ error: 'Missing profile payload' }, { status: 400 })
  }

  const orgRes = await supabaseAdmin
    .from('orgs')
    .select('*')
    .eq('id', session.orgId)
    .maybeSingle()

  if (orgRes.error) {
    return NextResponse.json({ error: orgRes.error.message }, { status: 500 })
  }
  const row = ((orgRes.data ?? {}) as Unsafe) ?? {}
  const patch: Unsafe = {}

  if ('name' in row) patch.name = asText(profile.business_name).trim() || 'ACE Painting'
  if ('timezone' in row) patch.timezone = asText(profile.timezone).trim() || 'America/Chicago'
  assignFirstExisting({
    row,
    patch,
    candidates: ['main_phone', 'phone', 'company_phone'],
    value: asText(profile.main_phone),
  })
  assignFirstExisting({
    row,
    patch,
    candidates: ['business_email', 'email', 'company_email', 'from_email'],
    value: asText(profile.business_email),
  })
  assignFirstExisting({
    row,
    patch,
    candidates: ['address', 'company_address'],
    value: asText(profile.address),
  })
  assignFirstExisting({
    row,
    patch,
    candidates: ['website', 'company_website'],
    value: asText(profile.website),
  })
  assignFirstExisting({
    row,
    patch,
    candidates: ['sender_signature', 'default_sender_signature', 'email_signature', 'signature'],
    value: asText(profile.sender_signature),
  })
  assignFirstExisting({
    row,
    patch,
    candidates: ['logo_url', 'logo', 'brand_logo_url'],
    value: asText(profile.logo_url),
  })

  const update = await supabaseAdmin.from('orgs').update(patch).eq('id', session.orgId).select('*').maybeSingle()
  if (update.error) {
    return NextResponse.json({ error: update.error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, org: update.data ?? null })
}
