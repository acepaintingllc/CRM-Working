import { getEstimateCatalogs } from './estimateCatalogs.ts'
import { buildTrimPaintInput } from './trimPaint.ts'
import { supabaseAdmin } from './org.ts'
import { buildCustomerEstimateDocument } from '@/lib/customer-estimates/build'
import { buildEstimatePricingSummary } from '@/lib/estimator/pricingPolicies'
import { calculateCeilings } from '@/lib/estimator/ceilings'
import { calculateTrim } from '@/lib/estimator/trim'
import { calculateWalls } from '@/lib/estimator/walls'
import { productMap } from '@/lib/estimator/wallsHelpers'
import type { CompanyProfile, Unsafe } from '@/lib/customer-estimates/types'
import { loadCompanyProfileSettings } from '@/lib/server/settings/companyProfileStore'
import { loadQuoteSendDefaults } from '@/lib/server/settings/quoteSendDefaultsStore'

type EstimateRow = {
  id: string
  job_id: string
  customer_id: string
  status: string | null
  version_name: string | null
  version_state: string | null
  version_kind: string | null
  version_sort_order: number | null
  created_at: string | null
  updated_at: string | null
}

type JobRow = {
  id: string
  title: string | null
  estimate_date: string | null
}

type CustomerRow = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  address: string | null
  street: string | null
  city: string | null
  state: string | null
  zip: string | null
}

type EstimateTemplateSettingsRow = {
  labor_day_policy_enabled?: boolean | null
  dayhours?: number | null
  rounding_increment_hours?: number | null
  override_labor_rate?: number | null
  job_minimum_enabled?: boolean | null
  job_minimum_amount?: number | null
  updated_at: string | null
}

type EstimateJobSettingsRow = {
  labor_day_policy_enabled?: boolean | null
  dayhours?: number | null
  rounding_increment_hours?: number | null
  override_labor_rate?: number | null
  job_minimum_enabled?: boolean | null
  job_minimum_amount?: number | null
  trim_paint_id?: string | null
  trim_paint_gallons?: number | null
  trim_paint_quarts?: number | null
  trim_paint_qty?: number | null
  trim_paint_uom?: string | null
}

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function resolveRoomModeById(params: {
  rooms: Unsafe[]
  wallScopes: Unsafe[]
  ceilingScopes: Unsafe[]
}) {
  const roomMode = new Map<string, 'RECT' | 'SEG'>()
  for (const scope of params.wallScopes) {
    const roomId = asText(scope.room_id).toUpperCase()
    if (!roomId || roomMode.has(roomId)) continue
    roomMode.set(roomId, asText(scope.mode).toUpperCase() === 'SEG' ? 'SEG' : 'RECT')
  }
  for (const scope of params.ceilingScopes) {
    const roomId = asText(scope.room_id).toUpperCase()
    if (!roomId || roomMode.has(roomId)) continue
    roomMode.set(roomId, asText(scope.mode).toUpperCase() === 'SEG' ? 'SEG' : 'RECT')
  }
  for (const room of params.rooms) {
    const roomId = asText(room.room_id).toUpperCase()
    if (!roomId || roomMode.has(roomId)) continue
    roomMode.set(roomId, asText(room.mode).toUpperCase() === 'SEG' ? 'SEG' : 'RECT')
  }
  return roomMode
}

export async function loadEstimateCustomerSendContext(params: {
  origin: string
  orgId: string
  userId: string
  estimateId: string
}) {
  const estimateRes = await supabaseAdmin
    .from('estimates')
    .select('id, job_id, customer_id, status, version_name, version_state, version_kind, version_sort_order, created_at, updated_at')
    .eq('org_id', params.orgId)
    .eq('id', params.estimateId)
    .maybeSingle()

  if (estimateRes.error) return { error: estimateRes.error.message } as const
  if (!estimateRes.data) return { error: 'Quote not found' } as const

  const estimate = estimateRes.data as EstimateRow

  const [jobRes, customerRes, companyProfileRes, quoteDefaultsRes, settingsRes, jobsettingsRes, roomsRes, wallScopesRes, segmentsRes, wallSegmentsRes, ceilingSegmentsRes, ceilingScopesRes, ceilingScopeSegmentsRes, trimScopesRes, trimItemsRes, otherRes, versionsRes] = await Promise.all([
    supabaseAdmin
      .from('jobs')
      .select('id, title, estimate_date')
      .eq('org_id', params.orgId)
      .eq('id', estimate.job_id)
      .maybeSingle(),
    supabaseAdmin
      .from('customers')
      .select('id, name, email, phone, address, street, city, state, zip')
      .eq('org_id', params.orgId)
      .eq('id', estimate.customer_id)
      .maybeSingle(),
    loadCompanyProfileSettings(params.orgId).catch(() => null),
    loadQuoteSendDefaults(params.orgId).catch(() => null),
    supabaseAdmin
      .from('estimate_template_settings')
      .select('*')
      .eq('org_id', params.orgId)
      .maybeSingle(),
    supabaseAdmin
      .from('estimate_jobsettings')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .maybeSingle(),
    supabaseAdmin
      .from('estimate_rooms')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_room_wall_scopes')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .order('room_id', { ascending: true })
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_segments')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .is('wall_scope_id', null)
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_segments')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .not('wall_scope_id', 'is', null)
      .order('wall_scope_id', { ascending: true })
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_ceiling_segments')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_room_ceiling_scopes')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .order('room_id', { ascending: true })
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_room_ceiling_scope_segments')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .order('ceiling_scope_id', { ascending: true })
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_room_trim_scopes')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .order('room_id', { ascending: true })
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_trim_items')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('estimate_other')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_public_versions')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .order('version_number', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (jobRes.error) return { error: jobRes.error.message } as const
  if (customerRes.error) return { error: customerRes.error.message } as const
  if (settingsRes.error) return { error: settingsRes.error.message } as const
  if (jobsettingsRes.error) return { error: jobsettingsRes.error.message } as const
  if (roomsRes.error) return { error: roomsRes.error.message } as const
  if (wallScopesRes.error) return { error: wallScopesRes.error.message } as const
  if (segmentsRes.error) return { error: segmentsRes.error.message } as const
  if (wallSegmentsRes.error) return { error: wallSegmentsRes.error.message } as const
  if (ceilingSegmentsRes.error) return { error: ceilingSegmentsRes.error.message } as const
  if (ceilingScopesRes.error) return { error: ceilingScopesRes.error.message } as const
  if (ceilingScopeSegmentsRes.error) return { error: ceilingScopeSegmentsRes.error.message } as const
  if (trimScopesRes.error) return { error: trimScopesRes.error.message } as const
  if (trimItemsRes.error) return { error: trimItemsRes.error.message } as const
  if (otherRes.error) return { error: otherRes.error.message } as const
  if (versionsRes.error) return { error: versionsRes.error.message } as const

  const job = (jobRes.data ?? {}) as JobRow
  const customer = (customerRes.data ?? {}) as CustomerRow
  const settingsRow = (settingsRes.data ?? {}) as EstimateTemplateSettingsRow
  const company = (companyProfileRes ?? {
    business_name: '',
    timezone: 'America/Chicago',
    main_phone: '',
    business_email: '',
    address: '',
    website: '',
    sender_signature: '',
    logo_url: '',
  }) as CompanyProfile
  const quoteDefaults =
    quoteDefaultsRes ?? {
      default_template_key: 'default',
      quote_validity_days: 90,
      terms_text: '',
    }

  const catalogs = await getEstimateCatalogs({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    estimateId: params.estimateId,
  }).catch(() => null)

  const publicVersions = (versionsRes.data ?? []) as Unsafe[]
  const latestDraftVersion = publicVersions.find((row) => asText(row.status) === 'draft') ?? null
  const latestSentVersion =
    publicVersions.find((row) => asText(row.status) !== 'draft' && asText(row.public_token)) ?? null
  const previewVersion = latestDraftVersion ?? latestSentVersion ?? publicVersions[0] ?? null
  const publicUrl = latestSentVersion?.public_token
    ? `${params.origin}/quote/${latestSentVersion.public_token}`
    : null

  const jobsettings = (jobsettingsRes.data ?? {}) as EstimateJobSettingsRow
  const effectiveLaborRate = jobsettings.override_labor_rate ?? settingsRow.override_labor_rate ?? null
  const effectiveLaborDayEnabled =
    typeof jobsettings.labor_day_policy_enabled === 'boolean'
      ? jobsettings.labor_day_policy_enabled
      : settingsRow.labor_day_policy_enabled
  const effectiveDayhours = jobsettings.dayhours ?? settingsRow.dayhours ?? 8
  const effectiveRoundingIncrement =
    jobsettings.rounding_increment_hours ?? settingsRow.rounding_increment_hours ?? 4
  const effectiveJobMinimumEnabled =
    typeof jobsettings.job_minimum_enabled === 'boolean'
      ? jobsettings.job_minimum_enabled
      : settingsRow.job_minimum_enabled
  const effectiveJobMinimumAmount =
    jobsettings.job_minimum_amount ?? settingsRow.job_minimum_amount ?? 0
  let quoteWallScopes = (wallScopesRes.data ?? []) as Unsafe[]
  let quoteCeilingScopes = (ceilingScopesRes.data ?? []) as Unsafe[]
  let quoteTrimScopes = (trimScopesRes.data ?? []) as Unsafe[]
  let pricingSummary = null as Awaited<ReturnType<typeof buildEstimatePricingSummary>> | null
  try {
    if (catalogs?.catalogs) {
      const wallScopes = (wallScopesRes.data ?? []) as Parameters<typeof calculateWalls>[0]['scopes']
      const wallSegments = (wallSegmentsRes.data ?? []) as Parameters<typeof calculateWalls>[0]['segments']
      const ceilingScopes = (ceilingScopesRes.data ?? []) as Parameters<typeof calculateCeilings>[0]['scopes']
      const ceilingSegments = (ceilingScopeSegmentsRes.data ?? []) as Parameters<typeof calculateCeilings>[0]['segments']
      const trimScopes = (trimScopesRes.data ?? []) as Parameters<typeof calculateTrim>[0]['scopes']
      const rooms = (roomsRes.data ?? []) as Parameters<typeof calculateTrim>[0]['rooms']
      const roomModeById = resolveRoomModeById({
        rooms: rooms as Unsafe[],
        wallScopes: wallScopes as Unsafe[],
        ceilingScopes: ceilingScopes as Unsafe[],
      })
      const wallCalculations = calculateWalls({
        scopes: wallScopes,
        segments: wallSegments,
        settings: {
          labor_rate_per_hour: effectiveLaborRate,
        },
        catalogs: catalogs.catalogs as Parameters<typeof calculateWalls>[0]['catalogs'],
      })
      quoteWallScopes = (wallCalculations.scopes ?? []) as Unsafe[]
      const ceilingCalculations = calculateCeilings({
        scopes: ceilingScopes,
        segments: ceilingSegments,
        settings: {
          labor_rate_per_hour: effectiveLaborRate,
        },
        catalogs: catalogs.catalogs as Parameters<typeof calculateCeilings>[0]['catalogs'],
      })
      quoteCeilingScopes = (ceilingCalculations.scopes ?? []) as Unsafe[]
      const trimCalculations = calculateTrim({
        scopes: trimScopes,
        rooms: rooms.map((row) => {
          const roomId = asText(row.room_id).toUpperCase()
          return {
            room_id: roomId,
            length_in: row.length_in == null ? null : Number(row.length_in),
            width_in: row.width_in == null ? null : Number(row.width_in),
            mode: roomModeById.get(roomId) ?? 'RECT',
          }
        }),
        settings: {
          labor_rate_per_hour: effectiveLaborRate,
        },
        catalogs: catalogs.catalogs as unknown as Parameters<typeof calculateTrim>[0]['catalogs'],
      })
      quoteTrimScopes = (trimCalculations.scopes ?? []) as Unsafe[]
      const trimPaint = buildTrimPaintInput({
        jobsettings: jobsettings as Unsafe,
        catalogs: productMap(catalogs.catalogs as unknown as Parameters<typeof productMap>[0]),
      })
      pricingSummary = buildEstimatePricingSummary(
        [wallCalculations, ceilingCalculations, trimCalculations],
        {
          enabled: effectiveLaborDayEnabled !== false,
          dayhours: effectiveDayhours,
          roundingIncrementHours: effectiveRoundingIncrement,
        },
        {
          enabled: effectiveJobMinimumEnabled === true,
          amount: effectiveJobMinimumAmount,
        },
        trimPaint
      )
    }
  } catch {
    pricingSummary = null
  }

  return {
    estimate,
    job: {
      ...job,
      customer_name: customer.name ?? '',
      customer_email: customer.email ?? '',
      customer_phone: customer.phone ?? '',
      customer_address: customer.address ?? '',
    },
    customer,
    company,
    settings: {
      default_template_key: quoteDefaults.default_template_key,
      quote_validity_days: quoteDefaults.quote_validity_days,
      terms_text: quoteDefaults.terms_text,
      updated_at: null,
    },
    inputs: {
      rooms: (roomsRes.data ?? []) as Unsafe[],
      room_wall_scopes: quoteWallScopes,
      segments: (segmentsRes.data ?? []) as Unsafe[],
      wall_segments: (wallSegmentsRes.data ?? []) as Unsafe[],
      ceiling_segments: (ceilingSegmentsRes.data ?? []) as Unsafe[],
      room_ceiling_scopes: quoteCeilingScopes,
      ceiling_scope_segments: (ceilingScopeSegmentsRes.data ?? []) as Unsafe[],
      room_trim_scopes: quoteTrimScopes,
      trim_items: (trimItemsRes.data ?? []) as Unsafe[],
      other: (otherRes.data ?? []) as Unsafe[],
      jobsettings,
    },
    catalogs: catalogs?.catalogs ?? null,
    pricing_summary: pricingSummary ? { finalTotal: pricingSummary.finalTotal ?? null } : null,
    latest_public_version: previewVersion,
    latest_sent_version: latestSentVersion,
    latest_draft_version: latestDraftVersion,
    public_url: publicUrl,
    public_versions: publicVersions,
  } as const
}

export function buildCustomerDocumentFromSendContext(params: {
  context: Awaited<ReturnType<typeof loadEstimateCustomerSendContext>>
  overrides?: {
    title?: string
    intro_paragraph?: string
    closing_paragraph?: string
    quote_validity_days?: number | string | null
    deposit_language?: string
    card_fee_note?: string
  }
  publicMeta?: {
    status?: string
    sent_at?: string | null
    viewed_at?: string | null
    accepted_at?: string | null
    declined_at?: string | null
    public_token?: string | null
  }
}) {
  if ('error' in params.context) {
    return params.context
  }
  return buildCustomerEstimateDocument({
    estimate: params.context.estimate as Unsafe,
    job: params.context.job as Unsafe,
    customer: (params.context as Unsafe).customer as Unsafe | null | undefined,
    company: params.context.company,
    inputs: params.context.inputs,
    catalogs: params.context.catalogs as Unsafe | null,
    settings: params.context.settings as
      | {
          default_template_key?: string | null
          quote_validity_days?: number | null
          terms_text?: string | null
        }
      | undefined,
    pricingSummary: (params.context as Unsafe).pricing_summary as { finalTotal: number | null } | null | undefined,
    overrides: params.overrides,
    publicMeta: params.publicMeta,
  })
}
