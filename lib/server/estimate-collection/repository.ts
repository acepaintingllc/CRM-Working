import { normalizeQuoteVersionKind } from '../../quotes/versionCreation.ts'
import { isJobStatus } from '../../jobs/types.ts'
import type {
  EstimateCollectionDecoratedRow,
  QuoteHomeEligibleJobReadModel,
} from '../../quotes/collectionData.ts'
import { hasUniqueConstraintConflict } from '../dbErrors.ts'
import { isMissingSchemaErrorMessage } from '../schema.ts'
import { supabaseAdmin } from '../org.ts'
import {
  errorResult,
  okResult,
  type ServiceResult,
} from '../serviceResult.ts'
import type {
  EstimateCollectionCustomerRow,
  EstimateCollectionJobRow,
  EstimateCollectionRollupRow,
  EstimateCollectionVersionCopy,
  EstimateCollectionVersionRow,
} from './types'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const VERSION_STATES = new Set(['draft', 'live', 'archived'])

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
): Promise<ServiceResult<EstimateCollectionVersionRow[]>> {
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

  const lookupRequests: Array<Promise<ServiceResult<EstimateCollectionVersionRow[]>>> = []
  if (matchedJobIds.length) {
    lookupRequests.push(
      loadEstimateCollectionRowsByLookup(orgId, {
        jobIds: matchedJobIds,
        limit,
      })
    )
  }
  if (matchedCustomerIds.length) {
    lookupRequests.push(
      loadEstimateCollectionRowsByLookup(orgId, {
        customerIds: matchedCustomerIds,
        limit,
      })
    )
  }

  const lookupResults = await Promise.all(lookupRequests)
  for (const result of lookupResults) {
    if (!result.ok) return result
  }

  const deduped = new Map<string, EstimateCollectionVersionRow>()
  for (const row of (versionMatchesRes.data ?? []) as EstimateCollectionVersionRow[]) {
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

export async function decorateEstimateCollectionRows(
  orgId: string,
  estimateRows: EstimateCollectionVersionRow[],
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

  const jobsById = new Map((jobsRes.data ?? []).map((row) => [row.id, row as EstimateCollectionJobRow]))
  const customersById = new Map(
    (customersRes.data ?? []).map((row) => [row.id, row as EstimateCollectionCustomerRow])
  )
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
        version_state: normalizeEstimateCollectionVersionState(row.version_state),
        version_kind: row.version_kind?.trim() || 'standard',
        version_sort_order: row.version_sort_order ?? 0,
        job_title: job?.title?.trim() || 'Untitled job',
        job_status: job?.status ?? null,
        job_estimate_sent_at: job?.estimate_sent_at ?? null,
        customer_name: customer?.name?.trim() || 'Unknown customer',
        final_total: totalsByEstimateId.get(row.id) ?? null,
        updated_at: row.updated_at,
        created_at: row.created_at,
        is_sent_estimate: isSentEstimateCollectionJob(job),
      } satisfies EstimateCollectionDecoratedRow
    })
  )
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
    ...(params as { _deps?: Partial<{
      rpc: typeof supabaseAdmin.rpc
      hasUniqueConstraintConflict: typeof hasUniqueConstraintConflict
    }> })._deps,
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
      ? supabaseAdmin
          .from('jobs')
          .select('id, status')
          .eq('org_id', params.orgId)
          .in('id', jobIds)
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
): Promise<ServiceResult<QuoteHomeEligibleJobReadModel[]>> {
  const { data: jobsData, error: jobsError } = await supabaseAdmin
    .from('jobs')
    .select(
      'id, customer_id, title, description, status, created_at, estimate_date, estimate_sent_at, scheduled_date, scheduled_end_date, scheduled_email_sent_at, completed_at, completed_email_sent_at, closeout_notes, linked_estimate_id'
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (jobsError) {
    return errorResult('server_error', jobsError.message)
  }

  const jobs = (jobsData ?? []) as Array<{
    id: string
    customer_id: string | null
    title: string | null
    description: string | null
    status: string | null
    created_at?: string | null
    estimate_date: string | null
    estimate_sent_at: string | null
    scheduled_date: string | null
    scheduled_end_date?: string | null
    scheduled_email_sent_at?: string | null
    completed_at: string | null
    completed_email_sent_at?: string | null
    closeout_notes?: string | null
    linked_estimate_id?: string | null
  }>

  const customerIds = Array.from(
    new Set(jobs.map((job) => String(job.customer_id ?? '').trim()).filter(Boolean))
  )

  const customersRes = customerIds.length
    ? await supabaseAdmin
        .from('customers')
        .select('id, name, address')
        .eq('org_id', orgId)
        .in('id', customerIds)
    : { data: [], error: null }

  if (customersRes.error) {
    return errorResult('server_error', customersRes.error.message)
  }

  const customersById = new Map(
    (customersRes.data ?? []).map((row) => [
      String(row.id ?? ''),
      {
        name: String(row.name ?? '').trim() || null,
        address: String(row.address ?? '').trim() || null,
      },
    ])
  )

  return okResult(
    jobs
      .filter((job) => String(job.customer_id ?? '').trim())
      .map((job) => {
        const customer = customersById.get(String(job.customer_id ?? ''))
        return {
          id: job.id,
          customer_id: String(job.customer_id),
          customer_name: customer?.name ?? null,
          customer_address: customer?.address ?? null,
          title: String(job.title ?? '').trim() || 'Untitled job',
          description: job.description ?? null,
          status: isJobStatus(job.status) ? job.status : 'estimate_scheduled',
          created_at: job.created_at ?? null,
          estimate_date: job.estimate_date ?? null,
          estimate_sent_at: job.estimate_sent_at ?? null,
          scheduled_date: job.scheduled_date ?? null,
          scheduled_end_date: job.scheduled_end_date ?? null,
          scheduled_email_sent_at: job.scheduled_email_sent_at ?? null,
          completed_at: job.completed_at ?? null,
          completed_email_sent_at: job.completed_email_sent_at ?? null,
          closeout_notes: job.closeout_notes ?? null,
          linked_estimate_id: job.linked_estimate_id ?? null,
        } satisfies QuoteHomeEligibleJobReadModel
      })
  )
}
