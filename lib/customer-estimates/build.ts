import type { BuiltCustomerEstimateDocument } from './types.ts'
import { assembleCustomerEstimateBuild } from './documentAssembly.ts'
import {
  type CustomerEstimateInput,
  normalizeCustomerEstimateInput,
} from './inputNormalization.ts'
import { extractScopeBuckets } from './scopeExtraction.ts'
import { finalizeScopeBuckets } from './textGeneration.ts'

export type { CustomerEstimateInput } from './inputNormalization.ts'
export { buildEstimatePublicSnapshot } from './publicSnapshot.ts'

export function buildCustomerEstimateDocument(
  params: CustomerEstimateInput
): BuiltCustomerEstimateDocument {
  const normalized = normalizeCustomerEstimateInput(params)
  const scoped = finalizeScopeBuckets(
    extractScopeBuckets({
      rooms: normalized.rooms,
      roomWallScopes: normalized.roomWallScopes,
      roomCeilingScopes: normalized.roomCeilingScopes,
      roomTrimScopes: normalized.roomTrimScopes,
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
