import {
  deriveEstimateCustomerSendCalculatedData,
} from '@/lib/server/customer-send/contextCalculations'
import {
  loadEstimateCustomerSendResources,
} from '@/lib/server/customer-send/contextLoader'
import {
  buildEstimateCustomerSendContext,
} from '@/lib/server/customer-send/contextMapper'
import {
  buildCustomerDocumentFromSendContext,
} from '@/lib/server/customer-send/document'
import type { EstimateCustomerSendContextResult } from '@/lib/server/customer-send/types'

export async function loadEstimateCustomerSendContext(params: {
  origin: string
  orgId: string
  userId: string
  estimateId: string
}): Promise<EstimateCustomerSendContextResult> {
  const resources = await loadEstimateCustomerSendResources(params)
  if ('error' in resources) return resources

  const calculated = deriveEstimateCustomerSendCalculatedData(resources)
  return buildEstimateCustomerSendContext({
    origin: params.origin,
    resources,
    calculated,
  })
}

export { buildCustomerDocumentFromSendContext }
