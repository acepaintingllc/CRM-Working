import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { buildCustomerEstimateDocument } from '@/lib/customer-estimates/build'
import type { CustomerEstimateDocument } from '@/lib/customer-estimates/types'
import { sendGmailMessage } from '@/lib/server/googleMail'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { loadEstimateCustomerSendContext } from '@/lib/server/estimateCustomerPortal'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function asMaybeNumber(value: unknown) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeScopeTextForComparison(value: string) {
  return asText(value)
    .toLowerCase()
    .replace(/\bwith\b/g, 'using')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
}

function normalizeDraftScopeTextEdits(params: {
  context: Exclude<Awaited<ReturnType<typeof loadEstimateCustomerSendContext>>, { error: string }>
  draft: Record<string, unknown>
}): Record<string, unknown> & { scope_text_edits: Record<string, string> } {
  const baseline = buildCustomerDocumentFromContext({
    context: params.context,
    overrides: undefined,
    publicMeta: {
      status: 'draft',
      sent_at: null,
      viewed_at: null,
      accepted_at: null,
      declined_at: null,
      public_token: null,
    },
  })

  const baselineByKey = new Map(baseline.scopes.map((section) => [section.key, section.text] as const))
  const scopeTextEditsRaw = (params.draft.scope_text_edits as Record<string, unknown> | null | undefined) ?? {}
  const normalized: Record<string, string> = {}

  for (const key of ['walls', 'ceilings', 'trim', 'doors', 'cabinets', 'other'] as const) {
    const value = asText(scopeTextEditsRaw[key])
    if (!value) {
      normalized[key] = ''
      continue
    }

    const baseText = asText(baselineByKey.get(key))
    if (baseText && normalizeScopeTextForComparison(value) === normalizeScopeTextForComparison(baseText)) {
      normalized[key] = ''
      continue
    }

    normalized[key] = value
  }

  return {
    ...params.draft,
    scope_text_edits: normalized,
  }
}

function buildCustomerDocumentFromContext(params: {
  context: Exclude<Awaited<ReturnType<typeof loadEstimateCustomerSendContext>>, { error: string }>
  overrides?: {
    title?: string
    intro_paragraph?: string
    closing_paragraph?: string
    quote_validity_days?: number | string | null
    deposit_language?: string
    card_fee_note?: string
  } & { scope_text_edits?: Record<string, string> }
  publicMeta?: {
    status?: string
    sent_at?: string | null
    viewed_at?: string | null
    accepted_at?: string | null
    declined_at?: string | null
    public_token?: string | null
  }
}) {
  return buildCustomerEstimateDocument({
    estimate: params.context.estimate as Record<string, unknown>,
    job: params.context.job as Record<string, unknown>,
    customer: (params.context as Record<string, unknown>).customer as Record<string, unknown> | null | undefined,
    company: params.context.company,
    inputs: params.context.inputs,
    catalogs: params.context.catalogs as Record<string, unknown> | null,
    settings: params.context.settings as
      | {
          default_template_key?: string | null
          quote_validity_days?: number | null
          terms_text?: string | null
        }
      | undefined,
    pricingSummary: (params.context as Record<string, unknown>).pricing_summary as { finalTotal: number | null } | null | undefined,
    overrides: params.overrides,
    publicMeta: params.publicMeta,
  }) as CustomerEstimateDocument
}

function sanitizeDraft(body: Record<string, unknown> | null | undefined) {
  const draft = (body?.draft as Record<string, unknown> | null | undefined) ?? body ?? {}
  const scopeTextEditsRaw = (draft.scope_text_edits as Record<string, unknown> | null | undefined) ?? {}
  const scopeTextEdits = {
    walls: asText(scopeTextEditsRaw.walls),
    ceilings: asText(scopeTextEditsRaw.ceilings),
    trim: asText(scopeTextEditsRaw.trim),
    doors: asText(scopeTextEditsRaw.doors),
    cabinets: asText(scopeTextEditsRaw.cabinets),
    other: asText(scopeTextEditsRaw.other),
  }
  return {
    to_email: asText(draft.to_email),
    cc_email: asText(draft.cc_email),
    bcc_email: asText(draft.bcc_email),
    subject: asText(draft.subject),
    body: asText(draft.body),
    template_key: asText(draft.template_key),
    title: asText(draft.title),
    intro_paragraph: asText(draft.intro_paragraph),
    closing_paragraph: asText(draft.closing_paragraph),
    terms_text: asText(draft.terms_text),
    scope_text_edits: scopeTextEdits,
    quote_validity_days: asMaybeNumber(draft.quote_validity_days),
    deposit_language: asText(draft.deposit_language),
    card_fee_note: asText(draft.card_fee_note),
  }
}

async function writeEvent(params: {
  orgId: string
  versionId: string
  eventType: 'draft_saved' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'superseded' | 'pdf_requested'
  actorType?: 'system' | 'customer' | 'staff'
  metadata?: Record<string, unknown>
  createdBy?: string | null
}) {
  await supabaseAdmin.from('estimate_public_events').insert({
    org_id: params.orgId,
    estimate_public_version_id: params.versionId,
    event_type: params.eventType,
    actor_type: params.actorType ?? 'system',
    metadata: params.metadata ?? {},
    created_by: params.createdBy ?? null,
  })
}

async function findLatestDraftVersion(orgId: string, estimateId: string) {
  const res = await supabaseAdmin
    .from('estimate_public_versions')
    .select('*')
    .eq('org_id', orgId)
    .eq('estimate_id', estimateId)
    .eq('status', 'draft')
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (res.error) throw new Error(res.error.message)
  return res.data as Record<string, unknown> | null
}

async function findLatestVersion(orgId: string, estimateId: string) {
  const res = await supabaseAdmin
    .from('estimate_public_versions')
    .select('*')
    .eq('org_id', orgId)
    .eq('estimate_id', estimateId)
    .order('version_number', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (res.error) throw new Error(res.error.message)
  return res.data as Record<string, unknown> | null
}

async function saveDraft(params: {
  orgId: string
  estimateId: string
  userId: string
  body: Record<string, unknown> | null
  context: Exclude<Awaited<ReturnType<typeof loadEstimateCustomerSendContext>>, { error: string }>
}) {
  const draft = normalizeDraftScopeTextEdits({
    context: params.context,
    draft: sanitizeDraft(params.body),
  })
  const latestDraft = await findLatestDraftVersion(params.orgId, params.estimateId)
  const latestVersion = latestDraft ?? (await findLatestVersion(params.orgId, params.estimateId))
  const nextVersionNumber = Number(latestVersion?.version_number ?? 0) + (latestDraft ? 0 : 1)
  const document = buildCustomerDocumentFromContext({
    context: params.context,
    overrides: draft,
    publicMeta: {
      status: asText(latestVersion?.status) || 'draft',
      sent_at: (latestVersion?.sent_at as string | null) ?? null,
      viewed_at: (latestVersion?.viewed_at as string | null) ?? null,
      accepted_at: (latestVersion?.accepted_at as string | null) ?? null,
      declined_at: (latestVersion?.declined_at as string | null) ?? null,
      public_token: (latestVersion?.public_token as string | null) ?? null,
    },
  })

  const payload = {
    org_id: params.orgId,
    estimate_id: params.estimateId,
    customer_id: asText(params.context.estimate.customer_id),
    version_number: latestDraft ? Number(latestDraft.version_number ?? 1) : nextVersionNumber,
    status: 'draft',
    public_token: latestDraft?.public_token ?? null,
    to_email: draft.to_email || null,
    cc_email: draft.cc_email || null,
    bcc_email: draft.bcc_email || null,
    subject: draft.subject || null,
    body: draft.body || null,
    template_key: draft.template_key || null,
    snapshot_json: document,
    draft_json: draft,
    acceptance_json: latestDraft?.acceptance_json ?? null,
    sent_at: latestDraft?.sent_at ?? null,
    viewed_at: latestDraft?.viewed_at ?? null,
    accepted_at: latestDraft?.accepted_at ?? null,
    declined_at: latestDraft?.declined_at ?? null,
    locked_at: latestDraft?.locked_at ?? null,
    created_by: params.userId,
  }

  let result
  if (latestDraft?.id) {
    result = await supabaseAdmin
      .from('estimate_public_versions')
      .update(payload)
      .eq('org_id', params.orgId)
      .eq('id', asText(latestDraft.id))
      .select('*')
      .single()
  } else {
    result = await supabaseAdmin.from('estimate_public_versions').insert(payload).select('*').single()
  }
  if (result.error || !result.data) throw new Error(result.error?.message ?? 'Unable to save draft')

  await writeEvent({
    orgId: params.orgId,
    versionId: asText(result.data.id),
    eventType: 'draft_saved',
    actorType: 'staff',
    createdBy: params.userId,
    metadata: { draft },
  })

  return result.data as Record<string, unknown>
}

export async function GET(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }
  const params = await Promise.resolve(context.params)
  const id = (params as { id?: string } | null | undefined)?.id
  if (!id || typeof id !== 'string' || !uuid.test(id)) {
    return NextResponse.json({ error: 'Invalid estimate id' }, { status: 400 })
  }

  const url = new URL(request.url)
  const contextResult = await loadEstimateCustomerSendContext({
    origin: url.origin,
    orgId: session.orgId,
    userId: session.userId,
    estimateId: id,
  })
  if ('error' in contextResult) {
    return NextResponse.json({ error: contextResult.error }, { status: 404 })
  }

  const latestDraft = (contextResult.public_versions ?? []).find((row) => asText(row.status) === 'draft') ?? null
  const latestVersion = latestDraft ?? contextResult.latest_public_version ?? null
  const draft = normalizeDraftScopeTextEdits({
    context: contextResult,
    draft: (latestVersion?.draft_json as Record<string, unknown> | null | undefined) ?? {},
  })
  const document = buildCustomerDocumentFromContext({
    context: contextResult,
    overrides: draft,
    publicMeta: {
      status: asText(latestVersion?.status) || 'draft',
      sent_at: (latestVersion?.sent_at as string | null) ?? null,
      viewed_at: (latestVersion?.viewed_at as string | null) ?? null,
      accepted_at: (latestVersion?.accepted_at as string | null) ?? null,
      declined_at: (latestVersion?.declined_at as string | null) ?? null,
      public_token: (latestVersion?.public_token as string | null) ?? null,
    },
  })
  if ('error' in document) {
    return NextResponse.json({ error: document.error }, { status: 500 })
  }

  return NextResponse.json({
    estimate: contextResult.estimate,
    job: contextResult.job,
    customer: (contextResult as Record<string, unknown>).customer ?? null,
    company: contextResult.company,
    settings: contextResult.settings ?? null,
    inputs: contextResult.inputs,
    catalogs: contextResult.catalogs,
    pricing_summary: (contextResult as Record<string, unknown>).pricing_summary ?? null,
    draft,
    version: latestVersion,
    public_url: latestVersion?.public_token ? `${url.origin}/quote/${latestVersion.public_token}` : contextResult.public_url,
    document,
    versions: contextResult.public_versions ?? [],
  })
}

export async function PUT(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }
  const params = await Promise.resolve(context.params)
  const id = (params as { id?: string } | null | undefined)?.id
  if (!id || typeof id !== 'string' || !uuid.test(id)) {
    return NextResponse.json({ error: 'Invalid estimate id' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Missing body' }, { status: 400 })
  const url = new URL(request.url)

  const contextResult = await loadEstimateCustomerSendContext({
    origin: url.origin,
    orgId: session.orgId,
    userId: session.userId,
    estimateId: id,
  })
  if ('error' in contextResult) {
    return NextResponse.json({ error: contextResult.error }, { status: 404 })
  }

  try {
    const version = await saveDraft({
      orgId: session.orgId,
      estimateId: id,
      userId: session.userId,
      body,
      context: contextResult,
    })
    return NextResponse.json({
      ok: true,
      version,
      public_url: asText(version.public_token) ? `${url.origin}/quote/${version.public_token}` : contextResult.public_url,
      document: version.snapshot_json ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save draft'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function POST(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }
  const params = await Promise.resolve(context.params)
  const id = (params as { id?: string } | null | undefined)?.id
  if (!id || typeof id !== 'string' || !uuid.test(id)) {
    return NextResponse.json({ error: 'Invalid estimate id' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const mode = asText(body?.mode).toLowerCase() === 'test' ? 'test' : 'send'
  const url = new URL(request.url)

  const contextResult = await loadEstimateCustomerSendContext({
    origin: url.origin,
    orgId: session.orgId,
    userId: session.userId,
    estimateId: id,
  })
  if ('error' in contextResult) {
    return NextResponse.json({ error: contextResult.error }, { status: 404 })
  }

  const draft = sanitizeDraft(body)
  if (!draft.to_email) {
    return NextResponse.json({ error: 'Customer email is required' }, { status: 400 })
  }

  try {
    const version = await saveDraft({
      orgId: session.orgId,
      estimateId: id,
      userId: session.userId,
      body,
      context: contextResult,
    })

    let publicVersion = version
    if (mode === 'send') {
      let token = asText(publicVersion.public_token)
      if (!token) token = randomUUID().replace(/-/g, '')
      const publicUrl = `${url.origin}/quote/${token}`
      const sentAt = new Date().toISOString()
      const update = await supabaseAdmin
        .from('estimate_public_versions')
        .update({
          status: 'sent',
          public_token: token,
          sent_at: sentAt,
          locked_at: sentAt,
        })
        .eq('org_id', session.orgId)
        .eq('id', asText(publicVersion.id))
        .select('*')
        .single()
      if (update.error || !update.data) throw new Error(update.error?.message ?? 'Unable to lock estimate')
      publicVersion = update.data as Record<string, unknown>
      await writeEvent({
        orgId: session.orgId,
        versionId: asText(publicVersion.id),
        eventType: 'sent',
        actorType: 'staff',
        createdBy: session.userId,
        metadata: { publicUrl },
      })

      const document = publicVersion.snapshot_json as Record<string, unknown>
      const subject = draft.subject || `${asText(contextResult.estimate.version_name) || 'Quote'} ready`
      const bodyText =
        draft.body ||
        [
          `Hello ${asText(contextResult.job.customer_name) || 'there'},`,
          '',
          `Your quote is ready: ${publicUrl}`,
          '',
          'You can review the full quote and accept it directly from the link above.',
          '',
          contextResult.company.sender_signature || `Thanks,\n${contextResult.company.business_name || 'ACE Painting'}`,
        ].join('\n')

      const send = await sendGmailMessage({
        origin: url.origin,
        orgId: session.orgId,
        userId: session.userId,
        to: draft.to_email,
        subject,
        bodyText,
      })
      if ('error' in send) {
        return NextResponse.json({ error: send.error }, { status: 400 })
      }

      return NextResponse.json({
        ok: true,
        mode,
        public_url: publicUrl,
        version: publicVersion,
        document,
      })
    }

    return NextResponse.json({
      ok: true,
      mode,
      version: publicVersion,
      public_url: asText(publicVersion.public_token)
        ? `${url.origin}/quote/${publicVersion.public_token}`
        : contextResult.public_url,
      document: publicVersion.snapshot_json ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send estimate'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
