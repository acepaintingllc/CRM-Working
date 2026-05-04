'use client'

import { useCallback, useEffect } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'
import {
  getApiErrorMessage,
  getApiPayloadData,
  parseApiResponse,
  type ApiDataEnvelope,
} from '@/lib/client/api'
import type { EstimateV2EditorStoreApi } from '@/lib/estimates/v2/store/estimateV2Store'
import { createEstimateV2Error } from '@/lib/estimator/errors'
import type { EstimateRouteFamily } from '../../estimateRouteFamily'
import type {
  EstimateV2CatalogsPayload as CatalogsPayload,
  EstimateV2GetResponse as EstimateResponse,
  EstimateV2JobMeta,
} from '@/types/estimator/v2'
import {
  buildEstimateV2EditorApiFailureDiagnostic,
  formatEstimateV2EditorApiFailureLog,
} from '../_lib/estimateV2EditorDiagnostics'
import { applyEstimateV2EditorLoadState } from './estimateV2EditorStoreMutations'
import { buildEstimateV2EditorLoadState } from './estimateV2EditorLoadOrchestration'

export function useEstimateV2EditorLoader(params: {
  estimateId?: string
  routeFamily: EstimateRouteFamily
  store: EstimateV2EditorStoreApi
}) {
  const { estimateId, routeFamily, store } = params

  const loadWorkspace = useCallback(
    async (activeRef: { current: boolean }) => {
      const storeState = store.getState()
      try {
        storeState.setLoading(true)
        storeState.setError(null)
        storeState.setCatalogsError(null)
        storeState.setValidationIssues([])

        const [estimateRes, catalogsRes] = await Promise.all([
          authedFetch(routeFamily.estimateApiHref(estimateId!), { cache: 'no-store' }),
          authedFetch(routeFamily.catalogsApiHref(estimateId!, { catalogSource: 'v2' }), {
            cache: 'no-store',
          }),
        ])
        const [estimateParsed, catalogsParsed] = await Promise.all([
          parseApiResponse(estimateRes),
          parseApiResponse(catalogsRes),
        ])
        const estimatePayload = getApiPayloadData<EstimateResponse>(estimateParsed.json)
        const catalogsPayload = getApiPayloadData<CatalogsPayload>(catalogsParsed.json)

        if (!activeRef.current) return
        if (!estimateRes.ok || !estimatePayload) {
          const message = getApiErrorMessage(estimateRes, estimateParsed, 'Failed to load estimate')
          const diagnostic = buildEstimateV2EditorApiFailureDiagnostic({
            estimateId,
            endpoint: routeFamily.estimateApiHref(estimateId!),
            method: 'GET',
            operation: 'loadEstimate',
            response: estimateRes,
            parsed: estimateParsed,
            message,
          })
          console.error(
            'Estimate V2 editor load failed',
            formatEstimateV2EditorApiFailureLog(diagnostic),
            diagnostic
          )
          storeState.setError(createEstimateV2Error(message, { retryable: true }))
          storeState.setLoading(false)
          return
        }

        const catalogsErrorMessage =
          catalogsRes.ok || catalogsPayload == null
            ? null
            : (catalogsPayload as { error?: string }).error ??
              getApiErrorMessage(catalogsRes, catalogsParsed, 'Failed to load catalogs')

        const jobRes = await authedFetch(`/api/jobs/${estimatePayload.estimate.job_id}`, {
          cache: 'no-store',
        })
        const jobParsed = await parseApiResponse(jobRes)
        const jobPayload = jobParsed.json as ApiDataEnvelope<EstimateV2JobMeta> | null
        const job = jobRes.ok && jobPayload?.data ? jobPayload.data : null

        if (!activeRef.current) return

        const nextLoadState = buildEstimateV2EditorLoadState({
          store,
          estimatePayload,
          catalogsPayload: catalogsRes.ok ? catalogsPayload : null,
          catalogsOk: catalogsRes.ok,
          catalogsErrorMessage,
          job,
        })
        applyEstimateV2EditorLoadState(store, nextLoadState)
      } catch (error) {
        if (!activeRef.current) return
        console.error('Estimate V2 editor load crashed', {
          estimateId,
          operation: 'loadWorkspace',
          error,
        })
        store.getState().setError(
          createEstimateV2Error('Failed to fetch estimate workspace', { retryable: true })
        )
        store.getState().setLoading(false)
      }
    },
    [estimateId, routeFamily, store]
  )

  useEffect(() => {
    if (!estimateId) return
    const activeRef = { current: true }
    void loadWorkspace(activeRef)
    return () => {
      activeRef.current = false
    }
  }, [estimateId, loadWorkspace])
}
