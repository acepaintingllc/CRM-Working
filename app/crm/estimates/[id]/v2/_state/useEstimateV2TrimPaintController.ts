'use client'

import { useCallback, useEffect, useRef } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'
import { getApiErrorMessage, parseApiResponse } from '@/lib/client/api'
import { createEstimateV2Error, type EstimateV2Error } from '@/lib/estimator/errors'
import type { EstimateRouteFamily } from '../../estimateRouteFamily'

export type SummaryTrimPaintDraft = {
  trimPaintProductId: string
  trimPaintGallons: number
  trimPaintQuarts: number
}

export function useEstimateV2TrimPaintController(params: {
  estimateId: string
  routeFamily: EstimateRouteFamily
  refreshPricing: () => Promise<void>
  setError: (value: EstimateV2Error | null) => void
  setPolicySaving: (value: boolean) => void
}) {
  const { estimateId, routeFamily, refreshPricing, setError, setPolicySaving } = params
  const trimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveTrimPaintDebounced = useCallback(
    (next: SummaryTrimPaintDraft) => {
      if (trimTimerRef.current) clearTimeout(trimTimerRef.current)
      trimTimerRef.current = setTimeout(async () => {
        if (!estimateId) return
        setPolicySaving(true)
        try {
          const response = await authedFetch(routeFamily.estimateApiHref(estimateId), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobsettings: {
                trim_paint_id: next.trimPaintProductId || null,
                trim_paint_gallons: next.trimPaintGallons,
                trim_paint_quarts: next.trimPaintQuarts,
              },
            }),
          })
          const parsed = await parseApiResponse(response)
          if (!response.ok) {
            const message = getApiErrorMessage(response, parsed, 'Failed to save trim paint')
            console.error('Estimate V2 trim paint save failed', {
              estimateId,
              operation: 'saveTrimPaintDebounced',
              status: response.status,
              message,
            })
            setError(createEstimateV2Error(message, { retryable: true }))
            return
          }
          setError(null)
          await refreshPricing()
        } catch (error) {
          console.error('Estimate V2 trim paint save crashed', {
            estimateId,
            operation: 'saveTrimPaintDebounced',
            error,
          })
          setError(createEstimateV2Error('Failed to save trim paint', { retryable: true }))
        } finally {
          setPolicySaving(false)
        }
      }, 600)
    },
    [estimateId, refreshPricing, routeFamily, setError, setPolicySaving]
  )

  useEffect(
    () => () => {
      if (trimTimerRef.current) clearTimeout(trimTimerRef.current)
    },
    []
  )

  return { saveTrimPaintDebounced }
}
