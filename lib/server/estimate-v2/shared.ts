import { supabaseAdmin } from '../org.ts'
import { asText } from '../../estimator/parsing.ts'

export class EstimateV2RouteServiceError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'EstimateV2RouteServiceError'
    this.status = status
  }
}

export function fail(message: string, status = 400): never {
  throw new EstimateV2RouteServiceError(message, status)
}

export function toWallsCalcMethod(value: unknown): 'REGULAR' | 'PANEL' {
  return asText(value).toUpperCase() === 'PANEL' ? 'PANEL' : 'REGULAR'
}

export function toOtherRollupScope(value: unknown): 'Walls' | 'Ceilings' | 'Trim' | null {
  const raw = asText(value).toLowerCase()
  if (raw === 'walls' || raw === 'wall') return 'Walls'
  if (raw === 'ceilings' || raw === 'ceiling') return 'Ceilings'
  if (raw === 'trim') return 'Trim'
  return null
}

export function nextRoomId(used: Set<string>, startAt: number) {
  let n = Math.max(1, startAt)
  while (used.has(`R${String(n).padStart(3, '0')}`)) {
    n += 1
  }
  return `R${String(n).padStart(3, '0')}`
}

export async function getEstimate(orgId: string, estimateId: string) {
  const res = await supabaseAdmin
    .from('estimates')
    .select(
      'id, org_id, job_id, customer_id, status, version_name, version_state, version_kind, version_sort_order, created_at, updated_at'
    )
    .eq('org_id', orgId)
    .eq('id', estimateId)
    .maybeSingle()
  if (res.error) return { error: res.error.message } as const
  if (!res.data) return { error: 'Quote not found' } as const
  return { estimate: res.data } as const
}
