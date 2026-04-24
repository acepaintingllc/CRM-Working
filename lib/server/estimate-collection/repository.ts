import { normalizeQuoteVersionKind } from '../../quotes/versionCreation.ts'
import { hasUniqueConstraintConflict } from '../dbErrors.ts'
import { isMissingSchemaErrorMessage } from '../schema.ts'
import { supabaseAdmin } from '../org.ts'
import { errorResult, okResult, type ServiceResult } from '../serviceResult.ts'
import type {
  EstimateCollectionCustomerRow,
  EstimateCollectionJobRow,
  EstimateCollectionRelatedRows,
  EstimateCollectionRollupRow,
  EstimateCollectionVersionCopy,
  EstimateCollectionVersionRow,
  QuoteHomeJobsPageRow,
  QuoteHomeSummaryRow,
} from './types'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const VERSION_STATES = new Set(['draft', 'live', 'archived'])
const quoteHomeCursorSeparator = '::'
const quoteHomeNullCursorTimestamp = 'null'
const quoteHomeDefaultPageLimit = 25
const quoteHomeMaxPageLimit = 100

const estimateSelect =
  'id, job_id, customer_id, status, version_name, version_state, version_kind, version_sort_order, created_at, updated_at'

function asText(value: unknown) {
  return String(value ?? '').trim()
}

function asMoney(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function asTimestamp(value: string | null | undefined) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function asPositiveInteger(value: number | null | undefined, fallback: number, maximum: number) {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.max(1, Math.min(maximum, Math.trunc(next)))
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}

export function encodeQuoteHomeCursor(value: {
  timestamp: string | null | undefined
  id: string | null | undefined
}) {
  if (!value.id) return null
  return `${value.timestamp ?? quoteHomeNullCursorTimestamp}${quoteHomeCursorSeparator}${value.id}`
}

export function decodeQuoteHomeCursor(cursor: string | null | undefined) {
  const rawCursor = String(cursor ?? '').trim()
  if (!rawCursor) {
    return { ok: true as const, value: null }
  }

  const parts = rawCursor.split(quoteHomeCursorSeparator)
  if (parts.length !== 2) {
    return { ok: false as const, message: 'Invalid cursor.' }
  }

  const [timestamp, id] = parts
  if (!timestamp || !uuid.test(id)) {
    return { ok: false as const, message: 'Invalid cursor.' }
  }

  if (timestamp === quoteHomeNullCursorTimestamp) {
    return {
      ok: true as const,
      value: {
        timestamp: null,
        id,
      },
    }
  }

  const parsedTimestamp = new Date(timestamp)
  if (Number.isNaN(parsedTimestamp.getTime())) {
    return { ok: false as const, message: 'Invalid cursor.' }
  }

  return {
    ok: true as const,
    value: {
      timestamp: parsedTimestamp.toISOString(),
      id,
    },
  }
}

function compareQuoteHomeCursorKeys(
  left: { timestamp: string | null | undefined; id: string },
  right: { timestamp: string | null | undefined; id: string }
) {
  const leftHasTimestamp = Boolean(left.timestamp)
  const rightHasTimestamp = Boolean(right.timestamp)
  if (leftHasTimestamp && rightHasTimestamp) {
    const timestampDiff = asTimestamp(right.timestamp) - asTimestamp(left.timestamp)
    if (timestampDiff !== 0) return timestampDiff
  } else if (leftHasTimestamp !== rightHasTimestamp) {
    return leftHasTimestamp ? -1 : 1
  }

  return right.id.localeCompare(left.id)
}

function isAfterQuoteHomeCursor(
  row: { timestamp: string | null | undefined; id: string },
  cursor: { timestamp: string | null; id: string }
) {
  return compareQuoteHomeCursorKeys(row, cursor) > 0
}

export function normalizeEstimateCollectionVersionState(value: string | null | undefined) {
  return value?.trim() || 'draft'
}

export function isSentEstimateCollectionJob(job: EstimateCollectionJobRow | undefined) {
  if (!job) return false
  return job.status === 'estimate_sent' || job.status === 'follow_up'
}

export async function loadEstimateCollectionRowsForOrg(
  orgId: string,
  options?: {
    jobId?: string
    limit?: number
  }
): Promise<ServiceResult<EstimateCollectionVersionRow[]>> {
  let query = supabaseAdmin
    .from('estimates')
    .select(estimateSelect)
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })

  if (options?.jobId) {
    query = query.eq('job_id', options.jobId)
  }
  if (typeof options?.limit === 'number') {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (error) {
    return errorResult('server_error', error.message)
  }

  return okResult((data ?? []) as EstimateCollectionVersionRow[])
}

export async function loadEstimateCollectionSummary(
  orgId: string
): Promise<ServiceResult<QuoteHomeSummaryRow | null>> {
  const { data, error } = await supabaseAdmin.rpc('quote_home_summary', {
    p_org_id: orgId,
  })

  if (error) {
    if (isMissingSchemaErrorMessage(error.message)) {
      return errorResult(
        'server_error',
        'quote_home_summary RPC is missing. Run the latest SQL migrations.'
      )
    }
    return errorResult('server_error', error.message)
  }

  return okResult(Array.isArray(data) ? ((data[0] ?? null) as QuoteHomeSummaryRow | null) : null)
}

export async function loadEstimateCollectionJobsPage(
  orgId: string,
  options?: {
    query?: string
    limit?: number
    cursor?: string | null
  }
): Promise<
  ServiceResult<{
    query: string
    limit: number
    rows: QuoteHomeJobsPageRow[]
  }>
> {
  const limit = asPositiveInteger(options?.limit, quoteHomeDefaultPageLimit, quoteHomeMaxPageLimit)
  const query = asText(options?.query)
  const cursorResult = decodeQuoteHomeCursor(options?.cursor)
  if (!cursorResult.ok) {
    return errorResult('invalid_input', cursorResult.message)
  }
  if (cursorResult.value?.timestamp === null) {
    return errorResult('invalid_input', 'Invalid cursor.')
  }

  const { data, error } = await supabaseAdmin.rpc('quote_home_jobs_page', {
    p_org_id: orgId,
    p_search: query || null,
    p_limit: limit + 1,
    p_cursor_created_at: cursorResult.value?.timestamp ?? null,
    p_cursor_id: cursorResult.value?.id ?? null,
  })

  if (error) {
    if (isMissingSchemaErrorMessage(error.message)) {
      return errorResult(
        'server_error',
        'quote_home_jobs_page RPC is missing. Run the latest SQL migrations.'
      )
    }
    return errorResult('server_error', error.message)
  }

  const sortedRows = ((data ?? []) as QuoteHomeJobsPageRow[]).sort((left, right) =>
    compareQuoteHomeCursorKeys(
      { timestamp: left.created_at, id: left.id },
      { timestamp: right.created_at, id: right.id }
    )
  )
  return okResult({
    query,
    limit,
    rows: sortedRows,
  })
}

export async function loadEstimateCollectionJobVersionsPage(
  orgId: string,
  jobId: string,
  options?: {
    limit?: number
    cursor?: string | null
  }
): Promise<
  ServiceResult<{
    jobId: string
    totalVersions: number
    limit: number
    nextCursor: string | null
    items: EstimateCollectionVersionRow[]
  }>
> {
  const limit = asPositiveInteger(options?.limit, quoteHomeDefaultPageLimit, quoteHomeMaxPageLimit)
  const cursorResult = decodeQuoteHomeCursor(options?.cursor)
  if (!cursorResult.ok) {
    return errorResult('invalid_input', cursorResult.message)
  }

  const [countRes, rowsRes] = await Promise.all([
    supabaseAdmin
      .from('estimates')
      .select('id', { head: true, count: 'exact' })
      .eq('org_id', orgId)
      .eq('job_id', jobId),
    (() => {
      let query = supabaseAdmin
        .from('estimates')
        .select(estimateSelect)
        .eq('org_id', orgId)
        .eq('job_id', jobId)
        .order('updated_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1)

      const cursor = cursorResult.value
      if (cursor) {
        query =
          cursor.timestamp === null
            ? query.or(`and(updated_at.is.null,id.lt.${cursor.id})`)
            : query.or(
                [
                  `updated_at.lt.${cursor.timestamp}`,
                  'updated_at.is.null',
                  `and(updated_at.eq.${cursor.timestamp},id.lt.${cursor.id})`,
                ].join(',')
              )
      }

      return query
    })(),
  ])

  if (countRes.error) {
    return errorResult('server_error', countRes.error.message)
  }
  if (rowsRes.error) {
    return errorResult('server_error', rowsRes.error.message)
  }

  const rawRows = ((rowsRes.data ?? []) as EstimateCollectionVersionRow[]).sort((left, right) =>
    compareQuoteHomeCursorKeys(
      { timestamp: left.updated_at, id: left.id },
      { timestamp: right.updated_at, id: right.id }
    )
  )

  const filteredRows = cursorResult.value
    ? rawRows.filter((row) =>
        isAfterQuoteHomeCursor(
          { timestamp: row.updated_at, id: row.id },
          cursorResult.value!
        )
      )
    : rawRows

  const pageRows = filteredRows.slice(0, limit)
  const nextCursor =
    filteredRows.length > limit
      ? encodeQuoteHomeCursor({
          timestamp: pageRows[pageRows.length - 1]?.updated_at,
          id: pageRows[pageRows.length - 1]?.id,
        })
      : null

  return okResult({
    jobId,
    totalVersions: Number(countRes.count ?? 0),
    limit,
    nextCursor,
    items: pageRows,
  })
}

async function loadEstimateCollectionRowsByLookup(
  orgId: string,
  options: {
    jobIds?: string[]
    customerIds?: string[]
    limit: number
  }
): Promise<ServiceResult<EstimateCollectionVersionRow[]>> {
  let query = supabaseAdmin
    .from('estimates')
    .select(estimateSelect)
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })
    .limit(options.limit)

  if (options.jobIds?.length) {
    query = query.in('job_id', options.jobIds)
  }
  if (options.customerIds?.length) {
    query = query.in('customer_id', options.customerIds)
  }

  const { data, error } = await query
  if (error) {
    return errorResult('server_error', error.message)
  }

  return okResult((data ?? []) as EstimateCollectionVersionRow[])
}

export async function searchEstimateCollectionRows(
  orgId: string,
  rawQuery: string,
  limit: number
): Promise<
  ServiceResult<{
    query: string
    limit: number
    versionRows: EstimateCollectionVersionRow[]
    jobRows: EstimateCollectionVersionRow[]
    customerRows: EstimateCollectionVersionRow[]
  }>
> {
  const query = rawQuery.trim()
  if (!query) {
    return okResult({ query, limit, versionRows: [], jobRows: [], customerRows: [] })
  }

  const pattern = `%${escapeLikePattern(query)}%`
  const estimateSearchPattern = `%${escapeLikePattern(query.replace(/[(),]/g, ' ').trim())}%`

  const [versionMatchesRes, jobsRes, customersRes] = await Promise.all([
    supabaseAdmin
      .from('estimates')
      .select(estimateSelect)
      .eq('org_id', orgId)
      .or(
        [
          `version_name.ilike.${estimateSearchPattern}`,
          `version_kind.ilike.${estimateSearchPattern}`,
          `version_state.ilike.${estimateSearchPattern}`,
        ].join(',')
      )
      .order('updated_at', { ascending: false })
      .limit(limit),
    supabaseAdmin
      .from('jobs')
      .select('id')
      .eq('org_id', orgId)
      .ilike('title', pattern)
      .limit(limit),
    supabaseAdmin
      .from('customers')
      .select('id')
      .eq('org_id', orgId)
      .ilike('name', pattern)
      .limit(limit),
  ])

  if (versionMatchesRes.error) {
    return errorResult('server_error', versionMatchesRes.error.message)
  }
  if (jobsRes.error) {
    return errorResult('server_error', jobsRes.error.message)
  }
  if (customersRes.error) {
    return errorResult('server_error', customersRes.error.message)
  }

  const matchedJobIds = (jobsRes.data ?? []).map((row) => String(row.id ?? '')).filter(Boolean)
  const matchedCustomerIds = (customersRes.data ?? [])
    .map((row) => String(row.id ?? ''))
    .filter(Boolean)

  const [jobRowsResult, customerRowsResult] = await Promise.all([
    matchedJobIds.length
      ? loadEstimateCollectionRowsByLookup(orgId, {
          jobIds: matchedJobIds,
          limit,
        })
      : Promise.resolve(okResult([] as EstimateCollectionVersionRow[])),
    matchedCustomerIds.length
      ? loadEstimateCollectionRowsByLookup(orgId, {
          customerIds: matchedCustomerIds,
          limit,
        })
      : Promise.resolve(okResult([] as EstimateCollectionVersionRow[])),
  ])

  if (!jobRowsResult.ok) return jobRowsResult
  if (!customerRowsResult.ok) return customerRowsResult

  return okResult({
    query,
    limit,
    versionRows: (versionMatchesRes.data ?? []) as EstimateCollectionVersionRow[],
    jobRows: jobRowsResult.data,
    customerRows: customerRowsResult.data,
  })
}

export async function loadEstimateCollectionRelatedRows(
  orgId: string,
  estimateRows: EstimateCollectionVersionRow[],
  options: { includeRollups: boolean }
): Promise<ServiceResult<EstimateCollectionRelatedRows>> {
  const jobIds = Array.from(new Set(estimateRows.map((row) => row.job_id).filter(Boolean)))
  const customerIds = Array.from(new Set(estimateRows.map((row) => row.customer_id).filter(Boolean)))
  const estimateIds = estimateRows.map((row) => row.id)

  const [jobsRes, customersRes] = await Promise.all([
    jobIds.length
      ? supabaseAdmin
          .from('jobs')
          .select('id, title, status, estimate_sent_at')
          .eq('org_id', orgId)
          .in('id', jobIds)
      : Promise.resolve({ data: [], error: null }),
    customerIds.length
      ? supabaseAdmin
          .from('customers')
          .select('id, name')
          .eq('org_id', orgId)
          .in('id', customerIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (jobsRes.error) return errorResult('server_error', jobsRes.error.message)
  if (customersRes.error) return errorResult('server_error', customersRes.error.message)

  let rollupRows: EstimateCollectionRollupRow[] = []
  if (options.includeRollups && estimateIds.length) {
    const rollupsRes = await supabaseAdmin
      .from('estimate_version_rollups')
      .select('estimate_id, final_total')
      .eq('org_id', orgId)
      .in('estimate_id', estimateIds)

    if (rollupsRes.error) {
      if (!isMissingSchemaErrorMessage(rollupsRes.error.message)) {
        return errorResult('server_error', rollupsRes.error.message)
      }
    } else {
      rollupRows = (rollupsRes.data ?? []) as EstimateCollectionRollupRow[]
    }
  }

  return okResult({
    jobs: (jobsRes.data ?? []) as EstimateCollectionJobRow[],
    customers: (customersRes.data ?? []) as EstimateCollectionCustomerRow[],
    rollups: rollupRows,
  })
}

export async function createEstimateCollectionVersionRecord(params: {
  orgId: string
  userId: string
  body: Record<string, unknown>
  copy: EstimateCollectionVersionCopy
  _deps?: Partial<{
    rpc: typeof supabaseAdmin.rpc
    hasUniqueConstraintConflict: typeof hasUniqueConstraintConflict
  }>
}): Promise<ServiceResult<{ id: string; estimate: EstimateCollectionVersionRow }>> {
  const { rpc, hasUniqueConstraintConflict: checkConflict } = {
    rpc: supabaseAdmin.rpc.bind(supabaseAdmin),
    hasUniqueConstraintConflict,
    ...(params as {
      _deps?: Partial<{
        rpc: typeof supabaseAdmin.rpc
        hasUniqueConstraintConflict: typeof hasUniqueConstraintConflict
      }>
    })._deps,
  }

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

  const rpcResult = await rpc('create_estimate_version', {
    p_org_id: params.orgId,
    p_user_id: params.userId,
    p_job_id: jobId,
    p_customer_id: customerId || null,
    p_version_state: versionState,
    p_version_kind: requestedVersionKind,
    p_version_name: versionName,
    p_default_version_label: params.copy.defaultVersionLabel,
  })

  if (rpcResult.error) {
    if (checkConflict(rpcResult.error)) {
      return errorResult('conflict', 'Another version was created at the same time. Please retry.')
    }
    return errorResult('server_error', rpcResult.error.message)
  }

  const payload = (rpcResult.data ?? null) as
    | {
        ok?: boolean
        error_kind?: string | null
        error_message?: string | null
        id?: string | null
        estimate?: EstimateCollectionVersionRow | null
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
    estimate: payload.estimate as EstimateCollectionVersionRow,
  })
}

export async function loadEstimateCollectionRollupSummary(params: {
  orgId: string
  estimateRows: EstimateCollectionVersionRow[]
}): Promise<
  ServiceResult<{
    jobsById: Map<string, EstimateCollectionJobRow>
    totalsByEstimateId: Map<string, number | null>
  }>
> {
  const jobIds = Array.from(new Set(params.estimateRows.map((row) => row.job_id).filter(Boolean)))
  const estimateIds = params.estimateRows.map((row) => row.id)

  const [jobsRes, rollupsRes] = await Promise.all([
    jobIds.length
      ? supabaseAdmin.from('jobs').select('id, status').eq('org_id', params.orgId).in('id', jobIds)
      : Promise.resolve({ data: [], error: null }),
    estimateIds.length
      ? supabaseAdmin
          .from('estimate_version_rollups')
          .select('estimate_id, final_total')
          .eq('org_id', params.orgId)
          .in('estimate_id', estimateIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (jobsRes.error) {
    return errorResult('server_error', jobsRes.error.message)
  }
  if (rollupsRes.error && !isMissingSchemaErrorMessage(rollupsRes.error.message)) {
    return errorResult('server_error', rollupsRes.error.message)
  }

  return okResult({
    jobsById: new Map((jobsRes.data ?? []).map((row) => [row.id, row as EstimateCollectionJobRow])),
    totalsByEstimateId: new Map(
      (((rollupsRes as { data?: EstimateCollectionRollupRow[] }).data ?? []) as EstimateCollectionRollupRow[]).map(
        (row) => [row.estimate_id, asMoney(row.final_total)]
      )
    ),
  })
}

export async function loadEstimateCollectionEligibleJobs(
  orgId: string
): Promise<ServiceResult<QuoteHomeJobsPageRow[]>> {
  const jobsPage = await loadEstimateCollectionJobsPage(orgId, { limit: 100 })
  if (!jobsPage.ok) return jobsPage
  return okResult(jobsPage.data.rows)
}
