import type {
  EstimateCustomerSendRawResources,
} from './contextTypes'
import {
  loadEstimateCustomerSendCatalogResources,
  loadEstimateCustomerSendCoreResources,
  loadEstimateCustomerSendEstimate,
  loadEstimateCustomerSendScopeResources,
  loadEstimateCustomerSendVersionResources,
} from './contextRepository'

export async function loadEstimateCustomerSendResources(params: {
  origin: string
  orgId: string
  userId: string
  estimateId: string
}): Promise<EstimateCustomerSendRawResources | { error: string }> {
  const estimate = await loadEstimateCustomerSendEstimate({
    orgId: params.orgId,
    estimateId: params.estimateId,
  })
  if ('error' in estimate) return estimate

  const [core, scope, versions, catalogResources] = await Promise.all([
    loadEstimateCustomerSendCoreResources({
      orgId: params.orgId,
      estimateId: params.estimateId,
      estimate,
    }),
    loadEstimateCustomerSendScopeResources({
      orgId: params.orgId,
      estimateId: params.estimateId,
    }),
    loadEstimateCustomerSendVersionResources({
      orgId: params.orgId,
      estimateId: params.estimateId,
    }),
    loadEstimateCustomerSendCatalogResources({
      origin: params.origin,
      orgId: params.orgId,
      userId: params.userId,
      estimateId: params.estimateId,
    }),
  ])

  if ('error' in core) return core
  if ('error' in scope) return scope
  if ('error' in versions) return versions

  return {
    estimate,
    ...core,
    ...scope,
    ...versions,
    ...catalogResources,
  }
}
