import { jsonError, requireSessionUserOrg } from '@/lib/server/apiRoute'
import { supabaseAdmin } from '@/lib/server/org'
import { dataResponse } from '@/lib/server/routeResult'
import { isMissingSchemaErrorMessage } from '@/lib/server/schema'

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

function isSentOrAwaiting(job: JobRow | undefined) {
  if (!job) return false
  return job.status === 'estimate_sent' || job.status === 'follow_up'
}

function asMoney(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export async function GET() {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response
  const { orgId } = auth.session

  const { data: estimates, error: estimatesErr } = await supabaseAdmin
    .from('estimates')
    .select(
      'id, job_id, customer_id, status, version_name, version_state, version_kind, version_sort_order, created_at, updated_at'
    )
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })

  if (estimatesErr) return jsonError(estimatesErr.message, 500)

  const estimateRows = (estimates ?? []) as EstimateRow[]
  const jobIds = Array.from(new Set(estimateRows.map((row) => row.job_id).filter(Boolean)))
  const customerIds = Array.from(
    new Set(estimateRows.map((row) => row.customer_id).filter(Boolean))
  )
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

  if (jobsRes.error) return jsonError(jobsRes.error.message, 500)
  if (customersRes.error) return jsonError(customersRes.error.message, 500)

  let rollupRows: RollupRow[] = []
  if (estimateIds.length) {
    const rollupsRes = await supabaseAdmin
      .from('estimate_version_rollups')
      .select('estimate_id, final_total')
      .eq('org_id', orgId)
      .in('estimate_id', estimateIds)

    if (rollupsRes.error) {
      if (!isMissingSchemaErrorMessage(rollupsRes.error.message)) {
        return jsonError(rollupsRes.error.message, 500)
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

  const decorated = estimateRows.map((row) => {
    const job = jobsById.get(row.job_id)
    const customer = customersById.get(row.customer_id)
    const finalTotal = totalsByEstimateId.get(row.id) ?? null
    return {
      estimate_id: row.id,
      job_id: row.job_id,
      customer_id: row.customer_id,
      version_name: row.version_name?.trim() || 'Quote Version',
      version_state: row.version_state?.trim() || 'draft',
      version_kind: row.version_kind?.trim() || 'standard',
      version_sort_order: row.version_sort_order ?? 0,
      job_title: job?.title?.trim() || 'Untitled job',
      customer_name: customer?.name?.trim() || 'Unknown customer',
      final_total: finalTotal,
      updated_at: row.updated_at,
      created_at: row.created_at,
      is_sent_estimate: isSentOrAwaiting(job),
    }
  })

  const recentEstimates = decorated.slice(0, 12)
  const latestEstimate = decorated[0] ?? null
  const draftCount = decorated.filter((row) => row.version_state === 'draft').length
  const sentOrAwaitingCount = decorated.filter((row) => row.is_sent_estimate).length
  const liveCount = decorated.filter((row) => row.version_state === 'live').length
  const pipelineTotal = decorated.reduce((sum, row) => {
    if (row.version_state === 'archived') return sum
    return sum + (row.final_total ?? 0)
  }, 0)

  return dataResponse({
    summary: {
      draft_count: draftCount,
      sent_or_awaiting_count: sentOrAwaitingCount,
      live_count: liveCount,
      pipeline_total: pipelineTotal,
    },
    recent_estimates: recentEstimates,
    snapshot: latestEstimate
      ? {
          ...latestEstimate,
          total_versions: decorated.length,
        }
      : null,
    search_estimates: decorated.slice(0, 200),
  })
}
