import {
  buildDefaultQuoteVersionName,
  normalizeQuoteVersionKind,
} from '@/lib/quotes/versionCreation'
import {
  buildQuoteHomeRecentActivityReadModel,
  buildQuoteHomeSearchReadModel,
  buildQuoteJobVersionsReadModel,
  buildQuoteListPayload,
} from '@/lib/quotes/collectionData'
import {
  jsonError,
  readJsonBody,
  resolveParams,
  readUuidParam,
  requireSessionUserOrg,
} from '@/lib/server/apiRoute'
import {
  loadDecoratedEstimateCollectionRows,
  loadDecoratedEstimateRowsForJob,
  loadDecoratedRecentEstimateRows,
  loadQuoteHomeJobVersionCounts,
  loadQuoteHomeSummary,
  searchDecoratedEstimateRows,
} from '@/lib/server/estimateCollectionData'
import { loadEstimateTemplateSettings } from '@/lib/server/estimateTemplateSettings'
import { supabaseAdmin } from '@/lib/server/org'
import {
  serviceResultDataResponse,
  serviceResultMutationResponse,
} from '@/lib/server/routeResult'
import {
  errorResult,
  okResult,
  type ServiceResult,
} from '@/lib/server/serviceResult'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const VERSION_STATES = new Set(['draft', 'live', 'archived'])

type CreateEstimateCollectionCopy = {
  createdNotice: string
  defaultVersionName: (versionSortOrder: number) => string
}

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

function asText(value: unknown) {
  return String(value ?? '').trim()
}

function asOptionalNumber(value: unknown) {
  if (value == null || value === '') return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

async function loadEstimateCollectionPayload(
  orgId: string
): Promise<ServiceResult<ReturnType<typeof buildQuoteListPayload>>> {
  const rowsResult = await loadDecoratedEstimateCollectionRows(orgId, { includeRollups: false })
  if (!rowsResult.ok) return rowsResult
  return okResult(buildQuoteListPayload(rowsResult.data))
}

async function loadEstimateHomeSummaryPayload(orgId: string) {
  return loadQuoteHomeSummary(orgId)
}

async function loadEstimateHomeRecentActivityPayload(orgId: string) {
  const rowsResult = await loadDecoratedRecentEstimateRows(orgId, { includeRollups: true })
  if (!rowsResult.ok) return rowsResult
  return okResult(buildQuoteHomeRecentActivityReadModel(rowsResult.data))
}

async function loadEstimateHomeSearchPayload(orgId: string, query: string) {
  const rowsResult = await searchDecoratedEstimateRows(orgId, query, { includeRollups: true })
  if (!rowsResult.ok) return rowsResult
  return okResult(buildQuoteHomeSearchReadModel(rowsResult.data, query))
}

async function loadEstimateHomeJobCountsPayload(orgId: string) {
  return loadQuoteHomeJobVersionCounts(orgId)
}

async function loadEstimateJobVersionsPayload(orgId: string, jobId: string) {
  const rowsResult = await loadDecoratedEstimateRowsForJob(orgId, jobId, { includeRollups: true })
  if (!rowsResult.ok) return rowsResult
  return okResult(buildQuoteJobVersionsReadModel(rowsResult.data, jobId))
}

async function createEstimateCollectionVersion(params: {
  orgId: string
  userId: string
  body: Record<string, unknown>
  copy: CreateEstimateCollectionCopy
}): Promise<ServiceResult<{ id: string; estimate: EstimateRow }>> {
  const jobId = asText(params.body.job_id)
  if (!uuid.test(jobId)) return errorResult('invalid_input', 'Invalid job_id')

  const jobRes = await supabaseAdmin
    .from('jobs')
    .select('id, customer_id')
    .eq('org_id', params.orgId)
    .eq('id', jobId)
    .maybeSingle()

  if (jobRes.error) return errorResult('server_error', jobRes.error.message)
  if (!jobRes.data) return errorResult('not_found', 'Job not found')

  const customerId = asText(params.body.customer_id ?? jobRes.data.customer_id)
  if (!uuid.test(customerId)) {
    return errorResult('invalid_input', 'Invalid customer_id')
  }

  const requestedVersionState = asText(params.body.version_state).toLowerCase()
  const requestedVersionKind = asText(params.body.version_kind)
  const versionState = VERSION_STATES.has(requestedVersionState) ? requestedVersionState : 'draft'
  const versionKind = normalizeQuoteVersionKind(requestedVersionKind)

  const latestSortRes = await supabaseAdmin
    .from('estimates')
    .select('version_sort_order')
    .eq('org_id', params.orgId)
    .eq('job_id', jobId)
    .order('version_sort_order', { ascending: false })
    .limit(1)

  if (latestSortRes.error) {
    return errorResult('server_error', latestSortRes.error.message)
  }

  const existingSort = asOptionalNumber(latestSortRes.data?.[0]?.version_sort_order)
  const requestedSortOrder = asOptionalNumber(params.body.version_sort_order)
  const versionSortOrder =
    requestedSortOrder != null
      ? Math.max(0, Math.trunc(requestedSortOrder))
      : (existingSort ?? -1) + 1
  const versionName =
    asText(params.body.version_name) || params.copy.defaultVersionName(versionSortOrder)

  const createRes = await supabaseAdmin
    .from('estimates')
    .insert({
      org_id: params.orgId,
      job_id: jobId,
      customer_id: customerId,
      status: 'draft',
      version_name: versionName,
      version_state: versionState,
      version_kind: versionKind,
      version_sort_order: versionSortOrder,
      created_by: params.userId,
    })
    .select(
      'id, job_id, customer_id, status, version_name, version_state, version_kind, version_sort_order, created_at, updated_at'
    )
    .single()

  if (createRes.error) {
    return errorResult('server_error', createRes.error.message)
  }

  const estimateId = createRes.data.id
  const templateDefaults = await loadEstimateTemplateSettings(params.orgId).catch(() => null)
  const settingsInsert = await supabaseAdmin.from('estimate_jobsettings').insert({
    org_id: params.orgId,
    estimate_id: estimateId,
    job_id: jobId,
    walls_paint_id: templateDefaults?.walls_paint_id ?? null,
    walls_primer_id: templateDefaults?.walls_primer_id ?? null,
    ceiling_paint_id: templateDefaults?.ceiling_paint_id ?? null,
    ceiling_primer_id: templateDefaults?.ceiling_primer_id ?? null,
    trim_paint_id: templateDefaults?.trim_paint_id ?? null,
    trim_primer_id: templateDefaults?.trim_primer_id ?? null,
    primer_id:
      templateDefaults?.walls_primer_id ??
      templateDefaults?.ceiling_primer_id ??
      templateDefaults?.trim_primer_id ??
      null,
    labor_day_policy_enabled: templateDefaults?.labor_day_policy_enabled,
    dayhours: templateDefaults?.dayhours ?? null,
    rounding_increment_hours: templateDefaults?.rounding_increment_hours ?? null,
    override_labor_rate: templateDefaults?.override_labor_rate ?? null,
    job_minimum_enabled: templateDefaults?.job_minimum_enabled,
    job_minimum_amount: templateDefaults?.job_minimum_amount ?? null,
  })

  if (settingsInsert.error) {
    await supabaseAdmin.from('estimates').delete().eq('org_id', params.orgId).eq('id', estimateId)
    return errorResult('server_error', settingsInsert.error.message)
  }

  const pricingPolicyInsert = await supabaseAdmin.from('estimate_pricing_policies').insert({
    org_id: params.orgId,
    estimate_id: estimateId,
    job_id: jobId,
  })

  if (pricingPolicyInsert.error) {
    await supabaseAdmin
      .from('estimate_jobsettings')
      .delete()
      .eq('org_id', params.orgId)
      .eq('estimate_id', estimateId)
    await supabaseAdmin.from('estimates').delete().eq('org_id', params.orgId).eq('id', estimateId)
    return errorResult('server_error', pricingPolicyInsert.error.message)
  }

  return okResult({
    id: estimateId,
    estimate: createRes.data as EstimateRow,
  })
}

export async function handleEstimateCollectionRouteGet() {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  return serviceResultDataResponse(await loadEstimateCollectionPayload(auth.session.orgId))
}

export async function handleEstimateHomeSummaryRouteGet() {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  return serviceResultDataResponse(await loadEstimateHomeSummaryPayload(auth.session.orgId))
}

export async function handleEstimateHomeRecentActivityRouteGet() {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  return serviceResultDataResponse(await loadEstimateHomeRecentActivityPayload(auth.session.orgId))
}

export async function handleEstimateHomeJobCountsRouteGet() {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  return serviceResultDataResponse(await loadEstimateHomeJobCountsPayload(auth.session.orgId))
}

export async function handleEstimateHomeSearchRouteGet(request: Request) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const query = new URL(request.url).searchParams.get('q') ?? ''
  return serviceResultDataResponse(
    await loadEstimateHomeSearchPayload(auth.session.orgId, query)
  )
}

export type EstimateJobVersionsRouteContext = {
  params: { jobId: string } | Promise<{ jobId: string }>
}

export async function handleEstimateJobVersionsRouteGet(
  _request: Request,
  context: EstimateJobVersionsRouteContext
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await resolveParams(context)
  const jobId = readUuidParam(params?.jobId, 'job id')
  if (!jobId.ok) return jobId.response

  return serviceResultDataResponse(
    await loadEstimateJobVersionsPayload(auth.session.orgId, jobId.value)
  )
}

export async function handleEstimateCollectionRoutePost(
  request: Request,
  copy: CreateEstimateCollectionCopy
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const body = await readJsonBody<Record<string, unknown>>(request)
  if (!body.ok) return body.response

  const result = await createEstimateCollectionVersion({
    orgId: auth.session.orgId,
    userId: auth.session.userId,
    body: body.value ?? {},
    copy,
  })

  if (!result.ok) {
    if (result.kind === 'invalid_input') {
      return jsonError(result.message, 400)
    }
    if (result.kind === 'not_found') {
      return jsonError(result.message, 404)
    }
  }

  return serviceResultMutationResponse(result, copy.createdNotice)
}

export const quoteEstimateCollectionCopy: CreateEstimateCollectionCopy = {
  createdNotice: 'Quote version created.',
  defaultVersionName: buildDefaultQuoteVersionName,
}

export const estimateCollectionCopy: CreateEstimateCollectionCopy = {
  createdNotice: 'Estimate version created.',
  defaultVersionName: (versionSortOrder) => `Estimate Version ${versionSortOrder + 1}`,
}
