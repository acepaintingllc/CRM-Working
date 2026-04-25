import { isMissingSchemaErrorMessage } from '../schema.ts'
import { supabaseAdmin } from '../org.ts'
import { errorResult, okResult, type ServiceResult } from '../serviceResult.ts'
import type {
  EstimateCollectionCustomerRow,
  EstimateCollectionJobRow,
  EstimateCollectionRelatedRows,
  EstimateCollectionRollupRow,
  EstimateCollectionVersionRow,
} from './types'
import { asMoney, estimateSelect } from './repositoryShared.ts'

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

export async function loadEstimateCollectionRowsByLookup(
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
