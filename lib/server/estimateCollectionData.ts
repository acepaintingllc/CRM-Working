import { isMissingSchemaErrorMessage } from '@/lib/server/schema'
import {
  errorResult,
  okResult,
  type ServiceResult,
} from '@/lib/server/serviceResult'
import { supabaseAdmin } from './org'
import type { EstimateCollectionDecoratedRow } from '@/lib/quotes/collectionData'
import {
  buildQuoteHomeJobVersionCountsReadModel,
  buildQuoteHomeSummaryReadModel,
} from '@/lib/quotes/collectionData'

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
  status: string | null
  estimate_sent_at: string | null
}

type CustomerRow = {
  id: string
  name: string | null
}

type RollupRow = {
  estimate_id: string
  final_total: number | null
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

function normalizeVersionState(value: string | null | undefined) {
  return value?.trim() || 'draft'
}

function isSentOrAwaiting(job: JobRow | undefined) {
  if (!job) return false
  return job.status === 'estimate_sent' || job.status === 'follow_up'
}

const estimateSelect =
  'id, job_id, customer_id, status, version_name, version_state, version_kind, version_sort_order, created_at, updated_at'

async function loadEstimateRowsForOrg(
  orgId: string,
  options?: {
    jobId?: string
    limit?: number
  }
): Promise<ServiceResult<EstimateRow[]>> {
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

  return okResult((data ?? []) as EstimateRow[])
}

async function loadEstimateRowsByLookup(orgId: string, options: {
  jobIds?: string[]
  customerIds?: string[]
  limit: number
}): Promise<ServiceResult<EstimateRow[]>> {
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

  return okResult((data ?? []) as EstimateRow[])
}

async function searchEstimateRowsForOrg(
  orgId: string,
  rawQuery: string,
  limit: number
): Promise<ServiceResult<EstimateRow[]>> {
  const query = rawQuery.trim()
  if (!query) return okResult([])

  const pattern = `%${query.replace(/[%_]/g, ' ').trim()}%`
  const estimateSearchPattern = `%${query.replace(/[,%_()]/g, ' ').trim()}%`

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

  const lookupRequests: Array<Promise<ServiceResult<EstimateRow[]>>> = []
  if (matchedJobIds.length) {
    lookupRequests.push(
      loadEstimateRowsByLookup(orgId, {
        jobIds: matchedJobIds,
        limit,
      })
    )
  }
  if (matchedCustomerIds.length) {
    lookupRequests.push(
      loadEstimateRowsByLookup(orgId, {
        customerIds: matchedCustomerIds,
        limit,
      })
    )
  }

  const lookupResults = await Promise.all(lookupRequests)
  for (const result of lookupResults) {
    if (!result.ok) return result
  }

  const deduped = new Map<string, EstimateRow>()
  for (const row of (versionMatchesRes.data ?? []) as EstimateRow[]) {
    deduped.set(row.id, row)
  }
  for (const result of lookupResults) {
    if (result.ok) {
      for (const row of result.data) {
        deduped.set(row.id, row)
      }
    }
  }

  return okResult(
    Array.from(deduped.values())
      .sort((a, b) => asTimestamp(b.updated_at) - asTimestamp(a.updated_at))
      .slice(0, limit)
  )
}

async function decorateEstimateRows(
  orgId: string,
  estimateRows: EstimateRow[],
  options: { includeRollups: boolean }
): Promise<ServiceResult<EstimateCollectionDecoratedRow[]>> {
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

  let rollupRows: RollupRow[] = []
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
      rollupRows = (rollupsRes.data ?? []) as RollupRow[]
    }
  }

  const jobsById = new Map((jobsRes.data ?? []).map((row) => [row.id, row as JobRow]))
  const customersById = new Map((customersRes.data ?? []).map((row) => [row.id, row as CustomerRow]))
  const totalsByEstimateId = new Map(
    rollupRows.map((row) => [row.estimate_id, asMoney(row.final_total)])
  )

  return okResult(
    estimateRows.map((row) => {
      const job = jobsById.get(row.job_id)
      const customer = customersById.get(row.customer_id)
      return {
        id: row.id,
        estimate_id: row.id,
        job_id: row.job_id,
        customer_id: row.customer_id,
        status: row.status,
        raw_version_name: row.version_name,
        raw_version_state: row.version_state,
        raw_version_kind: row.version_kind,
        raw_version_sort_order: row.version_sort_order,
        version_name: row.version_name?.trim() || 'Quote Version',
        version_state: normalizeVersionState(row.version_state),
        version_kind: row.version_kind?.trim() || 'standard',
        version_sort_order: row.version_sort_order ?? 0,
        job_title: job?.title?.trim() || 'Untitled job',
        job_status: job?.status ?? null,
        job_estimate_sent_at: job?.estimate_sent_at ?? null,
        customer_name: customer?.name?.trim() || 'Unknown customer',
        final_total: totalsByEstimateId.get(row.id) ?? null,
        updated_at: row.updated_at,
        created_at: row.created_at,
        is_sent_estimate: isSentOrAwaiting(job),
      } satisfies EstimateCollectionDecoratedRow
    })
  )
}

export async function loadDecoratedEstimateCollectionRows(
  orgId: string,
  options: { includeRollups: boolean }
): Promise<ServiceResult<EstimateCollectionDecoratedRow[]>> {
  const estimatesResult = await loadEstimateRowsForOrg(orgId)
  if (!estimatesResult.ok) return estimatesResult

  return decorateEstimateRows(orgId, estimatesResult.data, options)
}

export async function loadDecoratedRecentEstimateRows(
  orgId: string,
  options: { includeRollups: boolean; limit?: number }
): Promise<ServiceResult<EstimateCollectionDecoratedRow[]>> {
  const estimatesResult = await loadEstimateRowsForOrg(orgId, {
    limit: options.limit ?? 12,
  })
  if (!estimatesResult.ok) return estimatesResult
  return decorateEstimateRows(orgId, estimatesResult.data, options)
}

export async function loadDecoratedEstimateRowsForJob(
  orgId: string,
  jobId: string,
  options: { includeRollups: boolean }
): Promise<ServiceResult<EstimateCollectionDecoratedRow[]>> {
  const estimatesResult = await loadEstimateRowsForOrg(orgId, { jobId })
  if (!estimatesResult.ok) return estimatesResult
  return decorateEstimateRows(orgId, estimatesResult.data, options)
}

export async function searchDecoratedEstimateRows(
  orgId: string,
  query: string,
  options: { includeRollups: boolean; limit?: number }
): Promise<ServiceResult<EstimateCollectionDecoratedRow[]>> {
  const estimatesResult = await searchEstimateRowsForOrg(orgId, query, options.limit ?? 8)
  if (!estimatesResult.ok) return estimatesResult
  return decorateEstimateRows(orgId, estimatesResult.data, options)
}

export async function loadQuoteHomeSummary(orgId: string) {
  const estimatesResult = await loadEstimateRowsForOrg(orgId)
  if (!estimatesResult.ok) return estimatesResult

  const estimateRows = estimatesResult.data
  const jobIds = Array.from(new Set(estimateRows.map((row) => row.job_id).filter(Boolean)))
  const estimateIds = estimateRows.map((row) => row.id)

  const [jobsRes, rollupsRes] = await Promise.all([
    jobIds.length
      ? supabaseAdmin
          .from('jobs')
          .select('id, status')
          .eq('org_id', orgId)
          .in('id', jobIds)
      : Promise.resolve({ data: [], error: null }),
    estimateIds.length
      ? supabaseAdmin
          .from('estimate_version_rollups')
          .select('estimate_id, final_total')
          .eq('org_id', orgId)
          .in('estimate_id', estimateIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (jobsRes.error) {
    return errorResult('server_error', jobsRes.error.message)
  }
  if (rollupsRes.error && !isMissingSchemaErrorMessage(rollupsRes.error.message)) {
    return errorResult('server_error', rollupsRes.error.message)
  }

  const jobsById = new Map((jobsRes.data ?? []).map((row) => [row.id, row as JobRow]))
  const totalsByEstimateId = new Map(
    (((rollupsRes as { data?: RollupRow[] }).data ?? []) as RollupRow[]).map((row) => [
      row.estimate_id,
      asMoney(row.final_total),
    ])
  )

  return okResult(
    buildQuoteHomeSummaryReadModel(
      estimateRows.map((row) => ({
        version_state: normalizeVersionState(row.version_state),
        final_total: totalsByEstimateId.get(row.id) ?? null,
        is_sent_estimate: isSentOrAwaiting(jobsById.get(row.job_id)),
      }))
    )
  )
}

export async function loadQuoteHomeJobVersionCounts(orgId: string) {
  const estimatesResult = await loadEstimateRowsForOrg(orgId)
  if (!estimatesResult.ok) return estimatesResult

  return okResult(buildQuoteHomeJobVersionCountsReadModel(estimatesResult.data))
}
