import { isMissingSchemaErrorMessage } from '../schema.ts'
import { supabaseAdmin } from '../org.ts'
import { errorResult, okResult, type ServiceResult } from '../serviceResult.ts'
import type {
  EstimateCollectionCursorBoundary,
  EstimateCollectionJobContextDbRow,
  EstimateCollectionJobPageDbRow,
  EstimateCollectionJobVersionsDbPage,
  EstimateCollectionSummaryDbRow,
  EstimateCollectionVersionRow,
} from './types'
import {
  compareNullableTimestampDescIdDesc,
  estimateSelect,
  isAfterNullableTimestampDescIdCursor,
} from './repositoryShared.ts'

export async function loadEstimateCollectionSummary(
  orgId: string
): Promise<ServiceResult<EstimateCollectionSummaryDbRow | null>> {
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

  return okResult(
    Array.isArray(data) ? ((data[0] ?? null) as EstimateCollectionSummaryDbRow | null) : null
  )
}

export async function loadEstimateCollectionJobsPage(
  orgId: string,
  options?: {
    query?: string
    limit?: number
    cursor?: EstimateCollectionCursorBoundary | null
  }
): Promise<
  ServiceResult<{
    query: string
    limit: number
    rows: EstimateCollectionJobPageDbRow[]
  }>
> {
  const limit = options?.limit ?? 25
  const query = options?.query ?? ''
  const cursor = options?.cursor ?? null
  if (cursor?.timestamp === null) {
    return errorResult('invalid_input', 'Invalid cursor.')
  }

  const { data, error } = await supabaseAdmin.rpc('quote_home_jobs_page', {
    p_org_id: orgId,
    p_search: query || null,
    p_limit: limit + 1,
    p_cursor_created_at: cursor?.timestamp ?? null,
    p_cursor_id: cursor?.id ?? null,
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

  const sortedRows = ((data ?? []) as EstimateCollectionJobPageDbRow[]).sort((left, right) =>
    compareNullableTimestampDescIdDesc(
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

export async function loadEstimateCollectionJobContext(
  orgId: string,
  jobId: string
): Promise<ServiceResult<EstimateCollectionJobContextDbRow | null>> {
  const { data: jobData, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, customer_id, title')
    .eq('org_id', orgId)
    .eq('id', jobId)
    .limit(1)

  if (jobError) {
    return errorResult('server_error', jobError.message)
  }

  const job = ((jobData ?? []) as Array<{
    id: string
    customer_id: string | null
    title: string | null
  }>)[0]

  if (!job) {
    return okResult(null)
  }

  let customer: { name: string | null; address: string | null } | null = null
  if (job.customer_id) {
    const { data: customerData, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('name, address')
      .eq('org_id', orgId)
      .eq('id', job.customer_id)
      .limit(1)

    if (customerError) {
      return errorResult('server_error', customerError.message)
    }

    customer = ((customerData ?? []) as Array<{
      name: string | null
      address: string | null
    }>)[0] ?? null
  }

  return okResult({
    id: job.id,
    customer_id: job.customer_id,
    customer_name: customer?.name ?? null,
    customer_address: customer?.address ?? null,
    title: job.title,
  })
}

export async function loadEstimateCollectionJobVersionsPage(
  orgId: string,
  jobId: string,
  options?: {
    limit?: number
    cursor?: EstimateCollectionCursorBoundary | null
  }
): Promise<ServiceResult<EstimateCollectionJobVersionsDbPage>> {
  const limit = options?.limit ?? 25
  const cursor = options?.cursor ?? null

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
    compareNullableTimestampDescIdDesc(
      { timestamp: left.updated_at, id: left.id },
      { timestamp: right.updated_at, id: right.id }
    )
  )

  const filteredRows = cursor
    ? rawRows.filter((row) =>
        isAfterNullableTimestampDescIdCursor(
          { timestamp: row.updated_at, id: row.id },
          cursor
        )
      )
    : rawRows

  return okResult({
    jobId,
    totalVersions: Number(countRes.count ?? 0),
    limit,
    rows: filteredRows,
  })
}
