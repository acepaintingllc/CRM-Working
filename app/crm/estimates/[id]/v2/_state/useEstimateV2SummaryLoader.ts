'use client'

import { useCallback, useEffect } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'
import {
  getApiErrorMessage,
  getApiPayloadData,
  parseApiResponse,
  type ApiDataEnvelope,
} from '@/lib/client/api'
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
import type { EstimateRouteFamily } from '../../estimateRouteFamily'
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

export function useEstimateV2SummaryLoader(
  estimateId: string,
  routeFamily: EstimateRouteFamily,
  state: SummaryLoaderState
) {
  const {
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
  } = state

  const loadSummary = useCallback(
    async (activeRef: { current: boolean }) => {
      try {
        setLoading(true)
        setError(null)

        const res = await authedFetch(routeFamily.estimateApiHref(estimateId), {
          cache: 'no-store',
        })
        const parsed = await parseApiResponse(res)
        const payload = getApiPayloadData<EstimateV2SummaryPageData>(parsed.json)

        if (!activeRef.current) return
        if (!res.ok || !payload) {
          const message = getApiErrorMessage(res, parsed, 'Failed to load estimate')
          console.error('Estimate V2 summary load failed', {
            estimateId,
            operation: 'loadEstimate',
            status: res.status,
            message,
          })
          setError(createEstimateV2Error(message, { retryable: true }))
          setLoading(false)
          return
        }

        setData(payload)

        const defaults = applyJobSettingsDefaults(
          payload.inputs?.jobsettings,
          payload.inputs?.org_defaults
        )
        setLaborDayEnabled(defaults.laborDayEnabled)
        setDayhours(defaults.dayhours)
        setRoundIncrement(defaults.roundIncrement)
        setLaborRate(defaults.laborRate)
        setJobMinEnabled(defaults.jobMinEnabled)
        setJobMinAmount(defaults.jobMinAmount)
        setTrimPaintProductId(payload.trim_paint?.paint_product_id ?? '')
        setTrimPaintGallons(payload.trim_paint?.gallons ?? 0)
        setTrimPaintQuarts(payload.trim_paint?.quarts ?? 0)

        const jobRes = await authedFetch(`/api/jobs/${payload.estimate.job_id}`, {
          cache: 'no-store',
        })
        const jobParsed = await parseApiResponse(jobRes)
        const jobPayload = jobParsed.json as ApiDataEnvelope<EstimateV2JobMeta> | null
        if (!activeRef.current) return
        if (jobRes.ok && jobPayload?.data) setJob(jobPayload.data)

        setLoading(false)
      } catch (error) {
        if (!activeRef.current) return
        console.error('Estimate V2 summary load crashed', {
          estimateId,
          operation: 'loadEstimate',
          error,
        })
        setError(createEstimateV2Error('Failed to fetch estimate summary', { retryable: true }))
        setLoading(false)
      }
    },
    [
      estimateId,
      routeFamily,
      setData,
      setDayhours,
      setError,
      setJob,
      setJobMinAmount,
      setJobMinEnabled,
      setLaborDayEnabled,
      setLaborRate,
      setLoading,
      setRoundIncrement,
      setTrimPaintGallons,
      setTrimPaintProductId,
      setTrimPaintQuarts,
    ]
  )

  useEffect(() => {
    if (!estimateId) return
    const activeRef = { current: true }
    void loadSummary(activeRef)
    return () => {
      activeRef.current = false
    }
  }, [estimateId, loadSummary])
}
