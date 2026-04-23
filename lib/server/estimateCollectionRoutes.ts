import { normalizeQuoteVersionKind } from '@/lib/quotes/versionCreation'
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
import { hasUniqueConstraintConflict } from '@/lib/server/dbErrors'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const VERSION_STATES = new Set(['draft', 'live', 'archived'])

type CreateEstimateCollectionCopy = {
  createdNotice: string
  defaultVersionLabel: string
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

  const customerId = asText(params.body.customer_id)
  if (customerId && !uuid.test(customerId)) {
    return errorResult('invalid_input', 'Invalid customer_id')
  }

  const requestedVersionState = asText(params.body.version_state).toLowerCase()
  const requestedVersionKind = normalizeQuoteVersionKind(asText(params.body.version_kind))
  const versionState = VERSION_STATES.has(requestedVersionState) ? requestedVersionState : 'draft'
  const versionName = asText(params.body.version_name) || null

  const rpc = await supabaseAdmin.rpc('create_estimate_version', {
    p_org_id: params.orgId,
    p_user_id: params.userId,
    p_job_id: jobId,
    p_customer_id: customerId || null,
    p_version_state: versionState,
    p_version_kind: requestedVersionKind,
    p_version_name: versionName,
    p_default_version_label: params.copy.defaultVersionLabel,
  })

  if (rpc.error) {
    if (hasUniqueConstraintConflict(rpc.error)) {
      return errorResult('conflict', 'Another version was created at the same time. Please retry.')
    }
    return errorResult('server_error', rpc.error.message)
  }

  const payload = (rpc.data ?? null) as
    | {
        ok?: boolean
        error_kind?: string | null
        error_message?: string | null
        id?: string | null
        estimate?: EstimateRow | null
      }
    | null

  if (!payload?.ok) {
    const errorKind = asText(payload?.error_kind)
    const errorMessage = asText(payload?.error_message) || 'Failed to create estimate version.'
    if (errorKind === 'invalid_input') return errorResult('invalid_input', errorMessage)
    if (errorKind === 'not_found') return errorResult('not_found', errorMessage)
    if (errorKind === 'conflict') return errorResult('conflict', errorMessage)
    return errorResult('server_error', errorMessage)
  }

  return okResult({
    id: asText(payload.id),
    estimate: payload.estimate as EstimateRow,
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
  defaultVersionLabel: 'Quote Version',
}

export const estimateCollectionCopy: CreateEstimateCollectionCopy = {
  createdNotice: 'Estimate version created.',
  defaultVersionLabel: 'Estimate Version',
}
