'use client'

import { createEstimateV2Error } from '@/lib/estimator/errors'
import type { EstimateV2EditorStoreApi } from '@/lib/estimates/v2/store/estimateV2Store'
import type {
  EstimateV2CatalogsPayload as CatalogsPayload,
  EstimateV2GetResponse as EstimateResponse,
  EstimateV2JobMeta,
} from '@/types/estimator/v2'
import {
  buildEstimateV2CustomerDraft,
  mergeEstimateV2Catalogs,
  sanitizeEstimateV2EditorLoad,
} from './useEstimateV2Sanitizer'

export function buildEstimateV2EditorLoadState(params: {
  store: EstimateV2EditorStoreApi
  estimatePayload: EstimateResponse
  catalogsPayload: CatalogsPayload | null
  catalogsOk: boolean
  catalogsErrorMessage: string | null
  job: EstimateV2JobMeta | null
}) {
  const { store, estimatePayload, catalogsPayload, catalogsOk, catalogsErrorMessage, job } = params
  const storeState = store.getState()
  const nextCatalogs = mergeEstimateV2Catalogs({
    currentCatalogs: storeState.meta.catalogs,
    catalogsPayload: catalogsOk ? catalogsPayload : null,
  })
  const sanitized = sanitizeEstimateV2EditorLoad({
    estimatePayload,
    catalogs: nextCatalogs,
    selectedRoomId: storeState.meta.selectedRoomId,
  })
  const catalogsError =
    catalogsOk || catalogsPayload == null || !catalogsErrorMessage
      ? null
      : createEstimateV2Error(catalogsErrorMessage, { retryable: true })

  return {
    collections: sanitized.collections,
    meta: {
      estimate: estimatePayload.estimate,
      job,
      catalogs: sanitized.catalogs,
      wallCalculations: sanitized.meta.wallCalculations,
      ceilingCalculations: sanitized.meta.ceilingCalculations,
      trimCalculations: sanitized.meta.trimCalculations,
      selectedRoomId: sanitized.meta.selectedRoomId,
      error: catalogsError,
      validationIssues: [] as string[],
      lastSavedSnapshot: sanitized.meta.lastSavedSnapshot,
      autoSaveHint: sanitized.meta.autoSaveHint,
      jobSettingsDraft: sanitized.meta.jobSettingsDraft,
      orgJobProductDefaults: sanitized.meta.orgJobProductDefaults,
      customerDraft: buildEstimateV2CustomerDraft(job),
      debugMeta: sanitized.meta.debugMeta,
    },
    saveStatus: sanitized.meta.saveStatus,
  }
}
