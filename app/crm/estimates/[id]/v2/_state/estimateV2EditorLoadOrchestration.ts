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
import { collectEstimateV2CalculationMissingInputIssues } from './estimateV2EditorSaveOrchestration'

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
    catalogsOk || !catalogsErrorMessage
      ? null
      : createEstimateV2Error(catalogsErrorMessage, { retryable: true })

  const validationIssues = collectEstimateV2CalculationMissingInputIssues({
    wallCalculations: sanitized.meta.wallCalculations,
    ceilingCalculations: sanitized.meta.ceilingCalculations,
    trimCalculations: sanitized.meta.trimCalculations,
    doorCalculations: sanitized.meta.doorCalculations,
    drywallCalculations: sanitized.meta.drywallCalculations,
  })

  return {
    collections: sanitized.collections,
    meta: {
      estimate: estimatePayload.estimate,
      job,
      catalogs: sanitized.catalogs,
      wallCalculations: sanitized.meta.wallCalculations,
      ceilingCalculations: sanitized.meta.ceilingCalculations,
      trimCalculations: sanitized.meta.trimCalculations,
      doorCalculations: sanitized.meta.doorCalculations,
      drywallCalculations: sanitized.meta.drywallCalculations,
      pricingSummary: sanitized.meta.pricingSummary,
      selectedRoomId: sanitized.meta.selectedRoomId,
      catalogsError,
      error: catalogsError,
      validationIssues,
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

export type EstimateV2EditorLoadState = ReturnType<typeof buildEstimateV2EditorLoadState>
