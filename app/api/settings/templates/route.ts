import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { readJsonBody } from '@/lib/server/apiRoute'

type Unsafe = Record<string, unknown>

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function asMaybeNumber(value: unknown) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

async function loadSettings(orgId: string) {
  const res = await supabaseAdmin
    .from('estimate_template_settings')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()
  if (res.error) throw new Error(res.error.message)
  return (res.data ?? null) as Unsafe | null
}

export async function GET() {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  try {
    const row = await loadSettings(session.orgId)
    return NextResponse.json({
      settings: {
        default_template_key: asText(row?.default_template_key) || 'default',
        quote_validity_days: asMaybeNumber(row?.quote_validity_days) ?? 90,
        terms_text: asText(row?.terms_text),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load template settings'
    return NextResponse.json({ error: message }, { status: 500 })
  }
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
  const settings = ((body?.settings ?? body) as Unsafe | null) ?? null
  if (!settings) return NextResponse.json({ error: 'Missing settings payload' }, { status: 400 })

  const defaultTemplateKey = asText(settings.default_template_key) || 'default'
  const quoteValidityDays = asMaybeNumber(settings.quote_validity_days) ?? 90
  const termsText = asText(settings.terms_text)

  const upsert = await supabaseAdmin
    .from('estimate_template_settings')
    .upsert(
      {
        org_id: session.orgId,
        default_template_key: defaultTemplateKey,
        quote_validity_days: quoteValidityDays,
        terms_text: termsText,
      },
      { onConflict: 'org_id' }
    )
    .select('*')
    .single()

  if (upsert.error) {
    return NextResponse.json({ error: upsert.error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    settings: {
      default_template_key: asText(upsert.data?.default_template_key) || defaultTemplateKey,
      quote_validity_days: asMaybeNumber(upsert.data?.quote_validity_days) ?? quoteValidityDays,
      terms_text: asText(upsert.data?.terms_text),
    },
  })
}
