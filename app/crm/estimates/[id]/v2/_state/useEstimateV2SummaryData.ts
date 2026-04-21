'use client'

import { useCallback, useMemo, useState } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'
import {
  createEstimateV2Error,
  type EstimateV2Error,
} from '@/lib/estimator/errors'
import type {
  EstimateV2JobMeta,
  EstimateV2SummaryPageData,
} from '@/types/estimator/v2'
import {
  SummaryPolicyDraft,
  useEstimateV2SummaryPolicyController,
} from './useEstimateV2SummaryPolicyController'
import {
  SummaryTrimPaintDraft,
  useEstimateV2TrimPaintController,
} from './useEstimateV2TrimPaintController'
import { useEstimateV2SummaryLoader } from './useEstimateV2SummaryLoader'

export function useEstimateV2SummaryData(estimateId: string) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<EstimateV2Error | null>(null)
  const [data, setData] = useState<EstimateV2SummaryPageData | null>(null)
  const [job, setJob] = useState<Partial<EstimateV2JobMeta> | null>(null)
  const [laborDayEnabled, setLaborDayEnabled] = useState(false)
  const [dayhours, setDayhours] = useState(8)
  const [roundIncrement, setRoundIncrement] = useState(4)
  const [laborRate, setLaborRate] = useState(50)
  const [jobMinEnabled, setJobMinEnabled] = useState(false)
  const [jobMinAmount, setJobMinAmount] = useState(0)
  const [trimPaintProductId, setTrimPaintProductId] = useState('')
  const [trimPaintGallons, setTrimPaintGallons] = useState(0)
  const [trimPaintQuarts, setTrimPaintQuarts] = useState(0)
  const [policySaving, setPolicySaving] = useState(false)

  const refreshPricing = useCallback(async () => {
    if (!estimateId) return
    try {
      const res = await authedFetch(`/api/estimates/${estimateId}`, { cache: 'no-store' })
      const payload = (await res.json().catch(() => null)) as EstimateV2SummaryPageData | null
      if (res.ok && payload?.pricing_summary) {
        setData((prev) => (prev ? { ...prev, pricing_summary: payload.pricing_summary } : prev))
        if (payload.trim_paint) {
          setData((prev) => (prev ? { ...prev, trim_paint: payload.trim_paint } : prev))
        }
      } else if (!res.ok) {
        console.error('Estimate V2 summary refresh failed', {
          estimateId,
          operation: 'refreshPricing',
          status: res.status,
        })
        setError(createEstimateV2Error('Failed to refresh pricing', { retryable: true }))
      }
    } catch (error) {
      console.error('Estimate V2 summary refresh crashed', {
        estimateId,
        operation: 'refreshPricing',
        error,
      })
      setError(createEstimateV2Error('Failed to refresh pricing', { retryable: true }))
    }
  }, [estimateId])

  useEstimateV2SummaryLoader(estimateId, {
    setLoading,
    setError,
    setData,
    setJob,
    setLaborDayEnabled,
    setDayhours,
    setRoundIncrement,
    setLaborRate,
    setJobMinEnabled,
    setJobMinAmount,
    setTrimPaintProductId,
    setTrimPaintGallons,
    setTrimPaintQuarts,
  })

  const { savePolicyDebounced } = useEstimateV2SummaryPolicyController({
    estimateId,
    refreshPricing,
    setPolicySaving,
  })
  const { saveTrimPaintDebounced } = useEstimateV2TrimPaintController({
    estimateId,
    refreshPricing,
    setPolicySaving,
  })

  const jobSettingsVm = useMemo(
    () => ({
      draft: {
        laborDayEnabled,
        dayhours,
        roundIncrement,
        laborRate,
        jobMinEnabled,
        jobMinAmount,
      } satisfies SummaryPolicyDraft,
      update: (patch: Partial<SummaryPolicyDraft>) => {
        const next = {
          laborDayEnabled,
          dayhours,
          roundIncrement,
          laborRate,
          jobMinEnabled,
          jobMinAmount,
          ...patch,
        }
        setLaborDayEnabled(next.laborDayEnabled)
        setDayhours(next.dayhours)
        setRoundIncrement(next.roundIncrement)
        setLaborRate(next.laborRate)
        setJobMinEnabled(next.jobMinEnabled)
        setJobMinAmount(next.jobMinAmount)
        savePolicyDebounced(next)
      },
      saving: policySaving,
    }),
    [
      dayhours,
      jobMinAmount,
      jobMinEnabled,
      laborDayEnabled,
      laborRate,
      policySaving,
      roundIncrement,
      savePolicyDebounced,
    ]
  )

  const trimPaintVm = useMemo(
    () => ({
      draft: {
        trimPaintProductId,
        trimPaintGallons,
        trimPaintQuarts,
      } satisfies SummaryTrimPaintDraft,
      update: (patch: Partial<SummaryTrimPaintDraft>) => {
        const next = {
          trimPaintProductId,
          trimPaintGallons,
          trimPaintQuarts,
          ...patch,
        }
        setTrimPaintProductId(next.trimPaintProductId)
        setTrimPaintGallons(next.trimPaintGallons)
        setTrimPaintQuarts(next.trimPaintQuarts)
        saveTrimPaintDebounced(next)
      },
      saving: policySaving,
    }),
    [
      policySaving,
      saveTrimPaintDebounced,
      trimPaintGallons,
      trimPaintProductId,
      trimPaintQuarts,
    ]
  )

  return {
    data,
    job,
    loading,
    error,
    laborDayEnabled,
    setLaborDayEnabled,
    dayhours,
    setDayhours,
    roundIncrement,
    setRoundIncrement,
    laborRate,
    setLaborRate,
    jobMinEnabled,
    setJobMinEnabled,
    jobMinAmount,
    setJobMinAmount,
    trimPaintProductId,
    setTrimPaintProductId,
    trimPaintGallons,
    setTrimPaintGallons,
    trimPaintQuarts,
    setTrimPaintQuarts,
    policySaving,
    savePolicyDebounced,
    saveTrimPaintDebounced,
    jobSettingsVm,
    trimPaintVm,
  }
}
