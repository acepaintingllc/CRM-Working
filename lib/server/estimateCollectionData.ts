import { isMissingSchemaErrorMessage } from '@/lib/server/schema'
import {
  errorResult,
  okResult,
  type ServiceResult,
} from '@/lib/server/serviceResult'
import { supabaseAdmin } from './org'
import type { EstimateCollectionDecoratedRow } from '@/lib/quotes/collectionData'

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

function isSentOrAwaiting(job: JobRow | undefined) {
  if (!job) return false
  return job.status === 'estimate_sent' || job.status === 'follow_up'
}

async function loadEstimateRowsForOrg(orgId: string): Promise<ServiceResult<EstimateRow[]>> {
  const { data, error } = await supabaseAdmin
    .from('estimates')
    .select(
      'id, job_id, customer_id, status, version_name, version_state, version_kind, version_sort_order, created_at, updated_at'
    )
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })

  if (error) {
    return errorResult('server_error', error.message)
  }

  return okResult((data ?? []) as EstimateRow[])
}

export async function loadDecoratedEstimateCollectionRows(
  orgId: string,
  options: { includeRollups: boolean }
): Promise<ServiceResult<EstimateCollectionDecoratedRow[]>> {
  const estimatesResult = await loadEstimateRowsForOrg(orgId)
  if (!estimatesResult.ok) return estimatesResult

  const estimateRows = estimatesResult.data
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
        version_state: row.version_state?.trim() || 'draft',
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
