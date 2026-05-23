'use client'

import { useCallback, useEffect, useState } from 'react'
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
import type { EstimateV2JobMeta } from '@/types/estimator/v2Meta'
import type { EstimateV2CatalogsPayload as CatalogsPayload } from '@/types/estimator/v2Catalogs'
import type { EstimateV2GetResponse as EstimateResponse } from '@/types/estimator/v2Summary'
import {
  buildEstimateV2EditorApiFailureDiagnostic,
  formatEstimateV2EditorApiFailureLog,
} from '../_lib/estimateV2EditorDiagnostics'
import { applyEstimateV2EditorLoadState } from './estimateV2EditorStoreMutations'
import { buildEstimateV2EditorLoadState } from './estimateV2EditorLoadOrchestration'
import { mergeEstimateV2Catalogs } from './useEstimateV2Sanitizer'

export function useEstimateV2EditorLoader(params: {
  estimateId?: string
  routeFamily: EstimateRouteFamily
  store: EstimateV2EditorStoreApi
}) {
  const { estimateId, routeFamily, store } = params
  const [reloadKey, setReloadKey] = useState(0)
  const [catalogsReloading, setCatalogsReloading] = useState(false)

  const loadCatalogs = useCallback(async (activeEstimateId: string) => {
    const catalogsRes = await authedFetch(
      routeFamily.catalogsApiHref(activeEstimateId, { catalogSource: 'v2' }),
      {
        cache: 'no-store',
      }
    )
    const catalogsParsed = await parseApiResponse(catalogsRes)
    const catalogsPayload = getApiPayloadData<CatalogsPayload>(catalogsParsed.json)
    const catalogsErrorMessage =
      catalogsRes.ok
        ? null
        : (catalogsPayload as { error?: string } | null)?.error ??
          getApiErrorMessage(catalogsRes, catalogsParsed, 'Failed to load catalogs')

    return {
      catalogsRes,
      catalogsPayload,
      catalogsOk: catalogsRes.ok,
      catalogsErrorMessage,
    }
  }, [routeFamily])

  const loadWorkspace = useCallback(
    async (activeRef: { current: boolean }) => {
      const activeEstimateId = estimateId
      if (!activeEstimateId) return

      const storeState = store.getState()
      try {
        storeState.setLoading(true)
        storeState.setError(null)
        storeState.setCatalogsError(null)
        storeState.setValidationIssues([])

        const [estimateRes, catalogsResult] = await Promise.all([
          authedFetch(routeFamily.estimateApiHref(activeEstimateId), { cache: 'no-store' }),
          loadCatalogs(activeEstimateId),
        ])
        const estimateParsed = await parseApiResponse(estimateRes)
        const estimatePayload = getApiPayloadData<EstimateResponse>(estimateParsed.json)
        const { catalogsPayload, catalogsOk, catalogsErrorMessage } = catalogsResult

        if (!activeRef.current) return
        if (!estimateRes.ok || !estimatePayload) {
          const message = getApiErrorMessage(estimateRes, estimateParsed, 'Failed to load estimate')
          const diagnostic = buildEstimateV2EditorApiFailureDiagnostic({
            estimateId: activeEstimateId,
            endpoint: routeFamily.estimateApiHref(activeEstimateId),
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
          catalogsPayload: catalogsOk ? catalogsPayload : null,
          catalogsOk,
          catalogsErrorMessage,
          job,
        })
        applyEstimateV2EditorLoadState(store, nextLoadState)
      } catch (error) {
        if (!activeRef.current) return
        console.error('Estimate V2 editor load crashed', {
          estimateId: activeEstimateId,
          operation: 'loadWorkspace',
          error,
        })
        store.getState().setError(
          createEstimateV2Error('Failed to fetch estimate workspace', { retryable: true })
        )
        store.getState().setLoading(false)
      }
    },
    [estimateId, loadCatalogs, routeFamily, store]
  )

  const reloadWorkspace = useCallback(() => {
    setReloadKey((current) => current + 1)
  }, [])

  const reloadCatalogs = useCallback(async () => {
    const activeEstimateId = estimateId
    if (!activeEstimateId) return false
    setCatalogsReloading(true)

    try {
      const { catalogsPayload, catalogsOk, catalogsErrorMessage } =
        await loadCatalogs(activeEstimateId)
      const storeState = store.getState()

      if (catalogsOk) {
        storeState.setCatalogs((currentCatalogs) =>
          mergeEstimateV2Catalogs({
            currentCatalogs,
            catalogsPayload,
          })
        )
        storeState.setCatalogsError(null)
        return true
      }

      storeState.setCatalogsError(
        createEstimateV2Error(catalogsErrorMessage ?? 'Failed to load catalogs', {
          retryable: true,
        })
      )
      return false
    } catch (error) {
      console.error('Estimate V2 catalogs reload crashed', {
        estimateId: activeEstimateId,
        operation: 'reloadCatalogs',
        error,
      })
      store.getState().setCatalogsError(
        createEstimateV2Error('Failed to reload rates and products', { retryable: true })
      )
      return false
    } finally {
      setCatalogsReloading(false)
    }
  }, [estimateId, loadCatalogs, store])

  useEffect(() => {
    if (!estimateId) return
    const activeRef = { current: true }
    void loadWorkspace(activeRef)
    return () => {
      activeRef.current = false
    }
  }, [estimateId, loadWorkspace, reloadKey])

  return {
    catalogsReloading,
    reloadCatalogs,
    reloadWorkspace,
  }
}
