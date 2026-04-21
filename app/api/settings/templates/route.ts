import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { readJsonBody } from '@/lib/server/apiRoute'
import {
  loadEstimateTemplateSettings,
  normalizeEstimateTemplateSettings,
} from '@/lib/server/estimateTemplateSettings'

type Unsafe = Record<string, unknown>

export async function GET() {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  try {
    const row = await loadEstimateTemplateSettings(session.orgId)
    return NextResponse.json({
      settings: row,
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

  const currentSettings = await loadEstimateTemplateSettings(session.orgId).catch(() => null)
  const nextSettings = normalizeEstimateTemplateSettings({
    ...(currentSettings ?? {}),
    ...settings,
  })

  const upsert = await supabaseAdmin
    .from('estimate_template_settings')
    .upsert(
      {
        org_id: session.orgId,
        ...nextSettings,
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
    settings: normalizeEstimateTemplateSettings(upsert.data as Unsafe | null),
  })
}
