import { asText } from '../../estimator/parsing.ts'
import { supabaseAdmin } from '../org.ts'

import { fail, getEstimate } from './shared.ts'

export async function deleteEstimateV2(params: { orgId: string; estimateId: string }) {
  const estimateRes = await getEstimate(params.orgId, params.estimateId)
  if ('error' in estimateRes) {
    const message = asText(estimateRes.error) || 'Failed to load estimate'
    fail(message, message === 'Quote not found' ? 404 : 500)
  }

  const remove = await supabaseAdmin
    .from('estimates')
    .delete()
    .eq('org_id', params.orgId)
    .eq('id', params.estimateId)
  if (remove.error) fail(remove.error.message, 500)

  return { ok: true as const }
}
