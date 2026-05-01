import { supabaseAdmin } from '../org.ts'
import { asText, isUuid, UUID_RE as uuid } from '../../estimator/parsing.ts'

export type SoftReplaceTable =
  | 'estimate_room_wall_scopes'
  | 'estimate_segments'
  | 'estimate_ceiling_segments'
  | 'estimate_room_ceiling_scopes'
  | 'estimate_room_ceiling_scope_segments'
  | 'estimate_room_trim_scopes'
  | 'estimate_room_door_scopes'
  | 'estimate_drywall_repairs'
  | 'estimate_rollers'
  | 'estimate_prejob'
  | 'estimate_trim_items'
  | 'estimate_job_colors'
  | 'estimate_room_flags'
  | 'estimate_access_fees'
  | 'estimate_other'

export async function softReplaceRows(params: {
  table: SoftReplaceTable
  orgId: string
  estimateId: string
  rows: Record<string, unknown>[]
}) {
  const deactivate = await supabaseAdmin
    .from(params.table)
    .update({ active: 'N' })
    .eq('org_id', params.orgId)
    .eq('estimate_id', params.estimateId)
    .eq('active', 'Y')
  if (deactivate.error) throw new Error(deactivate.error.message)

  if (!params.rows.length) return

  const withId = params.rows
    .filter((row) => {
      const id = asText(row.id)
      return !!id && uuid.test(id)
    })
    .map((row) => ({ ...row, active: 'Y' }))
  const withoutId = params.rows
    .filter((row) => {
      const id = asText(row.id)
      return !(id && uuid.test(id))
    })
    .map((row) => ({ ...row, active: 'Y' }))

  if (withId.length > 0) {
    const upsert = await supabaseAdmin.from(params.table).upsert(withId, { onConflict: 'id' })
    if (upsert.error) throw new Error(upsert.error.message)
  }
  if (withoutId.length > 0) {
    const insert = await supabaseAdmin.from(params.table).insert(withoutId)
    if (insert.error) throw new Error(insert.error.message)
  }
}

export async function softReplaceWallSegments(params: {
  orgId: string
  estimateId: string
  rows: Record<string, unknown>[]
}) {
  const deactivate = await supabaseAdmin
    .from('estimate_segments')
    .update({ active: 'N' })
    .eq('org_id', params.orgId)
    .eq('estimate_id', params.estimateId)
    .eq('active', 'Y')
    .not('wall_scope_id', 'is', null)
  if (deactivate.error) throw new Error(deactivate.error.message)

  if (!params.rows.length) return

  const withId = params.rows
    .filter((row) => isUuid(row.id))
    .map((row) => ({ ...row, active: 'Y' }))
  const withoutId = params.rows
    .filter((row) => !isUuid(row.id))
    .map((row) => ({ ...row, active: 'Y' }))

  if (withId.length > 0) {
    const upsert = await supabaseAdmin.from('estimate_segments').upsert(withId, { onConflict: 'id' })
    if (upsert.error) throw new Error(upsert.error.message)
  }
  if (withoutId.length > 0) {
    const insert = await supabaseAdmin.from('estimate_segments').insert(withoutId)
    if (insert.error) throw new Error(insert.error.message)
  }
}

export async function saveEstimateStructuredInputsTransactional(params: {
  orgId: string
  estimateId: string
  jobId: string
  payload: Record<string, unknown>
}) {
  const rpc = await supabaseAdmin.rpc('save_estimate_v2_inputs', {
    p_org_id: params.orgId,
    p_estimate_id: params.estimateId,
    p_job_id: params.jobId,
    p_payload: params.payload,
  })
  if (rpc.error) throw new Error(rpc.error.message)
}

export function isMissingStructuredEstimateSaveRpc(message: string) {
  const lowered = asText(message).toLowerCase()
  if (!lowered.includes('save_estimate_v2_inputs')) return false
  return (
    lowered.includes('does not exist') ||
    lowered.includes('could not find the function') ||
    lowered.includes('function public.save_estimate_v2_inputs')
  )
}

export function isRecoverableStructuredEstimateSaveRpcPkCollision(message: string) {
  const lowered = asText(message).toLowerCase()
  if (!lowered.includes('duplicate key value violates unique constraint')) return false
  return (
    lowered.includes('estimate_job_colors_pkey') ||
    lowered.includes('estimate_room_flags_pkey') ||
    lowered.includes('estimate_access_fees_pkey') ||
    lowered.includes('estimate_segments_pkey')
  )
}
