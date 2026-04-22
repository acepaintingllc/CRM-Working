'use client'

import { useCallback, useEffect, useRef } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'
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
  setPolicySaving: (value: boolean) => void
}) {
  const { estimateId, routeFamily, refreshPricing, setPolicySaving } = params
  const trimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveTrimPaintDebounced = useCallback(
    (next: SummaryTrimPaintDraft) => {
      if (trimTimerRef.current) clearTimeout(trimTimerRef.current)
      trimTimerRef.current = setTimeout(async () => {
        if (!estimateId) return
        setPolicySaving(true)
        try {
          await authedFetch(routeFamily.estimateApiHref(estimateId), {
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
          await refreshPricing()
        } finally {
          setPolicySaving(false)
        }
      }, 600)
    },
    [estimateId, refreshPricing, routeFamily, setPolicySaving]
  )

  useEffect(
    () => () => {
      if (trimTimerRef.current) clearTimeout(trimTimerRef.current)
    },
    []
  )

  return { saveTrimPaintDebounced }
}
