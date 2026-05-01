import { getEstimateCatalogs } from '@/lib/server/estimateCatalogs'
import { supabaseAdmin } from '@/lib/server/org'
import { loadCompanyProfileSettings } from '@/lib/server/settings/companyProfileStore'
import { loadQuoteSendDefaults } from '@/lib/server/settings/quoteSendDefaultsStore'
import { defaultQuoteTermsSections } from '@/lib/customer-estimates/termsDefaults'
import { templatePresets } from '@/lib/customer-estimates/presets'
import type { CompanyProfile, Unsafe } from '@/lib/customer-estimates/types'
import type {
  EstimateCustomerSendCoreResources,
  EstimateCustomerSendCustomerRow,
  EstimateCustomerSendEstimateRow,
  EstimateCustomerSendJobRow,
  EstimateCustomerSendScopeResources,
  EstimateCustomerSendVersionResources,
  EstimateJobSettingsRow,
  EstimateTemplateSettingsRow,
  QuoteSendDefaults,
} from './contextTypes'

const DEFAULT_COMPANY: CompanyProfile = {
  business_name: '',
  timezone: 'America/Chicago',
  main_phone: '',
  business_email: '',
  address: '',
  website: '',
  sender_signature: '',
  logo_url: '',
}

const DEFAULT_QUOTE_SEND_DEFAULTS: QuoteSendDefaults = {
  default_template_key: 'default',
  quote_validity_days: 90,
  terms_text: '',
  terms_sections: defaultQuoteTermsSections,
  template_presets: templatePresets,
}

type QueryError = { error: string }

type QueryResult<T> = {
  data: T | null
  error: { message: string } | null
}

function asQueryError(message: string): QueryError {
  return { error: message }
}

function readRequiredQueryResult<T>(result: QueryResult<T>, fallbackMessage?: string) {
  if (result.error) return asQueryError(result.error.message)
  if (!result.data) return asQueryError(fallbackMessage ?? 'Not found')
  return result.data
}

function readOptionalQueryResult<T>(result: QueryResult<T>, fallback: T): T | QueryError {
  if (result.error) return asQueryError(result.error.message)
  return result.data ?? fallback
}

function readCollectionQueryResult<T>(result: QueryResult<T[]>) {
  if (result.error) return asQueryError(result.error.message)
  return (result.data ?? []) as T[]
}

export async function loadEstimateCustomerSendEstimate(params: {
  orgId: string
  estimateId: string
}): Promise<EstimateCustomerSendEstimateRow | QueryError> {
  const estimateRes = await supabaseAdmin
    .from('estimates')
    .select(
      'id, job_id, customer_id, status, version_name, version_state, version_kind, version_sort_order, created_at, updated_at'
    )
    .eq('org_id', params.orgId)
    .eq('id', params.estimateId)
    .maybeSingle()

  return readRequiredQueryResult(
    estimateRes as QueryResult<EstimateCustomerSendEstimateRow>,
    'Quote not found'
  )
}

export async function loadEstimateCustomerSendCoreResources(params: {
  orgId: string
  estimateId: string
  estimate: EstimateCustomerSendEstimateRow
}): Promise<EstimateCustomerSendCoreResources | QueryError> {
  const [
    jobRes,
    customerRes,
    companyProfileRes,
    quoteDefaultsRes,
    settingsRes,
    jobsettingsRes,
  ] = await Promise.all([
    supabaseAdmin
      .from('jobs')
      .select('id, title, estimate_date')
      .eq('org_id', params.orgId)
      .eq('id', params.estimate.job_id)
      .maybeSingle(),
    supabaseAdmin
      .from('customers')
      .select('id, name, email, phone, address, street, city, state, zip')
      .eq('org_id', params.orgId)
      .eq('id', params.estimate.customer_id)
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
  ])

  const job = readOptionalQueryResult(
    jobRes as QueryResult<EstimateCustomerSendJobRow>,
    {} as EstimateCustomerSendJobRow
  )
  if ('error' in job) return job

  const customer = readOptionalQueryResult(
    customerRes as QueryResult<EstimateCustomerSendCustomerRow>,
    {} as EstimateCustomerSendCustomerRow
  )
  if ('error' in customer) return customer

  const settingsRow = readOptionalQueryResult(
    settingsRes as QueryResult<EstimateTemplateSettingsRow>,
    {} as EstimateTemplateSettingsRow
  )
  if ('error' in settingsRow) return settingsRow

  const jobsettings = readOptionalQueryResult(
    jobsettingsRes as QueryResult<EstimateJobSettingsRow>,
    {} as EstimateJobSettingsRow
  )
  if ('error' in jobsettings) return jobsettings

  return {
    job,
    customer,
    company: (companyProfileRes ?? DEFAULT_COMPANY) as CompanyProfile,
    quoteDefaults: (quoteDefaultsRes ?? DEFAULT_QUOTE_SEND_DEFAULTS) as QuoteSendDefaults,
    settingsRow,
    jobsettings,
  }
}

export async function loadEstimateCustomerSendScopeResources(params: {
  orgId: string
  estimateId: string
}): Promise<EstimateCustomerSendScopeResources | QueryError> {
  const [
    roomsRes,
    wallScopesRes,
    segmentsRes,
    wallSegmentsRes,
    ceilingSegmentsRes,
    ceilingScopesRes,
    ceilingScopeSegmentsRes,
    trimScopesRes,
    drywallRepairsRes,
    trimItemsRes,
    otherRes,
  ] = await Promise.all([
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
      .from('estimate_drywall_repairs')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', true)
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
  ])

  const rooms = readCollectionQueryResult(roomsRes as QueryResult<Unsafe[]>)
  if ('error' in rooms) return rooms
  const wallScopes = readCollectionQueryResult(wallScopesRes as QueryResult<Unsafe[]>)
  if ('error' in wallScopes) return wallScopes
  const segments = readCollectionQueryResult(segmentsRes as QueryResult<Unsafe[]>)
  if ('error' in segments) return segments
  const wallSegments = readCollectionQueryResult(wallSegmentsRes as QueryResult<Unsafe[]>)
  if ('error' in wallSegments) return wallSegments
  const ceilingSegments = readCollectionQueryResult(
    ceilingSegmentsRes as QueryResult<Unsafe[]>
  )
  if ('error' in ceilingSegments) return ceilingSegments
  const ceilingScopes = readCollectionQueryResult(ceilingScopesRes as QueryResult<Unsafe[]>)
  if ('error' in ceilingScopes) return ceilingScopes
  const ceilingScopeSegments = readCollectionQueryResult(
    ceilingScopeSegmentsRes as QueryResult<Unsafe[]>
  )
  if ('error' in ceilingScopeSegments) return ceilingScopeSegments
  const trimScopes = readCollectionQueryResult(trimScopesRes as QueryResult<Unsafe[]>)
  if ('error' in trimScopes) return trimScopes
  const drywallRepairs = readCollectionQueryResult(drywallRepairsRes as QueryResult<Unsafe[]>)
  if ('error' in drywallRepairs) return drywallRepairs
  const trimItems = readCollectionQueryResult(trimItemsRes as QueryResult<Unsafe[]>)
  if ('error' in trimItems) return trimItems
  const other = readCollectionQueryResult(otherRes as QueryResult<Unsafe[]>)
  if ('error' in other) return other

  return {
    rooms,
    wallScopes,
    segments,
    wallSegments,
    ceilingSegments,
    ceilingScopes,
    ceilingScopeSegments,
    trimScopes,
    drywallRepairs,
    trimItems,
    other,
  }
}

export async function loadEstimateCustomerSendVersionResources(params: {
  orgId: string
  estimateId: string
}): Promise<EstimateCustomerSendVersionResources | QueryError> {
  const versionsRes = await supabaseAdmin
    .from('estimate_public_versions')
    .select('*')
    .eq('org_id', params.orgId)
    .eq('estimate_id', params.estimateId)
    .order('version_number', { ascending: false })
    .order('created_at', { ascending: false })

  const publicVersions = readCollectionQueryResult(versionsRes as QueryResult<Unsafe[]>)
  if ('error' in publicVersions) return publicVersions

  return {
    publicVersions,
  }
}

export async function loadEstimateCustomerSendCatalogResources(params: {
  origin: string
  orgId: string
  userId: string
  estimateId: string
}) {
  const catalogs = await getEstimateCatalogs({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    estimateId: params.estimateId,
  }).catch(() => null)

  return {
    catalogs: (catalogs?.catalogs as Unsafe | null) ?? null,
  }
}
