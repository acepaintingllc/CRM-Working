'use client'

import { useEffect, useEffectEvent } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'
import {
  createEstimateV2Error,
  type EstimateV2Error,
} from '@/lib/estimator/errors'
import {
  DEFAULT_DAY_HOURS,
  DEFAULT_JOB_MINIMUM_AMOUNT,
  DEFAULT_JOB_MINIMUM_ENABLED,
  DEFAULT_LABOR_DAY_POLICY_ENABLED,
  DEFAULT_LABOR_RATE,
  DEFAULT_ROUNDING_INCREMENT_HOURS,
} from '@/lib/estimator/defaults'
import type {
  EstimateV2JobMeta,
  EstimateV2JobSettingsInput,
  EstimateV2SummaryPageData,
} from '@/types/estimator/v2'

type SummaryLoaderState = {
  setLoading: (value: boolean) => void
  setError: (value: EstimateV2Error | null) => void
  setData: (
    value:
      | EstimateV2SummaryPageData
      | null
      | ((prev: EstimateV2SummaryPageData | null) => EstimateV2SummaryPageData | null)
  ) => void
  setJob: (value: Partial<EstimateV2JobMeta> | null) => void
  setLaborDayEnabled: (value: boolean) => void
  setDayhours: (value: number) => void
  setRoundIncrement: (value: number) => void
  setLaborRate: (value: number) => void
  setJobMinEnabled: (value: boolean) => void
  setJobMinAmount: (value: number) => void
  setTrimPaintProductId: (value: string) => void
  setTrimPaintGallons: (value: number) => void
  setTrimPaintQuarts: (value: number) => void
}

function getEffectiveBoolean(
  primary: boolean | null | undefined,
  fallback: boolean | null | undefined,
  defaultValue: boolean
) {
  return typeof primary === 'boolean' ? primary : fallback ?? defaultValue
}

function getEffectiveNumber(
  primary: number | null | undefined,
  fallback: number | null | undefined,
  defaultValue: number
) {
  return primary ?? fallback ?? defaultValue
}

function applyJobSettingsDefaults(
  jobsettings: EstimateV2JobSettingsInput | null | undefined,
  orgDefaults: EstimateV2JobSettingsInput | null | undefined
) {
  return {
    laborDayEnabled: getEffectiveBoolean(
      jobsettings?.labor_day_policy_enabled,
      orgDefaults?.labor_day_policy_enabled,
      DEFAULT_LABOR_DAY_POLICY_ENABLED
    ),
    dayhours: getEffectiveNumber(jobsettings?.dayhours, orgDefaults?.dayhours, DEFAULT_DAY_HOURS),
    roundIncrement: getEffectiveNumber(
      jobsettings?.rounding_increment_hours,
      orgDefaults?.rounding_increment_hours,
      DEFAULT_ROUNDING_INCREMENT_HOURS
    ),
    laborRate: getEffectiveNumber(
      jobsettings?.override_labor_rate,
      orgDefaults?.override_labor_rate,
      DEFAULT_LABOR_RATE
    ),
    jobMinEnabled: getEffectiveBoolean(
      jobsettings?.job_minimum_enabled,
      orgDefaults?.job_minimum_enabled,
      DEFAULT_JOB_MINIMUM_ENABLED
    ),
    jobMinAmount: getEffectiveNumber(
      jobsettings?.job_minimum_amount,
      orgDefaults?.job_minimum_amount,
      DEFAULT_JOB_MINIMUM_AMOUNT
    ),
  }
}

export function useEstimateV2SummaryLoader(estimateId: string, state: SummaryLoaderState) {
  const loadSummary = useEffectEvent(async (activeRef: { current: boolean }) => {
    try {
      state.setLoading(true)
      state.setError(null)

      const res = await authedFetch(`/api/estimates/${estimateId}`, { cache: 'no-store' })
      const payload = (await res.json().catch(() => null)) as
        | EstimateV2SummaryPageData
        | { error?: string }
        | null

      if (!activeRef.current) return
      if (!res.ok || !payload || !('estimate' in payload)) {
        const message =
          (payload as { error?: string } | null)?.error ?? 'Failed to load estimate'
        console.error('Estimate V2 summary load failed', {
          estimateId,
          operation: 'loadEstimate',
          status: res.status,
          message,
        })
        state.setError(createEstimateV2Error(message, { retryable: true }))
        state.setLoading(false)
        return
      }

      const nextData = payload as EstimateV2SummaryPageData
      state.setData(nextData)

      const defaults = applyJobSettingsDefaults(
        nextData.inputs?.jobsettings,
        nextData.inputs?.org_defaults
      )
      state.setLaborDayEnabled(defaults.laborDayEnabled)
      state.setDayhours(defaults.dayhours)
      state.setRoundIncrement(defaults.roundIncrement)
      state.setLaborRate(defaults.laborRate)
      state.setJobMinEnabled(defaults.jobMinEnabled)
      state.setJobMinAmount(defaults.jobMinAmount)
      state.setTrimPaintProductId(nextData.trim_paint?.paint_product_id ?? '')
      state.setTrimPaintGallons(nextData.trim_paint?.gallons ?? 0)
      state.setTrimPaintQuarts(nextData.trim_paint?.quarts ?? 0)

      const jobRes = await authedFetch(`/api/jobs/${nextData.estimate.job_id}`, {
        cache: 'no-store',
      })
      const jobPayload = (await jobRes.json().catch(() => null)) as { job?: EstimateV2JobMeta } | null
      if (!activeRef.current) return
      if (jobRes.ok && jobPayload?.job) state.setJob(jobPayload.job)

      state.setLoading(false)
    } catch (error) {
      if (!activeRef.current) return
      console.error('Estimate V2 summary load crashed', {
        estimateId,
        operation: 'loadEstimate',
        error,
      })
      state.setError(createEstimateV2Error('Failed to fetch estimate summary', { retryable: true }))
      state.setLoading(false)
    }
  })

  useEffect(() => {
    if (!estimateId) return
    const activeRef = { current: true }
    void loadSummary(activeRef)
    return () => {
      activeRef.current = false
    }
  }, [estimateId])
}
