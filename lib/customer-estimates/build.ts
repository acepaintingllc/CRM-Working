import { normalizeCustomerEstimateInput, type CustomerEstimateInput } from './inputNormalization.ts'
import { extractScopeBuckets } from './scopeExtraction.ts'
import { finalizeScopeBuckets } from './textGeneration.ts'
import { assembleCustomerEstimateBuild } from './documentAssembly.ts'

export type { CustomerEstimateInput } from './inputNormalization.ts'
export { buildEstimatePublicSnapshot } from './publicSnapshot.ts'

export function buildCustomerEstimateDocument(params: CustomerEstimateInput) {
  const normalized = normalizeCustomerEstimateInput(params)
  const scoped = finalizeScopeBuckets(
    extractScopeBuckets({
      rooms: normalized.rooms,
      roomWallScopes: normalized.roomWallScopes,
      roomCeilingScopes: normalized.roomCeilingScopes,
      roomTrimScopes: normalized.roomTrimScopes,
      roomDoorScopes: normalized.roomDoorScopes,
      trimItems: normalized.trimItems,
      otherRows: normalized.otherRows,
      paintCatalogRows: normalized.paintCatalogRows,
      trimCatalogRows: normalized.trimCatalogRows,
      jobsettings: normalized.jobsettings,
    })
  )

  return assembleCustomerEstimateBuild({
    normalized,
    scoped,
  })
}
